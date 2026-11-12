import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/products.public.json", import.meta.url), "utf8"));
const bySlug = Object.fromEntries(catalog.products.map((product) => [product.slug, product]));

function values(product, kind, metric) {
  const records = kind === "revenue" ? product.revenue.records : product.other_metrics;
  return records.filter((record) => record.metric_type === metric).map((record) => record.value);
}

test("conflicting and distinct figures stay as separate records", () => {
  assert.deepEqual(values(bySlug.malyatko, "revenue", "MRR").sort((a, b) => a - b), [150, 200]);
  assert.ok(bySlug.malyatko.revenue.records.every((record) => record.evidence_category === "开发者自述"));
  assert.ok(bySlug.malyatko.revenue.records.some((record) => record.notes.includes("冲突")));
  assert.ok(bySlug.malyatko.revenue.records.every((record) => /冲突|不得与/.test(record.notes)));

  const tortolitos = bySlug.tortolitos.revenue.records;
  assert.deepEqual(
    tortolitos.map((record) => [record.metric_type, record.value, record.currency, record.evidence_category]),
    [
      ["MRR", 2198, "USD", "收款平台核验"],
      ["累计营收", 28512, "USD", "收款平台核验"],
      ["近30天营收", 308, "USD", "收款平台核验"],
    ],
  );
  assert.deepEqual(values(bySlug.tortolitos, "other", "用户规模").sort((a, b) => a - b), [50000, 100000]);

  assert.deepEqual(values(bySlug.macro, "other", "用户规模").sort((a, b) => a - b), [50000, 75000]);
  assert.equal(bySlug.macro.revenue.records[0].metric_type, "累计营收");
  assert.equal(bySlug.macro.revenue.records[0].value, 88000);
  assert.equal(bySlug.macro.revenue.records[0].evidence_category, "开发者自述");

  assert.deepEqual(values(bySlug.familymanager, "other", "用户规模").sort((a, b) => a - b), [1200, 2000]);
  assert.equal(bySlug.familymanager.revenue.status, "未公开");
});

test("unpublished revenue stays empty and unknown teams are not solo", () => {
  for (const slug of ["see-as-me", "onenest", "josie", "familymanager", "planet"]) {
    assert.equal(bySlug[slug].revenue.status, "未公开");
    assert.deepEqual(bySlug[slug].revenue.records, []);
  }
  for (const slug of ["tortolitos", "macro", "planet"]) {
    assert.equal(bySlug[slug].team_size.value, "未知");
  }
  assert.equal(bySlug.josie.team_size.value, "2-5");
  assert.deepEqual(
    bySlug.josie.creators.map((creator) => creator.name),
    ["Laure Santolini", "Manon Vervaeke"],
  );
  assert.equal(bySlug["see-as-me"].launch_date, "2026-09-06");
  assert.ok(catalog.products.filter((product) => product.slug !== "see-as-me").every((product) => product.launch_date === null));
});

test("partial names and blocked devpost links stay marked", () => {
  assert.equal(bySlug.babyscroll.creators[0].name, "Žilvinas");
  assert.equal(bySlug.babyscroll.creators[0].name_certainty, "partial");
  assert.equal(bySlug.planet.creators[0].name, "Devin");
  assert.equal(bySlug.planet.creators[0].name_certainty, "partial");
  assert.equal(bySlug.tortolitos.creators[0].name_certainty, "partial");

  const blocked = catalog.products.flatMap((product) =>
    product.sources.filter((source) => source.rechecked_http_status === 403).map((source) => source.url),
  );
  assert.deepEqual(blocked.sort(), [
    "https://devpost.com/software/macro-1tcgo4",
    "https://devpost.com/software/scroll-survival",
  ]);
});

test("this batch has no third-party revenue estimate and no growth field", () => {
  const estimates = catalog.products.flatMap((product) =>
    product.revenue.records.filter((record) => record.evidence_category === "第三方估算"),
  );
  assert.equal(estimates.length, 0);
  assert.equal(JSON.stringify(catalog).includes("growth_score"), false);
  assert.equal(JSON.stringify(catalog).toLowerCase().includes("notion.so"), false);
});
