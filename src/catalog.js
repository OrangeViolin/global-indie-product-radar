/**
 * Shared catalog helpers for the static site and the Node tests.
 * This file is copied into the browser bundle. It must not read the
 * network, touch credentials, or invent rankings.
 */

export const EVIDENCE_LABELS = {
  开发者自述: {
    zh: "开发者自述",
    en: "founder self-report",
    note: "当事人自己公布的数字，不是审计。",
  },
  收款平台核验: {
    zh: "收款平台核验",
    en: "collection-platform verification",
    note: "收款或订阅平台的公开核验，不是利润审计。",
  },
  第三方估算: {
    zh: "第三方估算",
    en: "third-party estimate",
    note: "外部估算。本批收入记录里没有这一类。",
  },
  公开事实: {
    zh: "公开事实",
    en: "public record",
    note: "公开页面上可以直接核对的事实，不是收入估算。",
  },
};

export const METRIC_LABELS = {
  MRR: { zh: "月经常性收入", en: "MRR" },
  累计营收: { zh: "累计营收", en: "cumulative" },
  近30天营收: { zh: "近30天营收", en: "last 30 days" },
  活跃订阅: { zh: "活跃订阅", en: "active subscriptions" },
  付费用户: { zh: "付费用户", en: "paying users" },
  用户规模: { zh: "用户规模", en: "users" },
};

export const QUALIFIER_LABELS = {
  exact: "原文给出的确定数字",
  at_least: "原文带有「+」或「超过」，这里记下限",
  approximate: "原文是约数",
};

export const BOILERPLATE_TIMEZONE_NOTE =
  "observed_at 与 published_at 日期按公开页面或雷达观察记录；TrustMRR 更新时间原文未标明时区。";

export const REPO_NAME = "global-indie-product-radar";

export function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

export function productSearchText(product) {
  const creators = (product.creators || []).map((creator) =>
    [creator.name, creator.role, creator.name_note].filter(Boolean).join(" "),
  );
  return normalize(
    [
      product.name,
      product.slug,
      product.description_zh,
      ...(product.categories || []),
      ...(product.product_types || []),
      ...(product.business_model || []),
      product.revenue?.status,
      ...creators,
    ].join("\n"),
  );
}

export function matchesQuery(product, query) {
  const normalized = normalize(query);
  if (!normalized) return true;
  const text = productSearchText(product);
  return normalized.split(/\s+/).filter(Boolean).every((term) => text.includes(term));
}

export function filterAndSort(products, criteria = {}) {
  const sort = criteria.sort === "name" ? "name" : "batch";
  const indexed = products.map((product, index) => ({ product, index }));
  const filtered = indexed.filter(({ product }) => {
    if (!matchesQuery(product, criteria.q || "")) return false;
    if (criteria.category && !(product.categories || []).includes(criteria.category)) return false;
    if (criteria.type && !(product.product_types || []).includes(criteria.type)) return false;
    if (criteria.model && !(product.business_model || []).includes(criteria.model)) return false;
    if (criteria.revenue && product.revenue?.status !== criteria.revenue) return false;
    return true;
  });
  filtered.sort((a, b) => {
    if (sort === "name") {
      const byName = a.product.name.localeCompare(b.product.name, "en", { sensitivity: "base" });
      if (byName !== 0) return byName;
    }
    return a.index - b.index;
  });
  return filtered.map(({ product }) => product);
}

export function uniqueInOrder(values) {
  const seen = new Set();
  const ordered = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }
  return ordered.sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function metricGroups(records) {
  const map = new Map();
  for (const record of records || []) {
    const list = map.get(record.metric_type) || [];
    list.push(record);
    map.set(record.metric_type, list);
  }
  const issues = [];
  for (const [metricType, list] of map) {
    if (list.length < 2) continue;
    const notes = list.map((record) => record.notes || "").join("\n");
    issues.push({
      metric_type: metricType,
      count: list.length,
      tone: notes.includes("冲突") ? "conflict" : "distinct",
    });
  }
  return issues;
}

