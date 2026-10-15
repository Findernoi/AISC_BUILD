# TalentMatch AI + Supabase

This project already includes a Vite + React front-end paired with an Express server. To connect it to Supabase for database and auth, follow the steps below.

## 1) Create a Supabase project

1. Go to https://supabase.com and create a project.
2. Open Project settings > API.
3. Copy:
   - Project URL
   - anon public key
   - service role key

## 2) Configure environment variables

Create a `.env` file in the project root based on `.env.example`:

```env
GEMINI_API_KEY="your-gemini-api-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

Do not expose the service role key in the browser. Only the anon key belongs in the client.

## 3) Backend usage

The Express backend now exposes basic Supabase auth checks:

- `GET /api/health` — app health
- `GET /api/auth/config` — checks whether Supabase is configured
- `GET /api/auth/me` — validate a Bearer token and return the authenticated user

Example request:

```bash
curl -H "Authorization: Bearer <supabase-access-token>" http://localhost:3000/api/auth/me
```

## 4) Front-end usage

The app now displays a Supabase email/password sign-in screen, supports account registration, restores the current session on reload, and provides sign out. If email confirmation is enabled in Supabase, users must confirm their address before signing in.

The file `src/lib/supabase.ts` exports a browser-safe client:

```ts
import { getSupabaseClient } from './lib/supabase';

const supabase = getSupabaseClient();
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});
```

## 5) Supabase database setup

Create tables such as `profiles` and `jobs` in Supabase SQL editor, for example:

```sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  department text,
  created_at timestamptz default now()
);
```

Then enable Row Level Security (RLS) and configure policies for your app.

## 6) Run the app

```bash
npm install --legacy-peer-deps
npm run dev
```

Open the local URL shown by Vite and the Express server and test the Supabase connection.
