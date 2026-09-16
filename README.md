# Audrey Job Feed

Audrey's personal job search and application tracking app.

## Separation rule

This repository is intentionally independent from `KBeltranJ/Initial-Kevin-Job-Agent-app`.

- Audrey has her own `jobs.json`.
- Audrey has her own `applied-index.json`.
- Audrey uses `ajf_` local-storage keys rather than Kevin's app keys.
- Audrey's local resume database is `audrey-job-feed-local`.
- Audrey's PWA cache is `audrey-job-feed-v3`.
- Audrey has her own Supabase project: `Audrey Job Feed` (`xepcruqasersecblorjn`).
- Audrey's private resume bucket is `audrey-resumes`.
- Kevin's jobs, applied-job history, resumes, notes, account data, and Supabase configuration are not copied or referenced here.

## Current build

The app is a PWA with:

- Today job feed loaded from this repository's `jobs.json`
- Save / Skip / Link Expired / Applied controls
- Saved jobs view
- Application tracker with date, stage, and notes
- CSV export
- Audrey-specific job criteria filters and three resume tracks
- Local browser resume library for offline use
- Audrey-only Supabase cloud synchronization
- Email + password account creation and sign-in, matching the authentication method used by Kevin's feed while using a completely separate backend
- Private sync for criteria, saved/skipped/applied states, application notes/stages, and Resume A/B/C
- PWA manifest and service worker

## Audrey's role tracks

- A — Salesforce / Business Systems
- B — UX / Product Design
- C — Product / Business Operations

## Cloud data

Audrey's Supabase project uses Audrey-only tables for profiles, search criteria, job states, applications, and resume metadata. Row Level Security restricts authenticated users to their own records. Resume files are stored in the private `audrey-resumes` bucket under the authenticated user's own folder.

The browser uses only Audrey's public/publishable Supabase key. Never place a Supabase secret/service-role key in this public repository.

## Resume/privacy rule

Do not commit Audrey's resume file, phone number, email address, street address, passwords, authentication tokens, or private application data to this repository. Resume files may be cached locally and synchronized only to Audrey's private Supabase Storage bucket. Generalized search metadata may be committed when needed to generate and rank Audrey's feed.

## Authentication

Audrey uses the same authentication approach as Kevin's current feed: Supabase email + password authentication with **Sign in**, **Create account**, **Sync now**, and **Sign out** controls. The implementation and account data are Audrey-only; Kevin's Supabase project is not used.

Hosted Supabase projects normally require new email/password accounts to confirm their email before signing in.

## Next steps

1. Create Audrey's first cloud account from the Criteria screen and confirm the email if prompted.
2. Test phone/desktop synchronization using Audrey's account.
3. Populate the first Audrey-only job feed.
4. Enable/test GitHub Pages deployment.
5. Add Audrey-only scheduled job searches after the feed pipeline is validated.

Never point this app at Kevin's Supabase project.
