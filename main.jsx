import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";

const API="/api";
const getToken=()=>localStorage.getItem("smartride_token");
async function api(path,opts={}){const h={"Content-Type":"application/json",...(opts.headers||{})};const t=getToken();if(t)h.Authorization=`Bearer ${t}`;const r=await fetch(API+path,{...opts,headers:h});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed");return d}
const fmtDate=x=>new Date(x+"T00:00:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
function App(){
 const [user,setUser]=useState(null),[page,setPage]=useState("home"),[auth,setAuth]=useState("login"),[toast,setToast]=useState(""),[rides,setRides]=useState([]),[requests,setRequests]=useState([]),[matches,setMatches]=useState([]);
useEffect(()=>{
  if(getToken()){
    api("/users/me")
      .then(u=>{
        setUser(u);
        setPage("dashboard");
      })
      .catch(()=>{
        localStorage.removeItem("smartride_token");
      });
  }
},[]); const notify=x=>{setToast(x);setTimeout(()=>setToast(""),3500)};
 const logout=()=>{localStorage.removeItem("smartride_token");setUser(null);setPage("home")};
 if(!user)return <><Header user={null} setPage={setPage}/>{page==="home"?<Landing onStart={()=>setPage("auth")}/>:<Auth mode={auth} setMode={setAuth} onLogin={u=>{setUser(u);setPage("dashboard")}} notify={notify}/>} {toast&&<Toast text={toast}/>}</>;
return <><Header user={user} setPage={setPage} logout={logout}/><main key={page} className="page-transition"> {page==="dashboard"&&<Dashboard user={user} setPage={setPage} notify={notify}/>}
 {page==="create"&&<CreateRide notify={notify} onDone={()=>setPage("dashboard")}/>}
 {page==="find"&&<FindRide matches={matches} setMatches={setMatches} notify={notify}/>}
 {page==="requests"&&<Requests notify={notify} setRequests={setRequests} requests={requests}/>}
 {page==="profile"&&<Profile user={user} setUser={setUser} notify={notify}/>}
 {page==="chat"&&<Chat notify={notify}/>}
 {page==="safety"&&<Safety notify={notify}/>}
 </main>{toast&&<Toast text={toast}/>}</>
}
function Header({user,setPage,logout}){
  const [active,setActive]=useState("dashboard");

  const go=(page)=>{
    setActive(page);
    setPage(page);
  };

  return <header>
    <div className="brand" onClick={()=>go(user?"dashboard":"home")}>
      <span className="logo">S</span> SmartRide
    </div>

    {user?
      <nav>
        <button className={active==="find"?"active-tab":""} onClick={()=>go("find")}>
          Find Ride
        </button>

        <button className={active==="create"?"active-tab":""} onClick={()=>go("create")}>
          Offer Ride
        </button>

        <button className={active==="requests"?"active-tab":""} onClick={()=>go("requests")}>
          Requests
        </button>

        <button className={active==="profile"?"active-tab":""} onClick={()=>go("profile")}>
          Profile
        </button>

        <button className={`ghost ${active==="safety"?"active-tab":""}`} onClick={()=>go("safety")}>
          Safety
        </button>

        <button className="link" onClick={logout}>
          Log out
        </button>
      </nav>
      :
      <button className="navcta" onClick={()=>go("auth")}>
        Get started
      </button>
    }
  </header>
}
function Landing({onStart}){return <div className="landing"><section className="hero"><div><div className="eyebrow">COMMUTE TOGETHER</div><h1>Your route.<br/><em>Your people.</em></h1><p>SmartRide connects drivers and passengers traveling along similar routes, with transparent matching and safety-first controls.</p><div className="actions"><button className="primary" onClick={onStart}>Start riding</button><button className="secondary" onClick={onStart}>Offer a ride</button></div></div><div className="hero-card"><div className="mapfake"><span className="pin p1"></span><span className="pin p2"></span><span className="route"></span><div className="maplabel">Smart route match</div></div><div className="matchbox"><b>92%</b><span>route compatibility</span><small>2.1 km pickup • 8 min difference</small></div></div></section><section className="features"><Feature icon="⌁" title="Route-aware" text="Matches are based on route overlap, proximity and timing."/><Feature icon="✓" title="Verified profiles" text="Verification status and ratings are visible before you join."/><Feature icon="↗" title="Built for commutes" text="Save recurring routes and find people going your way."/><Feature icon="◈" title="Private by design" text="Only share the information needed for a safe ride."/></section></div>}

function Feature({icon,title,text}){return <div className="feature"><i>{icon}</i><h3>{title}</h3><p>{text}</p></div>}

function Auth({mode,setMode,onLogin,notify}){const [f,setF]=useState({name:"",email:"",password:"",phone:""});const submit=async e=>{e.preventDefault();try{const d=await api("/auth/"+(mode==="login"?"login":"signup"),{method:"POST",body:JSON.stringify(f)});localStorage.setItem("smartride_token",d.token);onLogin(d.user)}catch(x){notify(x.message)}};return <div className="authwrap"><form className="panel auth" onSubmit={submit}><div className="eyebrow">{mode==="login"?"WELCOME BACK":"JOIN SMARTRIDE"}</div><h2>{mode==="login"?"Log in":"Create your account"}</h2>{mode==="signup"&&<input placeholder="Full name" required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/>}<input type="email" placeholder="Email address" required value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>{mode==="signup"&&<input placeholder="Phone (optional)" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/>}<input type="password" placeholder="Password (8+ characters)" minLength="8" required value={f.password} onChange={e=>setF({...f,password:e.target.value})}/><button className="primary full">{mode==="login"?"Log in":"Create account"}</button><button type="button" className="link center" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"Need an account? Sign up":"Already registered? Log in"}</button></form></div>}

function Dashboard({user,setPage,notify}){const [my,setMy]=useState([]);const [incoming,setIncoming]=useState([]);useEffect(()=>{Promise.all([api("/rides/mine"),api("/requests/incoming")]).then(([a,b])=>{setMy(a);setIncoming(b)})},[]);return <div className="container"><div className="topline"><div><div className="eyebrow">DASHBOARD</div><h2>Good to see you, {user.name.split(" ")[0]}.</h2></div><button className="primary" onClick={()=>setPage("create")}>+ Offer a ride</button></div><div className="stats"><Stat n={my.length} t="My rides"/><Stat n={incoming.filter(x=>x.status==="pending").length} t="Pending requests"/><Stat n={my.filter(x=>x.date>=new Date().toISOString().slice(0,10)).length} t="Upcoming trips"/><Stat n={user.rating_count?Number(user.rating).toFixed(1):"—"} t="Your rating"/></div><section className="grid2"><div className="panel"><h3>My rides</h3>{my.length?<div className="ride-list">{my.map(r=><RideMini key={r.id} r={r}/>)}</div>:<Empty title="No rides yet" text="Offer your first ride and start sharing your commute." action={()=>setPage("create")}/>}</div><div className="panel"><h3>Find your next ride</h3><p className="muted">Tell us where you're going. SmartRide will compare available rides using real stored route data.</p><button className="secondary full" onClick={()=>setPage("find")}>Find a ride →</button><div className="safety-note">✓ Your contact details stay private until a ride connection exists.</div></div></section></div>}

function Stat({n,t}){
  return (
    <div className="stat">
      <b>{n}</b>
      <span>{t}</span>
      <div className="stat-shine"></div>
    </div>
  );
}
function RideMini({r}){return <div className="ride-mini"><div><b>{r.start_location} → {r.destination}</b><span>{fmtDate(r.date)} · {String(r.departure_time).slice(0,5)} · {r.vehicle_type}</span></div><strong>{r.available_seats} seats</strong></div>}

function CreateRide({notify,onDone}){const [f,setF]=useState({start_location:"",destination:"",date:"",departure_time:"",available_seats:3,vehicle_type:"Car",recurring:false,recurring_days:[],description:""});const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];const sub=async e=>{e.preventDefault();try{await api("/rides",{method:"POST",body:JSON.stringify(f)});notify("Ride created successfully");onDone()}catch(x){notify(x.message)}};return <div className="container narrow"><div className="eyebrow">OFFER A RIDE</div><h2>Create a commute</h2><form className="panel formgrid" onSubmit={sub}><label>Starting location
  <select
    required
    value={f.start_location}
    onChange={e=>setF({...f,start_location:e.target.value})}
  >
    <option value="">Select your village / area</option>
    <option>SASI Engineering College</option>
    <option>Tadepalligudem</option>
    <option>Kadakatla</option>
    <option>Chinatadepalli</option>
    <option>Kadiyadda</option>
    <option>Pedatadepalli</option>
    <option>Ramannagudem</option>
    <option>Venkatramannagudem</option>
    <option>Nallajerla</option>
    <option>Tanuku</option>
    <option>Undrajavaram</option>
    <option>Duvva</option>
    <option>Other</option>
  </select>
</label><label>Destination
  <select
    required
    value={f.destination}
    onChange={e=>setF({...f,destination:e.target.value})}
  >
    <option value="">Select destination</option>
    <option>SASI Engineering College</option>
    <option>Tadepalligudem</option>
    <option>Kadakatla</option>
    <option>Chinatadepalli</option>
    <option>Kadiyadda</option>
    <option>Pedatadepalli</option>
    <option>Ramannagudem</option>
    <option>Venkatramannagudem</option>
    <option>Nallajerla</option>
    <option>Tanuku</option>
    <option>Undrajavaram</option>
    <option>Duvva</option>
    <option>Other</option>
  </select>
</label><label>Date<input type="date" required value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Departure time<input type="time" required value={f.departure_time} onChange={e=>setF({...f,departure_time:e.target.value})}/></label><label>Available seats<input type="number" min="1" max="8" required value={f.available_seats} onChange={e=>setF({...f,available_seats:e.target.value})}/></label><label>Vehicle type<select value={f.vehicle_type} onChange={e=>setF({...f,vehicle_type:e.target.value})}><option>Car</option><option>SUV</option><option>EV</option><option>Van</option><option>Other</option></select></label><label className="wide">Description<textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="Pickup flexibility, luggage, music preferences…"/></label><label className="check wide"><input type="checkbox" checked={f.recurring} onChange={e=>setF({...f,recurring:e.target.checked})}/> Recurring ride</label>{f.recurring&&<div className="days wide">{days.map(d=><button type="button" className={f.recurring_days.includes(d)?"day active":"day"} onClick={()=>setF({...f,recurring_days:f.recurring_days.includes(d)?f.recurring_days.filter(x=>x!==d):[...f.recurring_days,d]})}>{d}</button>)}</div>}<button className="primary wide">Publish ride</button></form></div>}

function FindRide({matches,setMatches,notify}){const [f,setF]=useState({start_location:"",destination:"",date:"",preferred_time:""});const search=async e=>{e.preventDefault();try{setMatches(await api("/rides/match",{method:"POST",body:JSON.stringify(f)}))}catch(x){notify(x.message)}};return <div className="container"><div className="eyebrow">FIND A RIDE</div><h2>Who's going your way?</h2><form className="searchbar panel" onSubmit={search}><input required placeholder="Starting location" value={f.start_location} onChange={e=>setF({...f,start_location:e.target.value})}/><span>→</span><input required placeholder="Destination" value={f.destination} onChange={e=>setF({...f,destination:e.target.value})}/><input type="date" required value={f.date} onChange={e=>setF({...f,date:e.target.value})}/><input type="time" value={f.preferred_time} onChange={e=>setF({...f,preferred_time:e.target.value})}/><button className="primary">Match</button></form>{matches.length?<div className="results">{matches.map(m=><MatchCard key={m.id} m={m} notify={notify}/>)}</div>:<div className="empty panel"><div className="big">⌁</div><h3>Search real available rides</h3><p>Enter your route and travel date to calculate compatibility against rides in the database.</p></div>}</div>}

function MatchCard({m,notify}){const [requested,setRequested]=useState(false);const request=async()=>{try{await api(`/rides/${m.id}/request`,{method:"POST",body:JSON.stringify({})});setRequested(true);notify("Join request sent")}catch(x){notify(x.message)}};return <div className="panel matchcard"><div className="driver"><div className="avatar">{m.owner_name?.[0]}</div><div><b>{m.owner_name}</b><span>{m.owner_verified?"✓ Verified · ":""}{m.owner_rating?`${Number(m.owner_rating).toFixed(1)} ★`:"New rider"}</span></div></div><div className="score"><b>{m.match.compatibility}%</b><span>match</span></div><div className="routecol"><strong>{m.start_location}</strong><i>│</i><strong>{m.destination}</strong><span>{fmtDate(m.date)} · {String(m.departure_time).slice(0,5)} · {m.vehicle_type}</span></div><div className="why"><b>Why it matches</b><span>{m.match.route_overlap}% route overlap</span><span>{m.match.pickup_distance_km===null?"Pickup distance needs mapped coordinates":`${m.match.pickup_distance_km} km pickup distance`}</span><span>{m.match.time_score>=75?"Departure time within your range":"Departure timing differs"}</span><span>{m.match.recurring_score>=75?"Recurring days align":"Recurring pattern not aligned"}</span></div><button className="primary" disabled={requested} onClick={request}>{requested?"Requested":"Join ride"}</button></div>}

function Requests({notify}){const [incoming,setIncoming]=useState([]),[mine,setMine]=useState([]);const load=()=>Promise.all([api("/requests/incoming"),api("/requests/mine")]).then(([a,b])=>{setIncoming(a);setMine(b)}).catch(x=>notify(x.message));useEffect(()=>{load()},[]);const act=async(id,status)=>{try{await api(`/requests/${id}`,{method:"PATCH",body:JSON.stringify({status})});notify(`Request ${status}`);load()}catch(x){notify(x.message)}};return <div className="container"><div className="eyebrow">RIDE REQUESTS</div><h2>Manage connections</h2><section className="grid2"><div className="panel"><h3>Incoming</h3>{incoming.length?incoming.map(x=><div className="request" key={x.id}><div><b>{x.requester_name}</b><span>{x.start_location} → {x.destination}<br/>{fmtDate(x.date)} · {String(x.departure_time).slice(0,5)}</span></div>{x.status==="pending"?<div className="row"><button className="primary small" onClick={()=>act(x.id,"accepted")}>Accept</button><button className="secondary small" onClick={()=>act(x.id,"rejected")}>Reject</button></div>:<Badge text={x.status}/>}</div>):<Empty title="No incoming requests" text="New join requests will appear here."/>}</div><div className="panel"><h3>My requests</h3>{mine.length?mine.map(x=><div className="request" key={x.id}><div><b>{x.owner_name}</b><span>{x.start_location} → {x.destination}<br/>{fmtDate(x.date)}</span></div><Badge text={x.status}/></div>):<Empty title="No requests" text="Find a ride and request a seat."/>}</div></section></div>}

function Badge({text}){return <span className={"badge "+text}>{text}</span>}

function Profile({user,setUser,notify}){const [f,setF]=useState(user||{});const save=async e=>{e.preventDefault();try{const u=await api("/users/me",{method:"PUT",body:JSON.stringify(f)});setUser(u);notify("Profile saved")}catch(x){notify(x.message)}};const verify=async()=>{try{await api("/verifications",{method:"POST",body:JSON.stringify({method:"email"})});notify("Verification request submitted")}catch(x){notify(x.message)}};return <div className="container narrow"><div className="eyebrow">PROFILE</div><h2>Your rider profile</h2><form className="panel formgrid" onSubmit={save}><label>Name<input value={f.name||""} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Email<input value={f.email||""} disabled/></label><label>Phone<input value={f.phone||""} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Home area<input value={f.home_area||""} onChange={e=>setF({...f,home_area:e.target.value})}/></label><label>Work / college location<input value={f.work_college_location||""} onChange={e=>setF({...f,work_college_location:e.target.value})}/></label><label>Preferred travel time<input value={f.preferred_travel_time||""} onChange={e=>setF({...f,preferred_travel_time:e.target.value})}/></label><label className="wide">Profile photo URL<input value={f.profile_photo||""} onChange={e=>setF({...f,profile_photo:e.target.value})} placeholder="https://…"/></label><button className="primary wide">Save profile</button></form><div className="panel verify"><b>{user.verified?"✓ Verified profile":"Verification"}</b><p>{user.verified?"Your profile is marked verified.":"Submit a configurable verification request. A production provider can be connected to process identity/email/phone verification."}</p>{!user.verified&&<button className="secondary" onClick={verify}>Request verification</button>}</div></div>}

function Chat({notify}){const [ride,setRide]=useState(""),[messages,setMessages]=useState([]),[body,setBody]=useState("");const load=()=>ride&&api(`/rides/${ride}/messages`).then(setMessages).catch(x=>notify(x.message));return <div className="container narrow"><div className="eyebrow">RIDE CHAT</div><h2>Talk to your ride group</h2><div className="panel"><input placeholder="Paste ride ID" value={ride} onChange={e=>setRide(e.target.value)}/><button className="secondary" onClick={load}>Open chat</button>{messages.map(m=><div className="message"><b>{m.sender_name||"Rider"}</b><span>{m.body}</span></div>)}{ride&&<form className="row" onSubmit={async e=>{e.preventDefault();try{await api(`/rides/${ride}/messages`,{method:"POST",body:JSON.stringify({body})});setBody("");load()}catch(x){notify(x.message)}}}><input value={body} onChange={e=>setBody(e.target.value)} placeholder="Message your ride group"/><button className="primary">Send</button></form>}</div></div>}

function Safety({notify}){
  const [uid,setUid]=useState("");
  const [reason,setReason]=useState("");
  const [showGuidance,setShowGuidance]=useState(false);

  return <div className="container narrow">
    <div className="eyebrow">SAFETY & PRIVACY</div>
    <h2>Stay in control</h2>

    <div className="grid2">

      <div className="panel">
        <h3>Emergency help</h3>

        <p>
          If you're in immediate danger, contact your local emergency service.
          SmartRide should not replace emergency services.
        </p>

        <button
          className="secondary full"
          onClick={()=>setShowGuidance(!showGuidance)}
        >
          {showGuidance ? "Hide safety guidance" : "Show safety guidance"}
        </button>

        {showGuidance && <div className="safety-guidance">

          <h4>Safety guidance</h4>

          <ol>
            <li>If you are in immediate danger, contact your local emergency service.</li>
            <li>Move to a safe and public location if possible.</li>
            <li>Share your trip details with someone you trust.</li>
            <li>Do not share passwords, OTPs, banking information, or sensitive personal information.</li>
            <li>If you feel uncomfortable with another rider, leave the ride when it is safe to do so.</li>
            <li>Use the Report or Block options below to flag concerning behaviour.</li>
          </ol>

          <div className="safety-note">
            <b>Important:</b> SmartRide is not an emergency-response service.
            For immediate danger, contact the appropriate local emergency service.
          </div>

        </div>}
      </div>

      <div className="panel report-panel">
        <h3>Report or block</h3>

        <p className="muted">
          Enter the rider's User ID and choose an action.
        </p>

        <div className="report-fields">

          <input
            placeholder="User ID"
            value={uid}
            onChange={e=>setUid(e.target.value)}
          />

          <input
            placeholder="Reason for report"
            value={reason}
            onChange={e=>setReason(e.target.value)}
          />

        </div>

        <div className="report-actions">

          <button
            className="secondary"
            onClick={async()=>{
              try{
                await api("/users/block",{
                  method:"POST",
                  body:JSON.stringify({user_id:uid})
                });
                notify("User blocked");
              }catch(x){
                notify(x.message);
              }
            }}
          >
            Block user
          </button>

          <button
            className="primary"
            onClick={async()=>{
              try{
                await api("/reports",{
                  method:"POST",
                  body:JSON.stringify({
                    user_id:uid,
                    reason
                  })
                });
                notify("Report submitted");
              }catch(x){
                notify(x.message);
              }
            }}
          >
            Report user
          </button>

        </div>
      </div>

    </div>
  </div>
}
function Empty({title,text,action}){return <div className="empty"><div className="big">○</div><h4>{title}</h4><p>{text}</p>{action&&<button className="secondary" onClick={action}>Get started</button>}</div>}

function Toast({text}){return <div className="toast">{text}</div>}
document.addEventListener("click",e=>{
  const button=e.target.closest("button");
  if(!button)return;

  const ripple=document.createElement("span");
  ripple.className="click-ripple";

  const rect=button.getBoundingClientRect();

  ripple.style.left=(e.clientX-rect.left)+"px";
  ripple.style.top=(e.clientY-rect.top)+"px";

  button.appendChild(ripple);

  setTimeout(()=>ripple.remove(),650);
});
createRoot(document.getElementById("root")).render(<App/>);
