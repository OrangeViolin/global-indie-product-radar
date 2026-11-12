import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "../src/static-server.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const base = process.env.BASE_PATH || "";
const site = createStaticServer({ root: path.join(root, "dist"), base });
const url = await site.listen(port);
console.log(`preview ${url}`);
