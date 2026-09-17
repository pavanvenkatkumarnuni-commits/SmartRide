require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false });
app.use(cors({ origin: true }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "development-secret-change-me";

function tokenFor(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req,res,next) {
  const h=req.headers.authorization||"";
  if(!h.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required"});
  try { req.user=jwt.verify(h.slice(7),JWT_SECRET); next(); }
  catch { return res.status(401).json({error:"Invalid or expired session"}); }
}
async function q(sql, params=[]) { return pool.query(sql,params); }

app.get("/api/health",(req,res)=>res.json({ok:true,service:"SmartRide API"}));

app.post("/api/auth/signup", async (req,res)=>{
  try {
    const {name,email,password,phone}=req.body;
    if(!name||!email||!password) return res.status(400).json({error:"Name, email and password are required"});
    if(password.length<8) return res.status(400).json({error:"Password must be at least 8 characters"});
    const hash=await bcrypt.hash(password,12);
    const r=await q("INSERT INTO users(name,email,password_hash,phone) VALUES($1,$2,$3,$4) RETURNING id,name,email,phone,verified,rating",[name,email.toLowerCase(),hash,phone||null]);
    res.status(201).json({user:r.rows[0],token:tokenFor(r.rows[0])});
} catch(e) { console.error("SIGNUP ERROR:", e); if(e.code==="23505") return res.status(409).json({error:"Email already registered"}); res.status(500).json({error:"Unable to create account"}); }});

app.post("/api/auth/login", async (req,res)=>{
  try {
    const {email,password}=req.body;
    const r=await q("SELECT * FROM users WHERE email=$1",[String(email||"").toLowerCase()]);
    if(!r.rows[0] || !(await bcrypt.compare(password||"",r.rows[0].password_hash))) return res.status(401).json({error:"Invalid email or password"});
    const u=r.rows[0]; delete u.password_hash;
    res.json({user:u,token:tokenFor(u)});
  } catch(e){res.status(500).json({error:"Unable to log in"});}
});

app.get("/api/users/me",auth,async(req,res)=>{
  const r=await q("SELECT id,name,email,phone,profile_photo,home_area,work_college_location,preferred_travel_time,recurring_commute_days,verified,rating,rating_count,created_at FROM users WHERE id=$1",[req.user.id]);
  res.json(r.rows[0]);
});
app.put("/api/users/me",auth,async(req,res)=>{
  const b=req.body;
  const r=await q(`UPDATE users SET name=COALESCE($1,name),phone=$2,profile_photo=$3,home_area=$4,work_college_location=$5,preferred_travel_time=$6,recurring_commute_days=$7 WHERE id=$8 RETURNING id,name,email,phone,profile_photo,home_area,work_college_location,preferred_travel_time,recurring_commute_days,verified,rating,rating_count`,
  [b.name||null,b.phone||null,b.profile_photo||null,b.home_area||null,b.work_college_location||null,b.preferred_travel_time||null,b.recurring_commute_days||[],req.user.id]);
  res.json(r.rows[0]);
});

app.get("/api/rides/mine",auth,async(req,res)=>{
  const r=await q(`SELECT r.*,u.name owner_name,u.profile_photo owner_photo,u.verified owner_verified,u.rating owner_rating,
  (SELECT count(*) FROM ride_requests rr WHERE rr.ride_id=r.id AND rr.status='pending') pending_requests
  FROM rides r JOIN users u ON u.id=r.owner_id WHERE r.owner_id=$1 ORDER BY r.date,r.departure_time`,[req.user.id]);
  res.json(r.rows);
});
app.post("/api/rides",auth,async(req,res)=>{
  try {
    const b=req.body;
    if(!b.start_location||!b.destination||!b.date||!b.departure_time||!b.available_seats||!b.vehicle_type) return res.status(400).json({error:"Required ride fields are missing"});
    const r=await q(`INSERT INTO rides(owner_id,start_location,destination,start_lat,start_lng,destination_lat,destination_lng,date,departure_time,available_seats,vehicle_type,recurring,recurring_days,description)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.id,b.start_location,b.destination,b.start_lat||null,b.start_lng||null,b.destination_lat||null,b.destination_lng||null,b.date,b.departure_time,Number(b.available_seats),b.vehicle_type,!!b.recurring,b.recurring_days||[],b.description||null]);
    res.status(201).json(r.rows[0]);
  } catch(e){res.status(500).json({error:"Unable to create ride"});}
});

/* Matching is deterministic and uses stored coordinates when available.
   If coordinates are absent, text compatibility is intentionally not presented as
   geospatial truth. A maps/geocoding provider can populate coordinates. */
function hav(lat1,lon1,lat2,lon2){
  if([lat1,lon1,lat2,lon2].some(v=>v===null||v===undefined||Number.isNaN(Number(v)))) return null;
  const R=6371, p=Math.PI/180, a=.5-Math.cos((lat2-lat1)*p)/2+Math.cos(lat1*p)*Math.cos(lat2*p)*(1-Math.cos((lon2-lon1)*p))/2;
  return 2*R*Math.asin(Math.sqrt(a));
}
function score(ride,b){
  const pickup=hav(b.start_lat,b.start_lng,ride.start_lat,ride.start_lng);
  const drop=hav(b.destination_lat,b.destination_lng,ride.destination_lat,ride.destination_lng);
  const sameStart=String(ride.start_location).toLowerCase().trim()===String(b.start_location||"").toLowerCase().trim();
  const sameDest=String(ride.destination).toLowerCase().trim()===String(b.destination||"").toLowerCase().trim();
  let route=0;
  if(sameStart&&sameDest) route=100;
  else if(sameStart||sameDest) route=72;
  else if(pickup!==null&&drop!==null) route=Math.max(0,100-Math.min(100,pickup*8+drop*8));
  else route=35;
  const pickupComponent=pickup===null?35:Math.max(0,100-Math.min(100,pickup*12));
  const dropComponent=drop===null?35:Math.max(0,100-Math.min(100,drop*12));
  let time=50;
  if(b.preferred_time && ride.departure_time){
    const a=String(b.preferred_time).slice(0,5), z=String(ride.departure_time).slice(0,5);
    const m=x=>{const [h,mi]=x.split(":").map(Number);return h*60+mi};
    const d=Math.abs(m(a)-m(z)); time=Math.max(0,100-Math.min(100,d*3));
  }
  let recurring=50;
  if(b.recurring_days?.length && ride.recurring_days?.length) recurring=b.recurring_days.some(x=>ride.recurring_days.includes(x))?100:20;
  const total=Math.round(route*.4+pickupComponent*.2+dropComponent*.15+time*.15+recurring*.1);
  return {compatibility:Math.min(100,total),route_overlap:Math.round(route),pickup_distance_km:pickup===null?null:Number(pickup.toFixed(1)),destination_distance_km:drop===null?null:Number(drop.toFixed(1)),time_score:Math.round(time),recurring_score:Math.round(recurring)};
}
app.post("/api/rides/match",auth,async(req,res)=>{
  const b=req.body;
  if(!b.start_location||!b.destination||!b.date) return res.status(400).json({error:"Starting location, destination and date are required"});
  const r=await q(`SELECT r.*,u.name owner_name,u.profile_photo owner_photo,u.verified owner_verified,u.rating owner_rating,u.rating_count,
    v.type vehicle_type_verified,v.make_model,v.seats vehicle_seats
    FROM rides r JOIN users u ON u.id=r.owner_id
    LEFT JOIN vehicles v ON v.user_id=u.id
    WHERE r.date=$1 AND r.status='open' AND r.available_seats>0 AND r.owner_id<>$2
    ORDER BY r.departure_time LIMIT 100`,[b.date,req.user.id]);
  const rows=r.rows.map(x=>({...x,match:score(x,b)})).filter(x=>x.match.compatibility>=25).sort((a,b)=>b.match.compatibility-a.match.compatibility);
  res.json(rows);
});
app.post("/api/rides/:id/request",auth,async(req,res)=>{
  const r=await q("SELECT * FROM rides WHERE id=$1",[req.params.id]);
  if(!r.rows[0]) return res.status(404).json({error:"Ride not found"});
  if(r.rows[0].owner_id===req.user.id) return res.status(400).json({error:"You own this ride"});
  try {
    const x=await q("INSERT INTO ride_requests(ride_id,requester_id,message) VALUES($1,$2,$3) RETURNING *",[req.params.id,req.user.id,req.body.message||null]);
    res.status(201).json(x.rows[0]);
  } catch(e){res.status(409).json({error:"You already requested this ride"});}
});
app.get("/api/requests/incoming",auth,async(req,res)=>{
  const r=await q(`SELECT rr.*,r.start_location,r.destination,r.date,r.departure_time,u.name requester_name,u.profile_photo requester_photo,u.verified requester_verified
  FROM ride_requests rr JOIN rides r ON r.id=rr.ride_id JOIN users u ON u.id=rr.requester_id
  WHERE r.owner_id=$1 ORDER BY rr.created_at DESC`,[req.user.id]); res.json(r.rows);
});
app.get("/api/requests/mine",auth,async(req,res)=>{
  const r=await q(`SELECT rr.*,r.start_location,r.destination,r.date,r.departure_time,u.name owner_name
  FROM ride_requests rr JOIN rides r ON r.id=rr.ride_id JOIN users u ON u.id=r.owner_id
  WHERE rr.requester_id=$1 ORDER BY rr.created_at DESC`,[req.user.id]); res.json(r.rows);
});
app.patch("/api/requests/:id",auth,async(req,res)=>{
  const s=req.body.status;
  if(!["accepted","rejected","cancelled"].includes(s)) return res.status(400).json({error:"Invalid status"});
  const r=await q(`SELECT rr.*,r.owner_id,r.available_seats FROM ride_requests rr JOIN rides r ON r.id=rr.ride_id WHERE rr.id=$1`,[req.params.id]);
  if(!r.rows[0]) return res.status(404).json({error:"Request not found"});
  const x=r.rows[0];
  if(x.owner_id!==req.user.id && s!=="cancelled") return res.status(403).json({error:"Not authorized"});
  await q("UPDATE ride_requests SET status=$1 WHERE id=$2",[s,req.params.id]);
  if(s==="accepted"){
    if(x.available_seats<1) return res.status(409).json({error:"No seats available"});
    await q("INSERT INTO passengers(ride_id,user_id) VALUES($1,(SELECT requester_id FROM ride_requests WHERE id=$2)) ON CONFLICT DO NOTHING",[x.ride_id,req.params.id]);
    await q("UPDATE rides SET available_seats=available_seats-1 WHERE id=$1 AND available_seats>0",[x.ride_id]);
  }
  res.json({ok:true,status:s});
});
app.get("/api/rides/:id/messages",auth,async(req,res)=>{
  const allowed=await q("SELECT 1 FROM passengers WHERE ride_id=$1 AND user_id=$2 UNION SELECT 1 FROM rides WHERE id=$1 AND owner_id=$2",[req.params.id,req.user.id]);
  if(!allowed.rows.length) return res.status(403).json({error:"You are not connected to this ride"});
  const r=await q(`SELECT m.id,m.body,m.created_at,u.id sender_id,u.name sender_name,u.profile_photo FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.ride_id=$1 ORDER BY m.created_at`,[req.params.id]); res.json(r.rows);
});
app.post("/api/rides/:id/messages",auth,async(req,res)=>{
  const allowed=await q("SELECT 1 FROM passengers WHERE ride_id=$1 AND user_id=$2 UNION SELECT 1 FROM rides WHERE id=$1 AND owner_id=$2",[req.params.id,req.user.id]);
  if(!allowed.rows.length) return res.status(403).json({error:"You are not connected to this ride"});
  if(!req.body.body?.trim()) return res.status(400).json({error:"Message is required"});
  const r=await q("INSERT INTO messages(ride_id,sender_id,body) VALUES($1,$2,$3) RETURNING *",[req.params.id,req.user.id,req.body.body.trim()]); res.status(201).json(r.rows[0]);
});
app.post("/api/users/block",auth,async(req,res)=>{await q("INSERT INTO blocked_users(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[req.user.id,req.body.user_id]);res.json({ok:true});});
app.post("/api/reports",auth,async(req,res)=>{await q("INSERT INTO reports(reporter_id,reported_user_id,ride_id,reason,details) VALUES($1,$2,$3,$4,$5)",[req.user.id,req.body.user_id||null,req.body.ride_id||null,req.body.reason,req.body.details||null]);res.status(201).json({ok:true});});
app.post("/api/verifications",auth,async(req,res)=>{const r=await q("INSERT INTO verifications(user_id,method) VALUES($1,$2) RETURNING *",[req.user.id,req.body.method||"email"]);res.status(201).json(r.rows[0]);});
app.post("/api/reviews",auth,async(req,res)=>{const {ride_id,reviewee_id,rating,comment}=req.body; const r=await q("INSERT INTO reviews(ride_id,reviewer_id,reviewee_id,rating,comment) VALUES($1,$2,$3,$4,$5) RETURNING *",[ride_id,req.user.id,reviewee_id,rating,comment||null]); await q("UPDATE users SET rating=((rating*rating_count)+$1)/(rating_count+1),rating_count=rating_count+1 WHERE id=$2",[rating,reviewee_id]); res.status(201).json(r.rows[0]);});
app.get("/api/saved-routes",auth,async(req,res)=>{const r=await q("SELECT * FROM saved_routes WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id]);res.json(r.rows);});
app.post("/api/saved-routes",auth,async(req,res)=>{const r=await q("INSERT INTO saved_routes(user_id,name,start_location,destination) VALUES($1,$2,$3,$4) RETURNING *",[req.user.id,req.body.name,req.body.start_location,req.body.destination]);res.status(201).json(r.rows[0]);});

const clientDist=path.join(__dirname,"dist");
app.use(express.static(clientDist));
app.get("*",(req,res)=>res.sendFile(path.join(clientDist,"index.html")));
app.listen(process.env.PORT||10000,()=>console.log("SmartRide server running"));
