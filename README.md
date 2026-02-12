# Finance MVP (Chrome + iPhone)

A web app (PWA) that works on:
- Chrome desktop
- iPhone Safari (Add to Home Screen)

## Setup (Supabase)
1) Create a Supabase project
2) SQL Editor → run `supabase/schema.sql`
3) Auth → enable Email/Password
4) Get your project URL + anon key

## Run locally
Copy `.env.example` → `.env.local` then:
npm install
npm run dev

## Invite users
Settings → create invite → user signs up with same email.
Then run in Supabase SQL editor (as that user):
select public.accept_invites();
