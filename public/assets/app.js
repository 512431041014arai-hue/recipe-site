/* 一覧＋材料レコメンド（フェーズ1・2） */

const DATA_INDEX = "data/index.json";
const CHIP_LIMIT = 24; // 初期表示するチップ数（超過分は「もっと見る」で展開）
const STORE_KEY = "picker_state";

/** 材料名の正規化（reindex.mjs / add.js と同一ロジック） */
function normalizeIngredient(name) {
  return (name ?? "")
    .normalize("NFKC")
    .replace(/[（(].*?[)）]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/** 常備調味料。サブセット判定のときだけ暗黙で「持っている」扱いにする。 */
const PANTRY = ["塩", "醤油", "砂糖", "油", "サラダ油", "水", "こしょう", "味噌", "酒", "みりん"]
  .map(normalizeIngredient);

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

/* ---------- 状態 ---------- */

const state = {
  index: [],          // 正規化済み ing を持たせた index.json
  selected: new Set(), // 正規化済み材料名
  mode: "or",
  includePantry: true,
  query: "",
  showAllChips: false,
};

function saveState() {
  try {
    sessionStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        selected: [...state.selected],
        mode: state.mode,
        includePantry: state.includePantry,
        query: state.query,
      })
    );
  } catch { /* プライベートモード等では保存できなくてよい */ }
}

function loadState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null");
    if (!saved) return;
    state.selected = new Set(saved.selected ?? []);
    state.mode = saved.mode === "subset" ? "subset" : "or";
    state.includePantry = saved.includePantry !== false;
    state.query = saved.query ?? "";
  } catch { /* 壊れていたら初期状態のまま */ }
}

/* ---------- レコメンド ---------- */

/**
 * @param {Array} index  正規化済み ing を持つインデックス
 * @param {Set<string>} selected 正規化済みの選択材料
 * @returns {Array<{r, matched, isSubset, ratio}>}
 */
function recommend(index, selected, { mode = "or", includePantry = true } = {}) {
  const base = includePantry ? new Set([...selected, ...PANTRY]) : selected;

  const scored = index.map((r) => {
    const ing = r.ing;
    const matched = ing.filter((x) => selected.has(x)).length;
    const isSubset = ing.every((x) => base.has(x));
    return { r, matched, isSubset, ratio: ing.length ? matched / ing.length : 0 };
  });

  let list = scored;
  if (selected.size > 0) {
    list = mode === "subset"
      ? scored.filter((s) => s.isSubset)
      : scored.filter((s) => s.matched >= 1);
  }

  if (selected.size === 0) {
    // 未選択時は新着順
    list.sort((a, b) =>
      (a.r.createdAt === b.r.createdAt
        ? a.r.id.localeCompare(b.r.id)
        : a.r.createdAt < b.r.createdAt ? 1 : -1)
    );
  } else {
    list.sort((a, b) =>
      (b.matched - a.matched) ||
      (a.r.timeMinutes - b.r.timeMinutes) ||
      (a.r.title.localeCompare(b.r.title, "ja"))
    );
  }
  return list;
}

/* ---------- 描画 ---------- */

function renderCard({ r, matched }) {
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
    matched > 0
      ? el("span", { class: "badge", text: `${r.ing.length}材料中${matched}つ一致` })
      : null,
    r.tags && r.tags.length ? el("span", { text: r.tags.map((t) => `#${t}`).join(" ") }) : null,
  ]);

  const card = el("a", { class: "card", href: `recipe.html?id=${encodeURIComponent(r.id)}` }, [
    thumb,
    el("div", { class: "card-body" }, [el("p", { class: "card-title", text: r.title }), meta]),
  ]);
  return el("li", {}, [card]);
}

/** 材料チップ（出現頻度降順 → 五十音順） */
function ingredientStats(index) {
  const counts = new Map();
  for (const r of index) {
    for (const name of new Set(r.ing)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name, "ja"));
}

function renderChips(stats) {
  const box = document.getElementById("chips");
  const more = document.getElementById("more-chips");

  // 選択中のものは省略されないよう常に先頭に含める
  const visible = state.showAllChips
    ? stats
    : [
        ...stats.slice(0, CHIP_LIMIT),
        ...stats.slice(CHIP_LIMIT).filter((s) => state.selected.has(s.name)),
      ];

  box.replaceChildren(
    ...visible.map((s) =>
      el("button", {
        type: "button",
        class: "chip",
        "aria-pressed": state.selected.has(s.name) ? "true" : "false",
        "data-name": s.name,
      }, [
        document.createTextNode(s.name),
        el("span", { class: "count", text: String(s.count) }),
      ])
    )
  );

  const hiddenCount = stats.length - visible.length;
  more.hidden = hiddenCount <= 0;
  more.textContent = `…もっと見る（あと${hiddenCount}件）`;
}

