/* レシピ詳細。add.html のプレビューからも renderRecipe を使う。 */

import { el } from "./common.js";
import { TAG_GROUPS, findTag } from "./tags.js";

/** タグをグループごとにイラスト付きで並べる */
function tagSection(recipe) {
  const rows = [];
  for (const group of TAG_GROUPS) {
    const names = (recipe[group.key] ?? []).filter((n) => findTag(group.key, n));
    if (!names.length) continue;
    rows.push(
      el("div", { class: "tag-row" }, [
        el("span", { class: "tag-row-label", text: group.label }),
        el(
          "span",
          { class: "tag-row-items" },
          names.map((name) =>
            el("span", { class: "tag-pill" }, [
              el("span", { class: "tag-icon-wrap", html: findTag(group.key, name).icon, "aria-hidden": "true" }),
              el("span", { text: name }),
            ])
          )
        ),
      ])
    );
  }
  return rows.length ? el("div", { class: "tag-rows" }, rows) : null;
}

export function renderRecipe(r, root) {
  const nodes = [];

  if (r.thumb) {
    nodes.push(el("img", { class: "detail-thumb", src: r.thumb, alt: r.title, loading: "lazy" }));
  }
  nodes.push(el("h1", { class: "detail-title", text: r.title }));

  nodes.push(
    el("div", { class: "detail-meta" }, [
      el("span", { text: `⏱ ${r.timeMinutes ?? "-"}分` }),
      el("span", { text: `${r.servings ?? 1}人前` }),
      r.createdAt ? el("span", { text: `追加 ${r.createdAt}` }) : null,
    ])
  );

  nodes.push(tagSection(r));

  nodes.push(el("h2", { text: "材料" }));
  const rows = (r.ingredients ?? []).map((ing) =>
    el("tr", {}, [
      el("th", { scope: "row", text: ing.name }),
      el("td", { class: "amount", text: ing.amount ?? "" }),
    ])
  );
  nodes.push(el("table", { class: "ingredients" }, [el("tbody", {}, rows)]));

  nodes.push(el("h2", { text: "手順" }));
  nodes.push(el("ol", { class: "steps" }, (r.steps ?? []).map((s) => el("li", { text: s }))));

  if (r.notes) {
    nodes.push(el("h2", { text: "メモ" }));
    nodes.push(el("p", { text: r.notes }));
  }

  if (r.sourceUrl) {
    nodes.push(
      el("p", {}, [
        el("a", {
          href: r.sourceUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          text: "元記事を見る →",
        }),
      ])
    );
  }

  root.replaceChildren(...nodes.filter(Boolean));
  root.hidden = false;
}

async function main() {
  const status = document.getElementById("status");
  const root = document.getElementById("recipe");
  const id = new URLSearchParams(location.search).get("id");

  if (!id) {
    status.textContent = "レシピIDが指定されていません。";
    return;
  }
  // パストラバーサル防止：IDに使える文字を限定する
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    status.textContent = "見つかりませんでした。";
    return;
  }

  try {
    const res = await fetch(`data/recipes/${id}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error("not found");
    const recipe = await res.json();
    status.hidden = true;
    document.title = `${recipe.title} | 自炊の本棚`;
    renderRecipe(recipe, root);
  } catch {
    status.textContent = "見つかりませんでした。";
  }
}

if (document.getElementById("recipe")) main();
