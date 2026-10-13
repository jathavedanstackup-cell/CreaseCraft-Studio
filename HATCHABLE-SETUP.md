# Hatchable setup

- public/* -> public/*
- api/assets.js -> /api/assets
- api/designs.js -> /api/designs
- api/source-update.js -> /api/source-update (optional maintainer source-patch ZIP)
- migrations/001_matchday.sql -> migrations/001_matchday.sql

Apply the migration before relying on Save, My Designs or Share. Keep all paths in the same Hatchable project. The editor does not depend on the optional source-update endpoint.
