import {
  BOILERPLATE_TIMEZONE_NOTE,
  REPO_NAME,
  disclosureCounts,
  evidenceOf,
  cardFreshness,
  formatDate,
  formatExportedAt,
  formatValue,
  freshness,
  hasMultipleCalibers,
  linkLabel,
  metricGroups,
  metricOf,
  monogram,
  QUALIFIER_LABELS,
  splitMetricProducts,
  uniqueInOrder,
  unknownFlags,
} from "./catalog.js";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function pageShell({ title, description, depth, body, script = false }) {
  const prefix = depth === 0 ? "" : "../".repeat(depth);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f4efe6">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="radar-repo" content="${REPO_NAME}">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${prefix}assets/site.css">
</head>
<body>
  <a class="skip" href="#content">跳到内容</a>
  <header class="top">
    <a class="brand" href="${prefix}index.html">全球独立产品雷达</a>
    <nav aria-label="页眉">
      <a href="${prefix}index.html">目录</a>
      <a href="${prefix}method/index.html">证据与方法</a>
      <a href="${prefix}data/products.public.json">公开数据</a>
    </nav>
  </header>
  <main id="content" tabindex="-1">
${body}
  </main>
  <footer class="colophon">
    <p>01fish 公开橱窗。页面在构建时生成，没有实时计数器，也不连接数据库。</p>
    <p>记录可以按 slug 单独更正或撤回。本站不收录私人联系方式、内部选题和评分。</p>
  </footer>
${script ? `  <script id="catalog-data" type="application/json">${script}</script>\n  <script type="module" src="${prefix}assets/app.js"></script>\n` : ""}</body>
</html>
`;
}

function footerDisclaimer(catalog) {
  return `<section class="disclaimer" aria-label="免责声明">
    <h2>关于这些数字</h2>
    <p>${escapeHtml(catalog.disclaimer_zh)}</p>
    <p>导出时间 ${escapeHtml(formatExportedAt(catalog.exported_at, catalog.timezone))}。批次 ${escapeHtml(catalog.batch_label)}。${escapeHtml(catalog.sort_order)}</p>
    <p><a href="method/index.html">阅读证据与方法</a></p>
  </section>`;
}

function detailDisclaimer(catalog, depthPrefix) {
  return `<section class="disclaimer" aria-label="免责声明">
    <h2>关于这些数字</h2>
    <p>${escapeHtml(catalog.disclaimer_zh)}</p>
    <p>导出时间 ${escapeHtml(formatExportedAt(catalog.exported_at, catalog.timezone))}。${escapeHtml(catalog.sort_order)}</p>
    <p><a href="${depthPrefix}method/index.html">阅读证据与方法</a></p>
  </section>`;
}

function optionList(values) {
  return values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
}

function recordArticles(records, kind) {
  return (records || [])
    .map((record) => {
      const metric = metricOf(record.metric_type);
      const evidence = evidenceOf(record.evidence_category);
      const fresh = freshness(record);
      const qualifier = QUALIFIER_LABELS[record.value_qualifier] || record.value_qualifier;
      const windowBits = [
        record.window?.period_start ? `起 ${formatDate(record.window.period_start)}` : null,
        record.window?.period_end ? `止 ${formatDate(record.window.period_end)}` : null,
      ].filter(Boolean);
      const timezoneNote =
        record.window?.timezone_note && record.window.timezone_note !== BOILERPLATE_TIMEZONE_NOTE
          ? record.window.timezone_note
          : "";
      const httpStatus = record.source_rechecked_http_status;
      const httpText =
        httpStatus === 200
          ? "来源链接在导出时返回 HTTP 200。这只说明当时打得开，不是重新审计了数字。"
          : `来源链接在导出时复检为 HTTP ${httpStatus}。地址仍是原来的公开页，没有改写成别的网址。`;
      return `<article class="record" data-kind="${escapeHtml(kind)}" data-metric="${escapeHtml(record.metric_type)}" data-evidence="${escapeHtml(record.evidence_category)}" data-value="${escapeHtml(record.value)}" data-currency="${escapeHtml(record.currency ?? "")}" data-qualifier="${escapeHtml(record.value_qualifier)}">
        <header class="record-head">
          <h3>${escapeHtml(metric.zh)} <span lang="en">${escapeHtml(metric.en)}</span></h3>
          <p class="figure">${escapeHtml(formatValue(record))}</p>
          <p class="qualifier">${escapeHtml(qualifier)}</p>
        </header>
        <dl class="facts">
          <div><dt>指标</dt><dd>${escapeHtml(record.metric_type)}</dd></div>
          <div><dt>币种</dt><dd>${record.currency ? escapeHtml(record.currency) : "不适用（不是金额）"}</dd></div>
          <div><dt>证据类别</dt><dd>${escapeHtml(evidence.zh)} <span lang="en">${escapeHtml(evidence.en)}</span>。${escapeHtml(evidence.note)}</dd></div>
          <div><dt>覆盖口径</dt><dd>${escapeHtml(record.coverage)}</dd></div>
          <div><dt>原文窗口</dt><dd>${windowBits.length ? escapeHtml(windowBits.join("，")) : "未标明"}</dd></div>
          <div><dt>原文发表日</dt><dd>${record.window?.published_at ? `<time datetime="${escapeHtml(record.window.published_at)}">${escapeHtml(formatDate(record.window.published_at))}</time>` : "未标明"}</dd></div>
          <div><dt>雷达观察日</dt><dd>${record.window?.observed_at ? `<time datetime="${escapeHtml(record.window.observed_at)}">${escapeHtml(formatDate(record.window.observed_at))}</time>` : "未标明"}</dd></div>
          <div><dt>新鲜度</dt><dd class="${fresh.stale ? "is-stale" : ""}">${escapeHtml(fresh.label)}</dd></div>
        </dl>
        ${timezoneNote ? `<p class="quiet">${escapeHtml(timezoneNote)}</p>` : ""}
        <p class="notes">${escapeHtml(record.notes)}</p>
        <p><a href="${escapeHtml(record.source_url)}" rel="noopener noreferrer external">查看来源 ${escapeHtml(linkLabel(record.source_url))}（新窗口）</a></p>
        <p class="flag ${httpStatus === 200 ? "" : "is-warning"}">${escapeHtml(httpText)}</p>
      </article>`;
    })
    .join("\n");
}

function issueCallouts(records, label) {
  const issues = metricGroups(records);
  if (!issues.length && !(label === "收入" && hasMultipleCalibers(records))) return "";
  const parts = [];
  for (const issue of issues) {
    if (issue.tone === "conflict") {
      parts.push(
        `<p class="callout is-conflict" data-conflict="true">冲突：${escapeHtml(issue.metric_type)} 有 ${issue.count} 条不同数字。不要合成、平均，也不要只留其中一个当作当前值。</p>`,
      );
    } else {
      parts.push(
        `<p class="callout is-distinct" data-distinct="true">同一指标「${escapeHtml(issue.metric_type)}」下有 ${issue.count} 条不同口径。不要加总，也不要互相替代。</p>`,
      );
    }
  }
  if (label === "收入" && hasMultipleCalibers(records)) {
    const names = [...new Set(records.map((record) => record.metric_type))].join("、");
    parts.push(
      `<p class="callout is-distinct" data-multi-caliber="true">这些收入记录的口径不同（${escapeHtml(names)}）。禁止用其中一条替代另一条，也不要用近 30 天营收反推 MRR。</p>`,
    );
  }
  return parts.join("\n");
}

function creatorBlock(creator) {
  const partial = creator.name_certainty === "partial";
  return `<article class="person">
    <h3>${escapeHtml(creator.name)}</h3>
    <p>${escapeHtml(creator.role || "公开角色未写明")} · ${partial ? "部分核实" : "已核实"}</p>
    ${partial ? `<p class="flag">姓氏或全名没有完全核实。本页不补全、不猜测。</p>` : ""}
    <p>${escapeHtml(creator.name_note || "")}</p>
    <p><a href="${escapeHtml(creator.public_profile_url)}" rel="noopener noreferrer external">公开页面 ${escapeHtml(linkLabel(creator.public_profile_url))}（新窗口）</a></p>
  </article>`;
}

function boundaryCallout(description) {
  if (!/不是医疗器械|不能用于诊断|不诊断|不用于诊断/.test(description || "")) return "";
  return `<p class="callout">官方边界已经写在介绍里：本页只保留产品能力与这句限制，不把健康经历写成标题。</p>`;
}

function teamBlock(team) {
  const evidence = evidenceOf(team.evidence_category);
  const unknown = team.value === "未知";
  return `<section>
    <h2>团队规模</h2>
    <p class="lead-fact">${unknown ? "团队规模未知" : `团队规模：${escapeHtml(team.value)}`}</p>
    ${unknown ? `<p class="flag">资料不足以确认人数。本页不把它写成 Solo。</p>` : ""}
    <dl class="facts">
      <div><dt>证据类别</dt><dd>${escapeHtml(evidence.zh)} <span lang="en">${escapeHtml(evidence.en)}</span></dd></div>
      <div><dt>说明</dt><dd>${escapeHtml(team.note || "")}</dd></div>
    </dl>
    <p><a href="${escapeHtml(team.source_url)}" rel="noopener noreferrer external">团队规模来源 ${escapeHtml(linkLabel(team.source_url))}（新窗口）</a></p>
  </section>`;
}

export function renderProduct(catalog, product, index) {
  const order = String(index + 1).padStart(2, "0");
  const flags = unknownFlags(product);
  const revenueRecords = product.revenue?.records || [];
  const freeButUnpublished =
    (product.business_model || []).includes("免费") && product.revenue?.status === "未公开";
  const description = product.description_zh;
  const body = `<article class="dossier">
      <p class="eyebrow"><a href="../../index.html">返回目录</a> · 收录序 ${order}，不是排名</p>
      <header class="dossier-head">
        <p class="monogram" aria-hidden="true">${escapeHtml(monogram(product.name))}</p>
        <h1 lang="en">${escapeHtml(product.name)}</h1>
      </header>
      <section>
        <h2>公开描述的需求</h2>
        <p class="deck">${escapeHtml(description)}</p>
        ${boundaryCallout(description)}
        <p class="quiet">只转述公开材料里的产品功能，不补充未写出的计划，也不把家庭或健康背景写成故事。</p>
      </section>
      <ul class="outbound">
        <li><a href="${escapeHtml(product.website)}" rel="noopener noreferrer external">官网 ${escapeHtml(linkLabel(product.website))}（新窗口）</a></li>
        ${
          product.app_store_url
            ? `<li><a href="${escapeHtml(product.app_store_url)}" rel="noopener noreferrer external">App Store ${escapeHtml(linkLabel(product.app_store_url))}（新窗口）</a></li>`
            : `<li>没有单独收录 App Store 链接。</li>`
        }
      </ul>
      ${flags.length ? `<ul class="flag-list">${flags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")}</ul>` : ""}
      <section>
        <h2>分类与商业模式</h2>
        <dl class="facts">
          <div><dt>类型</dt><dd>${escapeHtml(product.product_types.join("、"))}</dd></div>
          <div><dt>类别</dt><dd>${escapeHtml(product.categories.join("、"))}</dd></div>
          <div><dt>商业模式</dt><dd>${escapeHtml(product.business_model.join("、"))}。用词来自公开材料的归类，本页不另造价格。</dd></div>
          <div><dt>上线日</dt><dd>${product.launch_date ? `<time datetime="${escapeHtml(product.launch_date)}">${escapeHtml(formatDate(product.launch_date))}</time>` : "未公开"}</dd></div>
          <div><dt>雷达核验日</dt><dd><time datetime="${escapeHtml(product.last_verified_at)}">${escapeHtml(formatDate(product.last_verified_at))}</time>（${escapeHtml(product.last_verified_timezone)}）</dd></div>
          <div><dt>记录标识</dt><dd><code>${escapeHtml(product.slug)}</code></dd></div>
        </dl>
        ${freeButUnpublished ? `<p class="callout">商业模式里有「免费」，收入状态仍是未公开。免费不是一条金额为 0 的收入记录。</p>` : ""}
      </section>
      <section>
        <h2>署名</h2>
        ${(product.creators || []).length ? product.creators.map(creatorBlock).join("\n") : `<p>这条记录没有可公开的署名。</p>`}
      </section>
      ${teamBlock(product.team_size)}
      <section id="revenue">
        <h2>收入</h2>
        <p class="lead-fact">收入状态：${escapeHtml(product.revenue.status)}</p>
        ${
          product.revenue.status === "未公开"
            ? `<p class="callout">没有可引用的公开收入数字。空白不是 0，本页也不补一个当前收入。</p>`
            : `${issueCallouts(revenueRecords, "收入")}
        <div class="record-list">
          ${recordArticles(revenueRecords, "revenue")}
        </div>`
        }
      </section>
      <section id="other-metrics">
        <h2>其他公开指标</h2>
        <p class="quiet">用户规模、订阅数和付费用户都不是收入。</p>
        ${
          (product.other_metrics || []).length
            ? `${issueCallouts(product.other_metrics, "其他")}
        <div class="record-list">
          ${recordArticles(product.other_metrics, "other")}
        </div>`
            : `<p>这条记录没有另列的非收入指标。</p>`
        }
      </section>
      <section>
        <h2>来源与复检</h2>
        <p class="quiet">观察日和发表日按雷达记录的日历日展示。TrustMRR 的更新时刻如果原文没写时区，本页不把它换算成上海时间的钟点。HTTP 200 只说明导出时链接能打开。</p>
        <ul class="source-list">
          ${product.sources
            .map((source) => {
              const status =
                source.rechecked_http_status === 200
                  ? "导出复检 HTTP 200"
                  : `导出复检 HTTP ${source.rechecked_http_status}，原地址保留`;
              return `<li>
                <a href="${escapeHtml(source.url)}" rel="noopener noreferrer external">${escapeHtml(source.label)}：${escapeHtml(linkLabel(source.url))}（新窗口）</a>
                <span class="flag ${source.rechecked_http_status === 200 ? "" : "is-warning"}">${escapeHtml(status)}</span>
                ${source.recheck_note ? `<span class="quiet">${escapeHtml(source.recheck_note)}</span>` : ""}
              </li>`;
            })
            .join("\n")}
        </ul>
      </section>
      <p class="quiet"><a href="../../data/products.public.json">机器可读全文</a>在公开 JSON 里，可按 slug「${escapeHtml(product.slug)}」查找。增长未知：本批没有可比较基线。</p>
    </article>
    ${detailDisclaimer(catalog, "../../")}`;
  return pageShell({
    title: `${product.name} · 全球独立产品雷达`,
    description: description,
    depth: 2,
    body,
  });
}

export function renderIndex(catalog) {
  const products = catalog.products;
  const counts = disclosureCounts(products);
  const categories = uniqueInOrder(products.flatMap((product) => product.categories || []));
  const types = uniqueInOrder(products.flatMap((product) => product.product_types || []));
  const models = uniqueInOrder(products.flatMap((product) => product.business_model || []));
  const split = splitMetricProducts(products);
  const cards = products
    .map((product, index) => {
      const order = String(index + 1).padStart(2, "0");
      const revenueRecords = product.revenue?.records || [];
      const issues = [
        ...metricGroups(revenueRecords).map((issue) =>
          issue.tone === "conflict" ? `${issue.metric_type} 有冲突数字` : `${issue.metric_type} 有不同口径`,
        ),
        ...metricGroups(product.other_metrics || []).map((issue) =>
          issue.tone === "conflict" ? `${issue.metric_type} 有冲突数字` : `${issue.metric_type} 有不同口径`,
        ),
      ];
      if (hasMultipleCalibers(revenueRecords)) issues.push("收入有多条不同口径");
      const revenueBlock =
        product.revenue.status === "未公开"
          ? `<p class="revenue-line">收入未公开。这不是 0。</p>`
          : `<ul class="mini-metrics">
              ${revenueRecords
                .map(
                  (record) =>
                    `<li><span>${escapeHtml(metricOf(record.metric_type).zh)} <span lang="en">${escapeHtml(metricOf(record.metric_type).en)}</span></span> <span>${escapeHtml(formatValue(record))}</span> <span>${escapeHtml(evidenceOf(record.evidence_category).zh)}</span> <span>${escapeHtml(cardFreshness(record))}</span></li>`,
                )
                .join("")}
            </ul>`;
      const people = (product.creators || [])
        .map((creator) => {
          const mark = creator.name_certainty === "partial" ? "部分核实" : "已核实";
          return `${creator.name}（${mark}）`;
        })
        .join("、");
      const team =
        product.team_size.value === "未知"
          ? "团队规模未知"
          : `团队规模 ${product.team_size.value}（${product.team_size.evidence_category}）`;
      return `<article class="entry" data-slug="${escapeHtml(product.slug)}">
        <p class="monogram" aria-hidden="true">${escapeHtml(monogram(product.name))}</p>
        <div>
          <p class="eyebrow">收录序 ${order}</p>
          <h3><a href="products/${escapeHtml(product.slug)}/index.html" lang="en">${escapeHtml(product.name)}</a></h3>
          <p>${escapeHtml(product.description_zh)}</p>
          <p class="meta">${escapeHtml(product.categories.join(" · "))} · ${escapeHtml(product.business_model.join(" · "))}</p>
          <p class="meta">${escapeHtml(people || "署名未收录")} · ${escapeHtml(team)}</p>
          ${issues.length ? `<p class="flag">${escapeHtml(issues.join("；"))}。请分条看，不要合成。</p>` : ""}
          ${revenueBlock}
          <p><a href="products/${escapeHtml(product.slug)}/index.html">阅读这条记录</a></p>
        </div>
      </article>`;
    })
    .join("\n");

  const embedded = safeJson({
    products: products.map((product) => ({
      slug: product.slug,
      name: product.name,
      description_zh: product.description_zh,
      categories: product.categories,
      product_types: product.product_types,
      business_model: product.business_model,
      revenue: { status: product.revenue.status },
      creators: (product.creators || []).map((creator) => ({
        name: creator.name,
        role: creator.role,
        name_note: creator.name_note,
        name_certainty: creator.name_certainty,
      })),
    })),
  });

  const body = `<header class="mast">
      <p class="eyebrow">01fish 公开橱窗</p>
      <h1>全球独立产品雷达</h1>
      <p class="deck">首批 ${products.length} 个独立产品的公开例子。顺序是收录顺序，不是名次，也不是全球穷尽名录。</p>
      <p>核验日写在每条记录上，这一批是 2026 年 11 月 12 日。${counts.unpublished} 条收入未公开，${counts.published} 条保留了公开记录。未公开不是 0。没有可比较的增长基线，所以这里没有增长率，也没有「增长最快」。</p>
      <dl class="stamp">
        <div><dt>导出</dt><dd><time datetime="${escapeHtml(catalog.exported_at)}">${escapeHtml(formatExportedAt(catalog.exported_at, catalog.timezone).replace(/（[^）]*）$/, "").trim())}</time><span class="quiet">${escapeHtml(catalog.timezone)}</span></dd></div>
        <div><dt>排序</dt><dd>${escapeHtml(catalog.sort_order)}</dd></div>
        <div><dt>需分条阅读</dt><dd>${split.length ? escapeHtml(split.map((product) => product.name).join("、")) : "没有"}</dd></div>
      </dl>
    </header>
    <section class="method-strip" aria-labelledby="how-to-read">
      <h2 id="how-to-read">怎样阅读这些数字</h2>
      <div class="legend">
        <article>
          <h3>开发者自述</h3>
          <p lang="en">founder self-report</p>
          <p>当事人自己公布的数字。不是审计，也不能因为页面今天还开着，就当成此刻的收入。</p>
        </article>
        <article>
          <h3>收款平台核验</h3>
          <p lang="en">collection-platform verification</p>
          <p>收款或订阅平台的公开核验。它仍不是利润，也不能和其他口径合成一个「当前收入」。</p>
        </article>
        <article>
          <h3>第三方估算</h3>
          <p lang="en">third-party estimate</p>
          <p>外部估算。${escapeHtml(thirdPartyEstimateCopy(catalog))}</p>
        </article>
      </div>
      <p class="quiet">团队规模若是未知，就写未知，不升格成 Solo。署名若只是部分核实，就保留这个限制。完整说明在 <a href="method/index.html">证据与方法</a>。</p>
    </section>
    <section aria-labelledby="browse">
      <h2 id="browse">浏览这 ${products.length} 条</h2>
      <form class="filters" data-filters action="index.html" method="get">
        <label for="q">搜索
          <input id="q" name="q" type="search" placeholder="产品名、中文介绍、署名" autocomplete="off">
        </label>
        <label for="category">类别
          <select id="category" name="category">
            <option value="">全部</option>
            ${optionList(categories)}
          </select>
        </label>
        <label for="type">类型
          <select id="type" name="type">
            <option value="">全部</option>
            ${optionList(types)}
          </select>
        </label>
        <label for="model">商业模式
          <select id="model" name="model">
            <option value="">全部</option>
            ${optionList(models)}
          </select>
        </label>
        <label for="revenue">收入状态
          <select id="revenue" name="revenue">
            <option value="">全部</option>
            <option value="未公开">未公开</option>
            <option value="有公开记录">有公开记录</option>
          </select>
        </label>
        <label for="sort">排列
          <select id="sort" name="sort">
            <option value="batch">收录顺序</option>
            <option value="name">英文名称</option>
          </select>
        </label>
      </form>
      <p id="result-count" data-count aria-live="polite">显示 ${products.length} / ${products.length} 条。筛选只收窄浏览，不产生排名。</p>
      <noscript><p>筛选需要浏览器脚本。不运行脚本时，${products.length} 条记录会全部列出，详情页仍可打开。</p></noscript>
      <div class="catalog" data-catalog>
        ${cards}
      </div>
      <p class="empty" data-empty hidden>没有符合的记录。可以清空筛选。这不表示数据缺失。</p>
    </section>
    ${footerDisclaimer(catalog).replace('href="method/index.html"', 'href="method/index.html"')}`;

  return pageShell({
    title: "全球独立产品雷达",
    description: "01fish 的公开橱窗：首批 10 个独立产品例子，保留证据、时点、冲突和未知，不是增长榜。",
    depth: 0,
    body,
    script: embedded,
  });
}

export function renderMethod(catalog) {
  const products = catalog.products;
  const stale = [];
  const undated = [];
  const blocked = [];
  for (const product of products) {
    for (const record of [...(product.revenue?.records || []), ...(product.other_metrics || [])]) {
      const fresh = freshness(record);
      const item = `${product.name} · ${record.metric_type} · ${fresh.label}`;
      if (!record.window?.published_at) undated.push(item);
      else if (fresh.stale) stale.push(item);
    }
    for (const source of product.sources || []) {
      if (source.rechecked_http_status !== 200) {
        blocked.push(`${product.name} · ${source.label} · HTTP ${source.rechecked_http_status} · ${source.url}`);
      }
    }
  }
  const list = (items, empty) =>
    items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>${empty}</p>`;
  const body = `<article class="essay">
      <p class="eyebrow"><a href="../index.html">返回目录</a></p>
      <h1>证据与方法</h1>
      <p class="deck">这是一页可以核对的橱窗，不是内部选题台，也不是排行榜。</p>
      <h2>这页是什么</h2>
      <p>全球独立产品雷达的公开页，目前只有 ${catalog.product_count} 个例子，批次「${escapeHtml(catalog.batch_label)}」。事实来自 ${escapeHtml(formatExportedAt(catalog.exported_at, catalog.timezone))} 导出的公开 JSON。网站在构建时把这份 JSON 生成静态页，访客不需要账号，页面也不连接数据库。</p>
      <h2>这页不是什么</h2>
      <ul>
        <li>不是全球产品普查，不能从这 ${catalog.product_count} 条推出行业规模。</li>
        <li>不是增长榜。本批没有同口径的更早基线，页面不计算增长率，也不做「增长最快」。</li>
        <li>不是收入英雄榜。同一产品的 MRR、累计营收、近 30 天营收并列保留，不合成一个当前收入。</li>
        <li>不是实时仪表盘。没有会跳动的计数器。新鲜度就是原文时点和雷达核验日。</li>
      </ul>
      <h2>证据类别</h2>
      <dl class="facts">
        <div><dt>开发者自述</dt><dd lang="en">founder self-report。当事人公布的数字，不是审计。</dd></div>
        <div><dt>收款平台核验</dt><dd lang="en">collection-platform verification。平台核验过的收款或订阅数据，不是利润。</dd></div>
        <div><dt>第三方估算</dt><dd><span lang="en">third-party estimate。</span>${escapeHtml(thirdPartyEstimateCopy(catalog))}以后若出现，也单独标出，不并进自述或平台核验。</dd></div>
        <div><dt>公开事实</dt><dd lang="en">public record。例如官网写明的共同创始人。它用来支撑署名或团队，不自动变成收入。</dd></div>
      </dl>
      <h2>未知怎样写</h2>
      <p>收入未公开就写未公开，不补 0。上线日、商业模式、团队规模也一样。团队规模未知的产品，不写成 Solo。署名若是部分核实，页面保留「部分核实」，不补姓氏。</p>
      <h2>冲突怎样留</h2>
      <p>同一指标若有两个数字，详情页并排贴出，并写明不要合成。口径不同的收入，例如 MRR 和近 30 天营收，也禁止互相替代。用户数、订阅数、付费用户都放在「其他公开指标」，不叫收入。</p>
      <h2>新鲜度</h2>
      <p>每条数字旁有原文发表日和雷达观察日。发表日早于观察日超过 30 天时，页面标成不要当成当前数字。没有发表日就写未标明，不估一个日期。</p>
      <h3>早于观察日 30 天以上的原文时点</h3>
      ${list(stale, "没有。")}
      <h3>原文未标明发表日</h3>
      ${list(undated, "没有。")}
      <h2>链接复检</h2>
      <p>导出时对引用链接做了不保存正文、不下载图片的 HTTP 复检。HTTP 200 只表示当时打得开。下面这些链接复检不是 200，页面仍使用原来的官方地址：</p>
      ${list(blocked, "本批引用链接的复检都是 HTTP 200。")}
      <h2>不会放上来的东西</h2>
      <ul>
        <li>内部选题、制作状态、评分、Notion 链接或数据库标识。</li>
        <li>邮箱、电话、住址、精确位置，以及未公开的私人账号。</li>
        <li>儿童姓名、肖像、病史，和把家庭故事重新写成卖点。</li>
        <li>未获授权的官网截图、标志和热链图片。卡片用文字和字标。</li>
      </ul>
      <h2>健康相关产品</h2>
      <p>介绍停留在产品能做什么。若公开材料写了「不是医疗器械」或「不用于诊断」，详情页会把这句边界留住。本站不提供诊断，也不改写个人健康经历。</p>
      <h2>怎样更正</h2>
      <p>开发者或读者可以要求更正、撤回署名、指标或整条记录。数据按 slug 更新：改 <code>data/products.public.json</code> 里对应的一条，跑测试，再构建。新的快照应追加为新记录，并保留旧窗口，不要覆盖历史数字后说成「一直如此」。只有同一来源、同一口径、且存在更早基线时，才可以在以后的版本写变化；在那之前不排序增长。</p>
      <p>链接若变成 404，先标失效并人工确认，不临时换成猜出来的新地址。</p>
    </article>
    ${detailDisclaimer(catalog, "../")}`;
  return pageShell({
    title: "证据与方法 · 全球独立产品雷达",
    description: "全球独立产品雷达如何保留证据类别、冲突口径、未知项和核验日期。这不是增长榜。",
    depth: 1,
    body,
  });
}

