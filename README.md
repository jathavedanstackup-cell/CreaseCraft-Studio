# CreaseCraft Studio

A photo-to-sticker design studio with cricket-focused templates and general-purpose photo sticker customisation.

## Project structure
- public/index.html: Studio UI
- public/studio.css: Responsive Syne + DM Sans styling
- public/studio.js: SVG artwork canvas, photo upload, cutout, design controls, layers, PNG/SVG/JSON export, save/load/share UI
- api/assets.js: Image storage API
- api/designs.js: Design persistence and share API
- migrations/001_matchday.sql: PostgreSQL table and indexes

## Hatchable deployment
Copy the public directory, api directory, and migrations directory into a Hatchable project with the same paths, then deploy. The migration creates the design table. The Save and Share features require the API routes and database.

## Local use
Serve the public directory with a static web server for UI testing. PNG, SVG and JSON export work client-side. Database-backed saving and sharing require the Hatchable backend.

## Notes
Google Fonts are loaded externally (Syne and DM Sans). Background removal uses the browser SDK from bgremovers.org and includes a basic edge-colour fallback; review complex edges before printing. Before serving customer data at scale, add account-level ownership, rate limiting, and production privacy controls.