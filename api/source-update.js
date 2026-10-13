import { storage } from "hatchable";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  try {
    const archive = await storage.get("downloads/creasecraft-v12-source-update.zip");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=CreaseCraft-v12-Source-Update.zip");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).send(archive.buffer);
  } catch (error) {
    console.error("Source update bundle unavailable:", error);
    return res.status(503).json({ error: "The source patch bundle is temporarily unavailable. Try again shortly." });
  }
}