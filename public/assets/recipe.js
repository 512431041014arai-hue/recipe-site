/* 詳細表示（フェーズ1） */

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child) node.appendChild(child);
  }
  return node;
}

/** レシピ1件を <article> に描画する。add.html のプレビューからも使う。 */
function renderRecipe(r, root) {
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

  if (r.tags && r.tags.length) {
    nodes.push(el("ul", { class: "taglist" }, r.tags.map((t) => el("li", { text: `#${t}` }))));
  }

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
        el("a", { href: r.sourceUrl, target: "_blank", rel: "noopener noreferrer", text: "元記事を見る →" }),
      ])
    );
  }

  root.replaceChildren(...nodes);
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
    document.title = `${recipe.title} | じすいレシピ`;
    renderRecipe(recipe, root);
  } catch {
    status.textContent = "見つかりませんでした。";
  }
}

if (document.getElementById("recipe")) main();
