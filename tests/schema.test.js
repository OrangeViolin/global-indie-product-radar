import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { EVIDENCE_LABELS } from "../src/catalog.js";
import { validateCatalog } from "../src/validate.js";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/products.public.json", import.meta.url), "utf8"));

test("public catalog matches the provenance schema", () => {
  const result = validateCatalog(catalog);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(catalog.schema_version, "1.0");
  assert.equal(catalog.product_count, 10);
  assert.equal(catalog.products.length, 10);
  assert.equal(catalog.timezone, "Asia/Shanghai");
  assert.match(catalog.disclaimer_zh, /未公开/);
  assert.match(catalog.sort_order, /不是增长排名/);
});

test("evidence labels cover founder, platform, and third-party classes", () => {
  assert.equal(EVIDENCE_LABELS.开发者自述.en, "founder self-report");
  assert.equal(EVIDENCE_LABELS.收款平台核验.en, "collection-platform verification");
  assert.equal(EVIDENCE_LABELS.第三方估算.en, "third-party estimate");
});

test("validator rejects private fields, zeroed revenue, and hotlinked images", () => {
  const broken = structuredClone(catalog);
  broken.products[0].notion_url = "https://www.notion.so/private-page";
  broken.products[1].contact = "founder@example.com";
  broken.products[2].logo = "https://example.com/logo.png";
  broken.products[3].revenue = { status: "未公开", records: [{ metric_type: "MRR", value: 0 }] };
  broken.products[4].team_size.value = "Solo";
  const result = validateCatalog(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("Notion")));
  assert.ok(result.errors.some((error) => error.includes("邮箱")));
  assert.ok(result.errors.some((error) => error.includes("图片")));
  assert.ok(result.errors.some((error) => error.includes("未公开收入")));
});

test("validator rejects a partial name without its note", () => {
  const broken = structuredClone(catalog);
  const devin = broken.products.find((product) => product.slug === "planet").creators[0];
  devin.name_note = " ";
  const result = validateCatalog(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("name_note")));
});
