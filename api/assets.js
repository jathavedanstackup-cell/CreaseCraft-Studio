import { storage } from "hatchable";

export const access = "public";
export const methods = ["GET", "POST"];

const allowed = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export default async function (req, res) {
  if (req.method === "POST") {
    const body = req.body || {};
    const dataUrl = typeof body.data_url === "string" ? body.data_url : "";
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ error: "Upload a PNG, JPG, or WebP image." });
    const mime = match[1], base64 = match[2];
    if (base64.length > 8500000) return res.status(413).json({ error: "This image is too large to save. Try a smaller image." });
    const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
    const key = "creasecraft/" + crypto.randomUUID() + "." + allowed[mime];
    await storage.put(key, bytes, mime);
    return res.status(201).json({ key });
  }
  const key = typeof req.query.key === "string" ? req.query.key : "";
  if (!/^creasecraft\/[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(key)) return res.status(400).json({ error: "Invalid image asset key." });
  try {
    const asset = await storage.get(key);
    res.setHeader("Content-Type", asset.contentType || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(asset.buffer);
  } catch {
    return res.status(404).json({ error: "This image asset could not be found." });
  }
}