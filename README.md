# Going Once

Going Once is a small multiplayer-focused auction simulator and "bid war flipping" game built with Next.js, Prisma, and Supabase. Players buy, sell, and flip items through short-lived auctions while AI-driven NPCs and game systems keep the economy lively.

## Key Concepts

- Fast auctions: short, reactive auctions where bids and buy-now mechanics create tense decision points.
- Flipping: buy low, resell high — watch listings and time purchases for profit.
- NPC evaluators: non-player agents help populate listings and create dynamic markets.

## Features

- Live auction feed and per-auction detail pages
- Sell flow with listing creation and optional buy-now prices
- Player inventory and item artwork handling
- Backend lifecycle and evaluation logic implemented in `lib/game`

## Tech Stack

- Frontend: Next.js (app router)
- Database: PostgreSQL via Prisma
- Realtime/hosting: Supabase (project contains Supabase configuration)
- Language: TypeScript

## Project Structure (high level)

- `app/` — Next.js routes and pages
- `components/` — React UI components
- `lib/game/` — Auction engine, lifecycle and resolver logic
- `prisma/` — Schema, seed data, and migrations
- `supabase/` — Supabase config and policies

---
