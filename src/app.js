import { filterAndSort } from "./catalog.js";

const dataElement = document.getElementById("catalog-data");
const form = document.querySelector("[data-filters]");
const list = document.querySelector("[data-catalog]");
const count = document.querySelector("[data-count]");
const empty = document.querySelector("[data-empty]");

if (dataElement && form && list && count && empty) {
  const catalog = JSON.parse(dataElement.textContent);
  const cards = new Map(
    [...list.querySelectorAll("[data-slug]")].map((card) => [card.dataset.slug, card]),
  );

  const readCriteria = () => ({
    q: form.elements.q.value,
    category: form.elements.category.value,
    type: form.elements.type.value,
    model: form.elements.model.value,
    revenue: form.elements.revenue.value,
    sort: form.elements.sort.value,
  });

  const apply = () => {
    const criteria = readCriteria();
    const result = filterAndSort(catalog.products, criteria);
    const visible = new Set(result.map((product) => product.slug));
    for (const [slug, card] of cards) card.hidden = !visible.has(slug);
    for (const product of result) {
      const card = cards.get(product.slug);
      if (card) list.append(card);
    }
    count.textContent = `显示 ${result.length} / ${catalog.products.length} 条。筛选只收窄浏览，不产生排名。`;
    empty.hidden = result.length !== 0;
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(criteria)) {
      if (value && !(key === "sort" && value === "batch")) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const params = new URLSearchParams(location.search);
  for (const key of ["q", "category", "type", "model", "revenue", "sort"]) {
    if (params.has(key) && form.elements[key]) form.elements[key].value = params.get(key);
  }

  form.addEventListener("input", apply);
  form.addEventListener("change", apply);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    apply();
  });
  apply();
}
