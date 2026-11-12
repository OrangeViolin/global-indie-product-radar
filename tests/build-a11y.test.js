import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createStaticServer } from "../src/static-server.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-build-"));

test.before(() => {
  const result = spawnSync(process.execPath, ["scripts/build.js"], {
    cwd: root,
    env: { ...process.env, OUT_DIR: outDir },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

function read(relativePath) {
  return fs.readFileSync(path.join(outDir, relativePath), "utf8");
}

function h1Count(html) {
  return (html.match(/<h1[\s>]/g) || []).length;
}

function rootAbsoluteAttrs(html) {
  return [...html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)].map((match) => match[1]);
}

function contrast(foreground, background) {
  const channel = (hex, offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test("build writes relative pages for every product and the method", () => {
  const index = read("index.html");
  for (const slug of [
    "see-as-me",
    "onenest",
    "scroll-survival",
    "tortolitos",
    "babyscroll",
    "macro",
    "josie",
    "malyatko",
    "familymanager",
    "planet",
  ]) {
    assert.match(index, new RegExp(`products/${slug}/index.html`));
    assert.equal(fs.existsSync(path.join(outDir, "products", slug, "index.html")), true);
    assert.deepEqual(rootAbsoluteAttrs(read(`products/${slug}/index.html`)), []);
  }
  assert.equal(fs.existsSync(path.join(outDir, "method", "index.html")), true);
  assert.equal(fs.existsSync(path.join(outDir, "data", "products.public.json")), true);
  assert.equal(fs.existsSync(path.join(outDir, ".nojekyll")), true);
  assert.deepEqual(rootAbsoluteAttrs(index), []);
  assert.deepEqual(rootAbsoluteAttrs(read("method/index.html")), []);
});

test("pages keep conflicts, evidence, currency, and unknown flags", () => {
  const index = read("index.html");
  const malyatko = read("products/malyatko/index.html");
  const tortolitos = read("products/tortolitos/index.html");
  const macro = read("products/macro/index.html");
  const family = read("products/familymanager/index.html");
  const planet = read("products/planet/index.html");
  const josie = read("products/josie/index.html");
  const baby = read("products/babyscroll/index.html");
  const see = read("products/see-as-me/index.html");
  const method = read("method/index.html");

  assert.match(index, /USD 2,198/);
  assert.match(index, /USD 28,512/);
  assert.match(index, /USD 308/);
  assert.match(index, /USD 150/);
  assert.match(index, /USD 200/);
  assert.match(malyatko, /data-conflict="true"/);
  assert.match(malyatko, /data-value="150"/);
  assert.match(malyatko, /data-value="200"/);
  assert.match(malyatko, /founder self-report/);
  assert.match(tortolitos, /data-multi-caliber="true"/);
  assert.match(tortolitos, /data-metric="MRR"/);
  assert.match(tortolitos, /data-metric="累计营收"/);
  assert.match(tortolitos, /data-metric="近30天营收"/);
  assert.match(tortolitos, /collection-platform verification/);
  assert.match(tortolitos, /data-value="50000"/);
  assert.match(tortolitos, /data-value="100000"/);
  assert.match(macro, /data-value="75000"/);
  assert.match(macro, /data-value="50000"/);
  assert.match(macro, /HTTP 403/);
  assert.match(family, /至少 2,000/);
  assert.match(family, /至少 1,200/);
  assert.match(family, /不是收入/);
  assert.match(planet, /团队规模未知/);
  assert.match(planet, /不把它写成 Solo/);
  assert.doesNotMatch(planet, /团队规模：Solo/);
  assert.match(planet, /部分核实/);
  assert.match(planet, /Devin/);
  assert.doesNotMatch(josie, /Solo/);
  assert.match(josie, /2-5/);
  assert.match(josie, /不是医疗器械/);
  assert.match(baby, /Žilvinas/);
  assert.match(baby, /部分核实/);
  assert.match(baby, /不要当成当前数字/);
  assert.match(see, /2026年9月6日/);
  assert.match(see, /收入状态：未公开/);
  assert.match(see, /免费不是一条金额为 0/);
  assert.doesNotMatch(see, /USD 0/);
  assert.match(method, /third-party estimate/);
  assert.match(method, /本批收入记录里没有这一类/);
  assert.match(method, /devpost\.com\/software\/scroll-survival/);
  assert.match(index, /不是增长榜|没有增长率/);
  assert.doesNotMatch(`${index}\n${method}`, /增长最快排行|当前收入是/);
});

test("generated pages exclude private material and live counters", () => {
  const html = fs
    .readdirSync(outDir, { recursive: true })
    .filter((relative) => String(relative).endsWith(".html") || String(relative).endsWith(".js"))
    .map((relative) => fs.readFileSync(path.join(outDir, relative), "utf8"))
    .join("\n");
  assert.doesNotMatch(html, /notion\.(so|com|site)/i);
  assert.doesNotMatch(html, /mailto:|growth_score|content_score|api[_-]?key|ntn_|data:image\//i);
  assert.doesNotMatch(html, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  assert.doesNotMatch(read("assets/app.js"), /setInterval|fetch\(/);
  assert.doesNotMatch(read("assets/site.css"), /@keyframes|animation:/);
  assert.doesNotMatch(html, /<img\b/i);
});

test("pages expose the basic accessible structure", () => {
  const pages = ["index.html", "method/index.html", "products/tortolitos/index.html", "404.html"];
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /class="skip" href="#content"/);
    assert.match(html, /<main id="content"/);
    assert.equal(h1Count(html), 1, page);
  }
  const index = read("index.html");
  assert.match(index, /<label for="q">/);
  assert.match(index, /<label for="category">/);
  assert.match(index, /<label for="type">/);
  assert.match(index, /<label for="model">/);
  assert.match(index, /<label for="revenue">/);
  assert.match(index, /<label for="sort">/);
  assert.match(index, /aria-live="polite"/);
  assert.match(index, /<noscript>/);
  assert.match(index, /value="batch"/);
  assert.match(index, /value="name"/);
  assert.doesNotMatch(index, /value="revenue"/);
  assert.match(index, /未公开不是 0/);
  const disclaimer = JSON.parse(fs.readFileSync(new URL("../data/products.public.json", import.meta.url), "utf8"));
  assert.ok(index.includes(disclaimer.disclaimer_zh));
});

test("stylesheet tokens meet contrast and small-screen layout", () => {
  const css = read("assets/site.css");
  const token = (name) => {
    const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(match, name);
    return match[1];
  };
  const pairs = [
    [token("--ink"), token("--paper")],
    [token("--muted"), token("--paper")],
    [token("--muted"), token("--paper-2")],
    [token("--moss"), token("--paper")],
    [token("--cinnabar-deep"), token("--paper")],
    [token("--amber-ink"), token("--amber-bg")],
    [token("--ink"), token("--moss-soft")],
    [token("--paper"), token("--ink")],
  ];
  for (const [foreground, background] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
  }
  assert.match(css, /@media \(max-width: 719px\)[\s\S]*\.catalog\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(min-width: 960px\)[\s\S]*\.catalog\s*\{[^}]*grid-template-columns:\s*1fr 1fr/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overflow-wrap:\s*break-word/);
});

test("static server respects the repository subpath and blocks traversal", async () => {
  const site = createStaticServer({ root: outDir, base: "/global-indie-product-radar" });
  const origin = await site.listen(0);
  try {
    const directory = await fetch(origin);
    assert.equal(directory.status, 200);
    const directoryHtml = await directory.text();
    assert.match(directoryHtml, /全球独立产品雷达/);
    const detailUrl = new URL("products/malyatko/index.html", origin);
    const detail = await fetch(detailUrl);
    assert.equal(detail.status, 200);
    assert.match(await detail.text(), /data-conflict="true"/);
    const styles = await fetch(new URL("assets/site.css", origin));
    assert.equal(styles.status, 200);
    const missing = await fetch(new URL("products/not-a-product", origin));
    assert.equal(missing.status, 404);
    const escaped = await fetch(`${origin.replace(/\/$/, "")}/../secret`);
    assert.ok(escaped.status === 403 || escaped.status === 404 || escaped.status === 400);
  } finally {
    await site.close();
  }
});
