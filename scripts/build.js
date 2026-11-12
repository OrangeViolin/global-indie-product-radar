import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite } from "../src/render.js";
import { validateCatalog } from "../src/validate.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(root, process.env.OUT_DIR || "dist");
const catalogPath = path.join(root, "data", "products.public.json");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const validation = validateCatalog(catalog);
if (!validation.ok) {
  console.error(validation.errors.join("\n"));
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
fs.mkdirSync(path.join(outDir, "data"), { recursive: true });

for (const [relativePath, html] of renderSite(catalog)) {
  const target = path.join(outDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
}

fs.copyFileSync(path.join(root, "src", "site.css"), path.join(outDir, "assets", "site.css"));
fs.copyFileSync(path.join(root, "src", "app.js"), path.join(outDir, "assets", "app.js"));
fs.copyFileSync(path.join(root, "src", "catalog.js"), path.join(outDir, "assets", "catalog.js"));
fs.copyFileSync(path.join(root, "src", "favicon.svg"), path.join(outDir, "favicon.svg"));
fs.copyFileSync(catalogPath, path.join(outDir, "data", "products.public.json"));
fs.writeFileSync(path.join(outDir, ".nojekyll"), "");

console.log(`built ${catalog.products.length} products into ${outDir}`);
