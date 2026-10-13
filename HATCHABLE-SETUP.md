Hatchable mapping
- public/* -> public/*
- api/assets.js -> api/assets.js (endpoint /api/assets)
- api/designs.js -> api/designs.js (endpoint /api/designs)
- migrations/001_matchday.sql -> migrations/001_matchday.sql

Keep the static files and API paths together. The browser frontend resolves the API base from window.__HATCHABLE__.api when deployed on Hatchable.
