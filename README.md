# SmartRide

A full-stack carpooling and route-matching application.

## Local setup

1. Install Node.js 18+ and PostgreSQL.
2. Create a PostgreSQL database.
3. Run `database/schema.sql` against it.
4. Copy `.env.example` to `.env` and set `DATABASE_URL` and a long `JWT_SECRET`.
5. Run `npm install`.
6. Run `npm run dev`.
7. Open http://localhost:5173.

## Production deployment

### Render
1. Push this folder to a GitHub repository.
2. Create a Render Web Service from the repository.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Create PostgreSQL and set `DATABASE_URL`.
6. Set `JWT_SECRET` to a strong random value.
7. Deploy.

## Maps
The application stores optional latitude/longitude fields for rides. The matching engine only describes geographic distances when coordinates are actually stored; it never invents coordinates. Add a real geocoding/maps provider and wire it to the backend using `MAPS_API_KEY` / `MAPS_PROVIDER`.

## Security notes
Passwords are hashed with bcrypt. JWTs are short-lived session credentials. Personal fields are protected behind authenticated API routes. Before high-scale production, add rate limiting, CSRF strategy appropriate to deployment, structured audit logs, provider-backed verification, and a production maps/geocoding adapter.
