/**
 * Structural and privacy checks for products.public.json.
 * Batch-specific conflicts live in the tests, so a later public snapshot
 * can add records without failing the build, but it cannot smuggle in
 * private fields, flatten unpublished revenue into zero, or drop evidence.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const FORBIDDEN_KEY =
  /^(notion.*|growth_?score|content_?score|rubric|rank|ranking|api_?key|password|secret|email|phone|confidence|hook|queue_status)$/i;
const ALLOWED_EVIDENCE = new Set(["开发者自述", "收款平台核验", "第三方估算", "公开事实"]);
const ALLOWED_QUALIFIER = new Set(["exact", "at_least", "approximate"]);
const ALLOWED_REVENUE_STATUS = new Set(["未公开", "有公开记录"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WINDOW_KEYS = ["period_start", "period_end", "published_at", "observed_at", "timezone_note"];

function isHttps(value) {
  return typeof value === "string" && value.startsWith("https://");
}

function checkWindow(windowValue, path, errors) {
  if (!windowValue || typeof windowValue !== "object" || Array.isArray(windowValue)) {
    errors.push(`${path}.window 必须是对象`);
    return;
  }
  for (const key of WINDOW_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(windowValue, key)) {
      errors.push(`${path}.window 缺少 ${key}`);
    }
  }
  for (const key of ["period_start", "period_end", "published_at", "observed_at"]) {
    const value = windowValue[key];
    if (value !== null && !(typeof value === "string" && DATE.test(value))) {
      errors.push(`${path}.window.${key} 必须是 YYYY-MM-DD 或 null`);
    }
  }
}

function checkRecord(record, path, kind, errors) {
  if (!record || typeof record !== "object") {
    errors.push(`${path} 必须是对象`);
    return;
  }
  if (!record.metric_type || typeof record.metric_type !== "string") {
    errors.push(`${path}.metric_type 不能为空`);
  }
  if (typeof record.value !== "number" || !Number.isFinite(record.value) || record.value < 0) {
    errors.push(`${path}.value 必须是非负数字`);
  }
  if (!ALLOWED_QUALIFIER.has(record.value_qualifier)) {
    errors.push(`${path}.value_qualifier 不在允许集合内`);
  }
  if (kind === "revenue" && record.currency !== "USD") {
    errors.push(`${path}.currency 收入必须保留 USD`);
  }
  if (kind === "other" && record.currency !== null) {
    errors.push(`${path}.currency 非收入指标必须是 null，避免和金额混写`);
  }
  if (!ALLOWED_EVIDENCE.has(record.evidence_category)) {
    errors.push(`${path}.evidence_category 不在允许集合内`);
  }
  if (!isHttps(record.source_url)) {
    errors.push(`${path}.source_url 必须是 https 原文链接`);
  }
  if (!Number.isInteger(record.source_rechecked_http_status)) {
    errors.push(`${path}.source_rechecked_http_status 必须是整数`);
  }
  if (typeof record.coverage !== "string" || !record.coverage.trim()) {
    errors.push(`${path}.coverage 不能为空`);
  }
  if (typeof record.notes !== "string" || !record.notes.trim()) {
    errors.push(`${path}.notes 不能为空，冲突和时点说明需要留下来`);
  }
  checkWindow(record.window, path, errors);
}

function walkPrivacy(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkPrivacy(item, `${path}[${index}]`, errors));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key)) errors.push(`${path}.${key} 是禁止对外的字段`);
      walkPrivacy(nested, `${path}.${key}`, errors);
    }
    return;
  }
  if (typeof value !== "string") return;
  if (/notion\.(so|com|site)|notion\.io/i.test(value)) {
    errors.push(`${path} 含有 Notion 地址`);
  }
  if (EMAIL.test(value) || /mailto:|tel:/i.test(value)) {
    errors.push(`${path} 含有邮箱或电话`);
  }
  if (/\+\d{8,}/.test(value)) errors.push(`${path} 含有疑似电话号码`);
  if (/data:image\//i.test(value)) errors.push(`${path} 含有内嵌图片`);
  if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?\S*)?$/i.test(value)) {
    errors.push(`${path} 含有图片地址，本站不热链素材`);
  }
  if (/ntn_|secret_|api[_-]?key|bearer\s+/i.test(value)) {
    errors.push(`${path} 含有疑似凭据`);
  }
}

export function validateCatalog(catalog) {
  const errors = [];
  if (!catalog || typeof catalog !== "object") {
    return { ok: false, errors: ["顶层必须是对象"] };
  }
  walkPrivacy(catalog, "$", errors);
  if (catalog.schema_version !== "1.0") errors.push("schema_version 必须是 1.0");
  if (typeof catalog.exported_at !== "string" || !catalog.exported_at.includes("+08:00")) {
    errors.push("exported_at 必须是带 +08:00 的时间");
  }
  if (typeof catalog.timezone !== "string" || !catalog.timezone.trim()) {
    errors.push("timezone 不能为空");
  }
  if (typeof catalog.batch_label !== "string" || !catalog.batch_label.trim()) {
    errors.push("batch_label 不能为空");
  }
  if (!Array.isArray(catalog.products)) errors.push("products 必须是数组");
  if (catalog.product_count !== catalog.products?.length) {
    errors.push("product_count 必须等于 products 长度");
  }
  if (typeof catalog.sort_order !== "string" || !catalog.sort_order.includes("不是")) {
    errors.push("sort_order 必须说明这不是排名");
  }
  if (typeof catalog.disclaimer_zh !== "string" || !catalog.disclaimer_zh.includes("未公开")) {
    errors.push("disclaimer_zh 必须保留未公开收入的说明");
  }

  const slugs = new Set();
  for (const [index, product] of (catalog.products || []).entries()) {
    const path = `$.products[${index}]`;
    if (!product || typeof product !== "object") {
      errors.push(`${path} 必须是对象`);
      continue;
    }
    if (!SLUG.test(product.slug || "")) errors.push(`${path}.slug 必须是稳定的小写连字符`);
    if (slugs.has(product.slug)) errors.push(`${path}.slug 重复`);
    slugs.add(product.slug);
    if (!product.name || typeof product.name !== "string") errors.push(`${path}.name 不能为空`);
    if (!isHttps(product.website)) errors.push(`${path}.website 必须是 https 官网`);
    if (product.app_store_url !== null && !isHttps(product.app_store_url)) {
      errors.push(`${path}.app_store_url 必须是 https 或 null`);
    }
    if (typeof product.description_zh !== "string" || product.description_zh.trim().length < 8) {
      errors.push(`${path}.description_zh 需要有公开中文介绍`);
    }
    for (const key of ["product_types", "categories", "business_model"]) {
      if (!Array.isArray(product[key]) || product[key].some((item) => typeof item !== "string" || !item.trim())) {
        errors.push(`${path}.${key} 必须是非空字符串数组`);
      }
    }
    if (product.launch_date !== null && !(typeof product.launch_date === "string" && DATE.test(product.launch_date))) {
      errors.push(`${path}.launch_date 必须是日期或 null`);
    }
    if (!Array.isArray(product.creators)) errors.push(`${path}.creators 必须是数组`);
    for (const [creatorIndex, creator] of (product.creators || []).entries()) {
      const creatorPath = `${path}.creators[${creatorIndex}]`;
      if (!creator.name) errors.push(`${creatorPath}.name 不能为空`);
      if (!["verified", "partial"].includes(creator.name_certainty)) {
        errors.push(`${creatorPath}.name_certainty 只能是 verified 或 partial`);
      }
      if (creator.name_certainty === "partial" && !(creator.name_note || "").trim()) {
        errors.push(`${creatorPath} 部分核实的署名必须保留 name_note`);
      }
      if (!isHttps(creator.public_profile_url)) {
        errors.push(`${creatorPath}.public_profile_url 必须是公开 https 页面`);
      }
    }
    const team = product.team_size;
    if (!team || typeof team.value !== "string" || !team.value.trim()) {
      errors.push(`${path}.team_size.value 不能为空；未知要写成「未知」`);
    }
    if (team && !ALLOWED_EVIDENCE.has(team.evidence_category)) {
      errors.push(`${path}.team_size.evidence_category 不在允许集合内`);
    }
    if (team && !isHttps(team.source_url)) errors.push(`${path}.team_size.source_url 必须是 https`);
    if (team?.value === "未知" && !(team.note || "").trim()) {
      errors.push(`${path}.team_size 为未知时必须保留说明，不能改写成 Solo`);
    }
    if (!product.revenue || !ALLOWED_REVENUE_STATUS.has(product.revenue.status)) {
      errors.push(`${path}.revenue.status 只能是未公开或有公开记录`);
    } else if (product.revenue.status === "未公开" && (product.revenue.records || []).length !== 0) {
      errors.push(`${path} 未公开收入不能同时带着数字`);
    } else if (product.revenue.status === "有公开记录" && (product.revenue.records || []).length === 0) {
      errors.push(`${path} 有公开记录时不能是空列表`);
    }
    (product.revenue?.records || []).forEach((record, recordIndex) => {
      checkRecord(record, `${path}.revenue.records[${recordIndex}]`, "revenue", errors);
    });
    if (!Array.isArray(product.other_metrics)) errors.push(`${path}.other_metrics 必须是数组`);
    (product.other_metrics || []).forEach((record, recordIndex) => {
      checkRecord(record, `${path}.other_metrics[${recordIndex}]`, "other", errors);
    });
    if (!Array.isArray(product.sources) || product.sources.length === 0) {
      errors.push(`${path}.sources 至少要有一条`);
    }
    for (const [sourceIndex, source] of (product.sources || []).entries()) {
      const sourcePath = `${path}.sources[${sourceIndex}]`;
      if (!source.label) errors.push(`${sourcePath}.label 不能为空`);
      if (!isHttps(source.url)) errors.push(`${sourcePath}.url 必须是 https`);
      if (!Number.isInteger(source.rechecked_http_status)) {
        errors.push(`${sourcePath}.rechecked_http_status 必须是整数`);
      }
      if (typeof source.rechecked_at !== "string" || !source.rechecked_at.includes("T")) {
        errors.push(`${sourcePath}.rechecked_at 必须保留复检时间`);
      }
    }
    if (!(typeof product.last_verified_at === "string" && DATE.test(product.last_verified_at))) {
      errors.push(`${path}.last_verified_at 必须是日期`);
    }
    if (!product.last_verified_timezone) errors.push(`${path}.last_verified_timezone 不能为空`);
  }

  return { ok: errors.length === 0, errors };
}
