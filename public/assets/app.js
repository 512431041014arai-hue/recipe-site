/* 一覧表示（フェーズ1）。materialピッカーはフェーズ2で追加する。 */

const DATA_INDEX = "data/index.json";

/** 材料名の正規化（reindex.mjs / add.js と同一ロジック） */
function normalizeIngredient(name) {
  return (name ?? "")
    .normalize("NFKC")
    .replace(/[（(].*?[)）]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/** 要素をつくる小さなヘルパー */
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

/** レシピカード1枚 */
function renderCard(r) {
  const thumb = r.thumb
    ? el("img", {
        class: "card-thumb",
        src: r.thumb,
        alt: r.title,
        loading: "lazy",
        width: "72",
        height: "72",
      })
    : el("div", { class: "card-thumb card-thumb-ph", text: "🍳", "aria-hidden": "true" });

  const meta = el("div", { class: "card-meta" }, [
    el("span", { text: `⏱ ${r.timeMinutes ?? "-"}分` }),
    r.tags && r.tags.length ? el("span", { text: r.tags.map((t) => `#${t}`).join(" ") }) : null,
  ]);

  const body = el("div", { class: "card-body" }, [
    el("p", { class: "card-title", text: r.title }),
    meta,
  ]);

  const card = el("a", { class: "card", href: `recipe.html?id=${encodeURIComponent(r.id)}` }, [
    thumb,
    body,
  ]);
  return el("li", {}, [card]);
}

/** 新着順（createdAt 降順、同日は id 昇順） */
function byNewest(a, b) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id.localeCompare(b.id);
}

function renderList(items) {
  const list = document.getElementById("card-list");
  list.replaceChildren(...items.map(renderCard));
}

/** 将来のnote連携用フック（初期は何もしない） */
function renderNoteFeed() {}

async function main() {
  const status = document.getElementById("status");
  try {
    const res = await fetch(DATA_INDEX, { cache: "no-cache" });
    if (!res.ok) throw new Error(`index.json: ${res.status}`);
    const index = await res.json();

    if (!index.length) {
      status.textContent = "まだレシピがありません。「＋追加」から登録してください。";
      return;
    }
    status.hidden = true;
    renderList([...index].sort(byNewest));
    renderNoteFeed();
  } catch (err) {
    status.textContent = `読み込みに失敗しました: ${err.message}`;
  }
}

main();
