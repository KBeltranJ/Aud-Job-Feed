# Audrey's Job Feed

Audrey's independent personal job-search and application-tracking app.

## Separation rule
This repository is intentionally separate from `KBeltranJ/Initial-Kevin-Job-Agent-app`.

- Audrey has her own `jobs.json` feed.
- Audrey has her own `applied-index.json` deduplication index.
- Audrey will use her own Supabase project and Google sign-in configuration.
- Kevin's job feed, applied history, resumes, notes, preferences, and Supabase data must never be copied into or read by this app.
- Audrey's data must never be written to Kevin's repository or Supabase project.

## Planned architecture
GitHub Pages hosts the PWA frontend. Public job-feed files remain job-level only. Private saved jobs, application notes/stages, preferences, and resumes will live in Audrey's separate Supabase environment protected by authentication and row-level security.

## Status
Foundation initialized. App UI and private cloud sync will be added in later setup steps.