export function hasMultipleCalibers(records) {
  return new Set((records || []).map((record) => record.metric_type)).size > 1;
}

export function splitMetricProducts(products) {
  return products.filter((product) => {
    const revenue = product.revenue?.records || [];
    const other = product.other_metrics || [];
    return (
      metricGroups(revenue).length > 0 ||
      metricGroups(other).length > 0 ||
      hasMultipleCalibers(revenue)
    );
  });
}

export function daysBetween(start, end) {
  if (!start || !end) return null;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  return Math.round((endMs - startMs) / 86400000);
}

export function freshness(record) {
  const published = record.window?.published_at || null;
  const observed = record.window?.observed_at || null;
  const days = daysBetween(published, observed);
  if (!published) {
    return {
      published,
      observed,
      days: null,
      stale: false,
      label: "原文未标明发表日",
    };
  }
  if (days === null) {
    return { published, observed, days: null, stale: false, label: `原文时点 ${published}` };
  }
  if (days > 30) {
    return {
      published,
      observed,
      days,
      stale: true,
      label: `原文时点 ${published}，早于观察日 ${days} 天，不要当成当前数字`,
    };
  }
  return {
    published,
    observed,
    days,
    stale: false,
    label: `原文时点 ${published}，距观察日 ${days} 天。这仍是该时点的记录，不是实时计数`,
  };
}

export function formatValue(record) {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(record.value);
  const prefix =
    record.value_qualifier === "at_least" ? "至少 " : record.value_qualifier === "approximate" ? "约 " : "";
  if (record.currency === "USD") return `${prefix}USD ${formatted}`;
  return `${prefix}${formatted}`;
}

export function evidenceOf(category) {
  return (
    EVIDENCE_LABELS[category] || {
      zh: category || "未标注",
      en: "unmapped",
      note: "数据里的证据类别不在已知映射中，页面保留原文，没有改写成别的类别。",
    }
  );
}

export function metricOf(metricType) {
  return (
    METRIC_LABELS[metricType] || {
      zh: metricType || "未命名指标",
      en: "unmapped",
    }
  );
}

export function monogram(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const skip = new Set(["as", "of", "the", "a", "an", "and", "for"]);
  const significant = parts.filter((part) => !skip.has(part.toLowerCase()));
  const words = significant.length >= 2 ? significant : parts;
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => Array.from(word)[0].toUpperCase())
      .join("");
  }
  const capitals = (words[0] || "").match(/[A-Z][a-z0-9]*/g);
  if (capitals && capitals.length >= 2) {
    return `${capitals[0][0]}${capitals[1][0]}`.toUpperCase();
  }
  return Array.from(words[0] || "?").slice(0, 2).join("").toUpperCase();
}

export function cardFreshness(record) {
  const fresh = freshness(record);
  if (!fresh.published) return "发表日未标明";
  if (fresh.stale) return `原文 ${fresh.published}，不是当前数字`;
  return `原文 ${fresh.published}`;
}

export function formatExportedAt(iso, timezone) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return String(iso || "");
  const zone = timezone || "未标明时区";
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}（${zone}）`;
}

export function formatDate(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso ? String(iso) : "未标明";
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

export function linkLabel(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    return `${parsed.host}${path}`;
  } catch {
    return String(url || "");
  }
}

export function unknownFlags(product) {
  const flags = [];
  if (product.revenue?.status === "未公开") flags.push("收入未公开");
  if (!product.launch_date) flags.push("上线日未公开");
  if (product.team_size?.value === "未知") flags.push("团队规模未知");
  if ((product.business_model || []).includes("未知")) flags.push("商业模式未知");
  for (const creator of product.creators || []) {
    if (creator.name_certainty === "partial") flags.push(`署名部分核实：${creator.name}`);
  }
  return flags;
}

export function disclosureCounts(products) {
  const unpublished = products.filter((product) => product.revenue?.status === "未公开").length;
  return {
    total: products.length,
    unpublished,
    published: products.length - unpublished,
  };
}