export function renderNotFound() {
  const body = `<article class="essay">
      <h1>没有这条记录</h1>
      <p>这个地址没有对应的公开产品页。目录里目前是首批例子，不是所有独立产品。</p>
      <p><a id="home-link" href="index.html">返回目录</a></p>
    </article>
    <script>
      (function () {
        var repo = ${JSON.stringify(REPO_NAME)};
        var parts = location.pathname.split("/").filter(Boolean);
        var index = parts.indexOf(repo);
        var base = index >= 0 ? "/" + parts.slice(0, index + 1).join("/") + "/" : "/";
        document.querySelectorAll("a[href], link[href]").forEach(function (node) {
          var href = node.getAttribute("href");
          if (!href || /^(https?:|\\/\\/|#)/.test(href)) return;
          node.setAttribute("href", base + href.replace(/^\\.?\\//, ""));
        });
      })();
    </script>`;
  return pageShell({
    title: "没有这条记录 · 全球独立产品雷达",
    description: "这个地址没有对应的公开产品记录。",
    depth: 0,
    body,
  });
}

export function renderSite(catalog) {
  const files = new Map();
  files.set("index.html", renderIndex(catalog));
  files.set("method/index.html", renderMethod(catalog));
  files.set("404.html", renderNotFound());
  catalog.products.forEach((product, index) => {
    files.set(`products/${product.slug}/index.html`, renderProduct(catalog, product, index));
  });
  return files;
}

function thirdPartyEstimateCount(catalog) {
  return catalog.products.reduce((sum, product) => {
    const records = product.revenue?.records || [];
    return sum + records.filter((record) => record.evidence_category === "第三方估算").length;
  }, 0);
}

function thirdPartyEstimateCopy(catalog) {
  const count = thirdPartyEstimateCount(catalog);
  if (count === 0) return "本批收入记录里没有这一类，页面不会为了看起来完整而补一个。";
  return `本批有 ${count} 条收入被标为第三方估算。它们与开发者自述、收款平台核验分开列出，不并成一个数。`;
}
