import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// For CommonJS, use __dirname directly
const viteDir = path.resolve();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
   
  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(viteDir, "public");

  if (!fs.existsSync(distPath)) {
    console.warn(`Build directory not found: ${distPath}. Skipping static file serving.`);
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ message: "Frontend not built" });
    }
  });
}