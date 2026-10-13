# CreaseCraft Studio

CreaseCraft is a responsive photo-to-sticker design studio for cricket teams, players, bat decals, gear and local leagues.

## Features
- Five templates: Performance, Street, Heritage, League and Blank.
- Photo upload, drag-and-drop, background removal SDK with a basic flat-edge fallback, image positioning and image colour adjustments.
- Outline, palette, motif, shadow, typography, custom text and editable graphic shapes.
- Layer visibility, movement locks, duplication, stacking, position/colour/size/rotation/opacity.
- Undo/redo, keyboard shortcuts, JSON project import/export, SVG artwork, transparent PNG and physical-size sticker sheets.
- Local draft recovery and cloud saving/sharing via Hatchable.

## Project structure
- public/index.html — editor UI and mobile navigation.
- public/studio.css — responsive visual system (Syne + DM Sans).
- public/studio.js — SVG canvas, editor state, history, photo adjustments, layers, import/export and save/share logic.
- api/assets.js — image storage API.
- api/designs.js — design persistence and share API.
- api/source-update.js — optional maintainer source-update ZIP endpoint.
- migrations/001_matchday.sql — saved-design schema.
- HATCHABLE-SETUP.md — deployment path mapping.

## Deploy / local use
Deploy public/, api/ and migrations/ together in Hatchable. Save, My Designs and Share require the backend and database; artwork editing and client-side exports work in a static browser server.

## Keyboard shortcuts
- Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z redo.
- Ctrl/Cmd+S save; Ctrl/Cmd+O upload photo; Ctrl/Cmd+Shift+O open JSON project.
- Ctrl/Cmd+D duplicate; Ctrl/Cmd+[ / ] move a layer in the stack.
- Arrow keys nudge unlocked layers; Shift+arrow nudges farther. Escape closes a modal/menu.

## Production notes
Background removal falls back to simple edge-colour removal only; review complex edges before printing. The sticker sheet is not a machine-specific cut contour and adds no print bleed. Saved designs currently use a browser-generated studio key, not a signed-in end-user account; add account ownership, rate limits and privacy/retention controls before scaling.
