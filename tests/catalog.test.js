import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  cardFreshness,
  daysBetween,
  filterAndSort,
  formatExportedAt,
  formatValue,
  freshness,
  metricGroups,
  monogram,
} from "../src/catalog.js";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/products.public.json", import.meta.url), "utf8"));
const products = catalog.products;

test("search matches Chinese, English names, and every term", () => {
  assert.deepEqual(filterAndSort(products, { q: "色觉" }).map((product) => product.slug), ["see-as-me"]);
  assert.deepEqual(filterAndSort(products, { q: "SEE AS ME" }).map((product) => product.slug), ["see-as-me"]);
  assert.deepEqual(filterAndSort(products, { q: "Žilvinas" }).map((product) => product.slug), ["babyscroll"]);
  assert.deepEqual(filterAndSort(products, { q: "Santiago" }).map((product) => product.slug), ["tortolitos"]);
  assert.deepEqual(filterAndSort(products, { q: "家庭 健康" }).map((product) => product.slug), [
    "babyscroll",
    "macro",
    "malyatko",
    "planet",
  ]);
  assert.deepEqual(filterAndSort(products, { q: "没有这个产品" }), []);
  assert.equal(filterAndSort(products, { q: "  " }).length, 10);
});

test("filters narrow by category, type, model, and revenue without ranking", () => {
  assert.deepEqual(filterAndSort(products, { type: "AI" }).map((product) => product.slug), ["macro"]);
  assert.deepEqual(filterAndSort(products, { model: "免费" }).map((product) => product.slug), ["see-as-me"]);
  assert.deepEqual(filterAndSort(products, { model: "未知" }).map((product) => product.slug), ["josie"]);
  assert.deepEqual(filterAndSort(products, { category: "娱乐", model: "订阅" }).map((product) => product.slug), [
    "scroll-survival",
  ]);
  assert.equal(filterAndSort(products, { revenue: "未公开" }).length, 5);
  assert.equal(filterAndSort(products, { revenue: "有公开记录" }).length, 5);
  assert.deepEqual(filterAndSort(products, { category: "睡眠", revenue: "未公开" }), []);
});

test("name sort is alphabetical and unknown sort stays in batch order", () => {
  assert.deepEqual(filterAndSort(products, { sort: "name" }).map((product) => product.slug), [
    "babyscroll",
    "familymanager",
    "josie",
    "macro",
    "malyatko",
    "onenest",
    "planet",
    "scroll-survival",
    "see-as-me",
    "tortolitos",
  ]);
  assert.equal(filterAndSort(products, { sort: "revenue" })[0].slug, "see-as-me");
  assert.equal(filterAndSort(products, {})[9].slug, "planet");
});

test("metric groups keep conflicts and distinct coverages apart", () => {
  const malyatko = metricGroups(products.find((product) => product.slug === "malyatko").revenue.records);
  assert.equal(malyatko[0].tone, "conflict");
  const family = metricGroups(products.find((product) => product.slug === "familymanager").other_metrics);
  assert.equal(family[0].tone, "distinct");
  assert.equal(family[0].metric_type, "用户规模");
});

test("freshness uses the original dates and does not invent a live value", () => {
  const baby = products.find((product) => product.slug === "babyscroll").revenue.records[0];
  const fresh = freshness(baby);
  assert.equal(fresh.stale, true);
  assert.match(fresh.label, /不要当成当前数字/);
  const current = products.find((product) => product.slug === "tortolitos").revenue.records[0];
  assert.equal(freshness(current).days, 1);
  assert.equal(freshness(current).stale, false);
  assert.equal(daysBetween("2026-11-11", "2026-11-12"), 1);
  assert.equal(formatValue(baby), "至少 USD 100,000");
  assert.equal(formatValue(current), "USD 2,198");
  assert.equal(formatExportedAt(catalog.exported_at, catalog.timezone), "2026年11月12日 15:35（Asia/Shanghai）");
  assert.equal(cardFreshness(baby), "原文 2026-04-09，不是当前数字");
  assert.equal(monogram("See as Me"), "SM");
  assert.equal(monogram("BabyScroll"), "BS");
  assert.equal(monogram("FamilyManager"), "FM");
  assert.equal(monogram("macro"), "MA");
});
