import { db } from "hatchable";

export const access = "public";
export const methods = ["GET", "POST"];
const formats = ["diecut", "bat", "badge", "helmet", "sheet"];
const colorPattern = /^#[0-9a-fA-F]{6}$/;

function cleanConfig(input) {
  const c = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const text = (v, max, fallback = "") => typeof v === "string" ? v.trim().slice(0, max) : fallback;
  const color = (v, fallback) => typeof v === "string" && colorPattern.test(v) ? v : fallback;
  const num = (v, min, max, fallback) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;
  const photoKey = typeof c.photo_key === "string" && /^creasecraft\/[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(c.photo_key) ? c.photo_key : "";
  const elements = Array.isArray(c.elements) ? c.elements.slice(0, 40).map((item, i) => {
    const e = item && typeof item === "object" ? item : {};
    return { id: text(e.id, 40, "layer-" + i), type: e.type === "shape" ? "shape" : "text", text: text(e.text, 80),
      shape: ["star", "circle", "bolt", "stripe"].includes(e.shape) ? e.shape : "star",
      x: num(e.x, 0, 760, 380), y: num(e.y, 0, 900, 450), size: num(e.size, 8, 220, 48),
      color: color(e.color, "#C9F34A"), rotation: num(e.rotation, -180, 180, 0), font: e.font === "DM Sans" ? "DM Sans" : "Syne",
      weight: e.weight === "normal" ? "normal" : "bold", opacity: num(e.opacity, 0.1, 1, 1) };
  }) : [];
  return {
    format: formats.includes(c.format) ? c.format : "diecut",
    style: ["performance", "heritage", "street", "league"].includes(c.style) ? c.style : "performance",
    motif: ["bolt", "wing", "flame", "slash", "crest", "star", "stripes", "none"].includes(c.motif) ? c.motif : "bolt",
    team: text(c.team, 32, "NORTHSIDE XI"), tagline: text(c.tagline, 50, "MADE TO STAND OUT"), number: text(c.number, 4, "07"),
    photo_key: photoKey, photo_name: text(c.photo_name, 180), photo_x: num(c.photo_x, 0, 760, 380), photo_y: num(c.photo_y, 0, 900, 440),
    photo_scale: num(c.photo_scale, 0.15, 2.5, 1), photo_rotation: num(c.photo_rotation, -180, 180, 0),
    outline_color: color(c.outline_color, "#FFFFFF"), outline_width: num(c.outline_width, 0, 36, 14),
    shadow: Boolean(c.shadow), shadow_blur: num(c.shadow_blur, 0, 42, 18), shadow_opacity: num(c.shadow_opacity, 0, 90, 42),
    font: c.font === "DM Sans" ? "DM Sans" : "Syne", type_color: color(c.type_color, "#191D1E"),
    background: color(c.background, "#F5F2E9"), accent: color(c.accent, "#C9F34A"), ink: color(c.ink, "#191D1E"), elements
  };
}

export default async function (req, res) {
  if (req.method === "POST") {
    const body = req.body || {};
    const studioKey = typeof body.studio_key === "string" ? body.studio_key.trim() : "";
    const name = typeof body.design_name === "string" ? body.design_name.trim().slice(0, 70) : "";
    if (!/^[a-zA-Z0-9-]{20,80}$/.test(studioKey)) return res.status(400).json({ error: "This studio session is invalid. Refresh the page and try again." });
    if (!name) return res.status(400).json({ error: "Give this design a name before saving." });
    const config = cleanConfig(body.config);
    const requestedCode = typeof body.share_code === "string" ? body.share_code.trim().toUpperCase() : "";
    if (requestedCode && /^[A-Z0-9]{10}$/.test(requestedCode)) {
      const updated = await db.query("UPDATE sticker_designs SET design_name = $1, config = $2::jsonb, updated_at = now() WHERE share_code = $3 AND studio_key = $4 RETURNING id, share_code, design_name, config, created_at, updated_at", [name, JSON.stringify(config), requestedCode, studioKey]);
      if (updated.rows.length) return res.status(200).json({ design: updated.rows[0] });
    }
    const shareCode = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    const saved = await db.query("INSERT INTO sticker_designs (share_code, studio_key, design_name, config) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, share_code, design_name, config, created_at, updated_at", [shareCode, studioKey, name, JSON.stringify(config)]);
    return res.status(201).json({ design: saved.rows[0] });
  }
  const shareCode = typeof req.query.share === "string" ? req.query.share.trim().toUpperCase() : "";
  if (shareCode) {
    if (!/^[A-Z0-9]{10}$/.test(shareCode)) return res.status(400).json({ error: "This share link is invalid." });
    const found = await db.query("SELECT share_code, design_name, config, created_at, updated_at FROM sticker_designs WHERE share_code = $1", [shareCode]);
    if (!found.rows.length) return res.status(404).json({ error: "That design link may have expired or been copied incorrectly." });
    return res.json({ design: found.rows[0] });
  }
  const studioKey = typeof req.query.key === "string" ? req.query.key.trim() : "";
  if (!/^[a-zA-Z0-9-]{20,80}$/.test(studioKey)) return res.status(400).json({ error: "A valid studio key is required." });
  const results = await db.query("SELECT id, share_code, design_name, config, created_at, updated_at FROM sticker_designs WHERE studio_key = $1 ORDER BY updated_at DESC LIMIT 24", [studioKey]);
  return res.json({ designs: results.rows });
}