# Campus Event Management System (CEMS)

React (Vite) + Node/Express + PostgreSQL (Supabase). Roles: student, organizer, admin.

## Setup

**1. Database (Supabase)**
1. Create a free project at https://supabase.com (save the database password).
2. Click **Connect** -> **Session pooler** -> copy the URI.
3. Put it in `backend/.env` as `DATABASE_URL` (with your password), and keep `DB_SSL=true`.

**2. Backend** (Node 20+)
```bash
cd backend
cp .env.example .env     # Windows: copy .env.example .env ; then edit it
npm install
npm run db:init          # creates tables in Supabase
npm run db:seed          # demo users + events
npm run dev              # http://localhost:5000
```

**3. Frontend** (new terminal)
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

**Demo logins** (password `Password123`): admin@cems.test, organizer@cems.test, student@cems.test

**Tests** (optional): set `TEST_DATABASE_URL` to a separate database, never your real one, then
```bash
cd backend
DB=test npm run db:init  # PowerShell: $env:DB="test"; npm run db:init
npm test
```
