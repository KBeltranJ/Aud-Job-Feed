# Audrey Job Feed

Audrey's personal job search and application tracking app.

## Separation rule

This repository is intentionally independent from `KBeltranJ/Initial-Kevin-Job-Agent-app`.

- Audrey has her own `jobs.json`.
- Audrey has her own `applied-index.json`.
- Audrey uses `ajf_` local-storage keys rather than Kevin's app keys.
- Audrey's local resume database is `audrey-job-feed-local`.
- Audrey's PWA cache is `audrey-job-feed-v1`.
- Kevin's jobs, applied-job history, resumes, notes, account data, and Supabase configuration are not copied here.
- No Supabase project is connected during Step 2 or the resume/criteria review step.

## Current build

The frontend is a local-only PWA with:

- Today job feed loaded from this repository's `jobs.json`
- Save / Skip / Link Expired / Applied controls
- Saved jobs view
- Application tracker with date, stage, and notes
- CSV export
- Job criteria filters
- Three placeholder resume tracks (A/B/C) to customize for Audrey
- Local browser resume library
- PWA manifest and service worker

A separate `career-profile.json` now defines the Audrey-only schema for resume-derived career positioning, search criteria, and resume-track assignments. Its values intentionally remain blank until Audrey's resume is reviewed.

## Resume/privacy rule

Do not commit Audrey's resume file, phone number, email address, street address, authentication data, or private application data to this repository. Resume files remain in Audrey's browser-local resume library until her separate private storage is created. `career-profile.json` may contain only generalized search metadata needed to generate and rank Audrey's job feed.

## Next steps

1. Review Audrey's resume and populate `career-profile.json` with generalized career/search criteria and actual A/B/C resume tracks.
2. Populate her first Audrey-only job feed.
3. Create a completely separate Supabase project for Audrey.
4. Add Google Sign-In to Audrey's Supabase project.
5. Test phone/desktop synchronization.
6. Enable GitHub Pages for this repository.

Never point this app at Kevin's Supabase project.
