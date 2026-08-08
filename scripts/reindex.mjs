#!/usr/bin/env node
/**
 * public/data/recipes/*.json を全走査して public/data/index.json を再生成する。
 * 依存なし。リポジトリのどこから実行してもよい（パスはこのファイル基準）。
 *
 *   node scripts/reindex.mjs
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const RECIPES_DIR = fileURLToPath(new URL("../public/data/recipes/", import.meta.url));
const INDEX_FILE = fileURLToPath(new URL("../public/data/index.json", import.meta.url));

/** 材料名の正規化（assets/app.js / assets/add.js と同一ロジック） */
function normalizeIngredient(name) {
  return (name ?? "")
    .normalize("NFKC")
    .replace(/[（(].*?[)）]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function toIndexRow(recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    thumb: recipe.thumb ?? null,
    timeMinutes: recipe.timeMinutes ?? null,
    ing: [...new Set((recipe.ingredients ?? []).map((x) => normalizeIngredient(x.name)))].filter(Boolean),
    tags: recipe.tags ?? [],
    createdAt: recipe.createdAt ?? "",
  };
}

/** createdAt 降順、同日は id 昇順 */
function byNewest(a, b) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id.localeCompare(b.id);
}

async function main() {
  const files = (await readdir(RECIPES_DIR)).filter((f) => f.endsWith(".json")).sort();
  const rows = [];
  const problems = [];

  for (const file of files) {
    const raw = await readFile(new URL(file, `file://${RECIPES_DIR}`), "utf8");
    let recipe;
    try {
      recipe = JSON.parse(raw);
    } catch (err) {
      problems.push(`${file}: JSONとして読めません (${err.message})`);
      continue;
    }
    const expectedId = file.replace(/\.json$/, "");
    if (!recipe.id) recipe.id = expectedId;
    if (recipe.id !== expectedId) {
      problems.push(`${file}: id "${recipe.id}" とファイル名が一致しません`);
    }
    if (!recipe.title) problems.push(`${file}: title がありません`);
    rows.push(toIndexRow(recipe));
  }

  if (problems.length) {
    console.error("次の問題があります:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  rows.sort(byNewest);
  await writeFile(INDEX_FILE, JSON.stringify(rows, null, 2) + "\n", "utf8");
  console.log(`index.json を更新しました（${rows.length}件）`);
}

await main();