function renderSelected() {
  const area = document.getElementById("selected-area");
  const box = document.getElementById("selected-chips");
  if (state.selected.size === 0) {
    area.hidden = true;
    box.replaceChildren();
    return;
  }
  area.hidden = false;
  box.replaceChildren(
    ...[...state.selected].map((name) =>
      el("button", {
        type: "button",
        class: "chip-remove",
        "data-name": name,
        "aria-label": `${name} を外す`,
      }, [document.createTextNode(`${name} ✕`)])
    )
  );
}

function render() {
  const stats = ingredientStats(state.index);
  renderChips(stats);
  renderSelected();

  let list = recommend(state.index, state.selected, {
    mode: state.mode,
    includePantry: state.includePantry,
  });

  const q = state.query.normalize("NFKC").trim().toLowerCase();
  if (q) list = list.filter((s) => s.r.title.normalize("NFKC").toLowerCase().includes(q));

  const heading = document.getElementById("list-heading");
  heading.textContent =
    state.selected.size === 0 && !q
      ? `レシピ一覧（${list.length}件）`
      : `該当レシピ（${list.length}件）`;

  const status = document.getElementById("status");
  status.hidden = list.length > 0;
  if (list.length === 0) {
    status.textContent =
      state.mode === "subset"
        ? "この材料だけで作れるレシピはありませんでした。「いずれか含む」も試してみてください。"
        : "該当するレシピがありませんでした。";
  }

  document.getElementById("card-list").replaceChildren(...list.map(renderCard));
  saveState();
}

/* ---------- イベント ---------- */

function bindEvents() {
  document.getElementById("chips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const name = btn.dataset.name;
    if (state.selected.has(name)) state.selected.delete(name);
    else state.selected.add(name);
    render();
  });

  document.getElementById("selected-chips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-remove");
    if (!btn) return;
    state.selected.delete(btn.dataset.name);
    render();
  });

  document.getElementById("clear-all").addEventListener("click", () => {
    state.selected.clear();
    render();
  });

  document.getElementById("more-chips").addEventListener("click", () => {
    state.showAllChips = true;
    render();
  });

  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener("change", () => {
      state.mode = radio.value;
      syncPantryEnabled();
      render();
    });
  }

  document.getElementById("pantry").addEventListener("change", (e) => {
    state.includePantry = e.target.checked;
    render();
  });

  document.getElementById("search").addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });
}

/** 基本調味料トグルはサブセットモードでのみ効く */
function syncPantryEnabled() {
  const label = document.getElementById("pantry-label");
  const box = document.getElementById("pantry");
  const disabled = state.mode !== "subset";
  box.disabled = disabled;
  label.classList.toggle("disabled", disabled);
  label.title = disabled ? "「これだけで作れる」モードで有効になります" : "";
}

/** 保存済み状態をフォーム部品に反映 */
function syncControls() {
  document.querySelector(`input[name="mode"][value="${state.mode}"]`).checked = true;
  document.getElementById("pantry").checked = state.includePantry;
  document.getElementById("search").value = state.query;
  syncPantryEnabled();
}

/** 将来のnote連携用フック（初期は何もしない） */
function renderNoteFeed() {}

async function main() {
  const status = document.getElementById("status");
  try {
    const res = await fetch(DATA_INDEX, { cache: "no-cache" });
    if (!res.ok) throw new Error(`index.json: ${res.status}`);
    const index = await res.json();

    // 正規化は読み込み時に1回だけ済ませ、以降の絞り込みは全てメモリ内で行う
    state.index = index.map((r) => ({
      ...r,
      ing: [...new Set((r.ing ?? []).map(normalizeIngredient))].filter(Boolean),
    }));

    if (!state.index.length) {
      status.textContent = "まだレシピがありません。「＋追加」から登録してください。";
      return;
    }

    loadState();
    // 保存された選択のうち、今のインデックスに存在しない材料は捨てる
    const known = new Set(state.index.flatMap((r) => r.ing));
    state.selected = new Set([...state.selected].filter((n) => known.has(n)));

    document.getElementById("picker").hidden = false;
    syncControls();
    bindEvents();
    render();
    renderNoteFeed();
  } catch (err) {
    status.textContent = `読み込みに失敗しました: ${err.message}`;
  }
}

main();
