# じすいレシピ（レシピ共有サイト）

自分のレシピを蓄積し、知人に公開するためのシンプルな静的サイト。
**ビルド不要・フレームワーク不要・依存ライブラリ0**。表示はすべて JSON を fetch するだけ。

- 公開ルート: `/public`（GitHub Pages はこのディレクトリを公開する設定にする）
- データ: `public/data/recipes/<id>.json`（1レシピ1ファイル）＋ `public/data/index.json`（軽量インデックス）
- バックエンド・DBなし。データはすべて Git 上のテキストで、履歴も残る。

## ローカルで動かす

```bash
npx serve public
```

`http://localhost:3000` を開く。（`python3 -m http.server 4174 --directory public` でも可）

※ `file://` で直接開くと fetch が失敗します。必ず静的サーバー経由で開いてください。

## ディレクトリ構成

```
public/
  index.html          一覧・材料レコメンド
  recipe.html         詳細（?id=<id>）
  add.html            投稿フォーム（管理用）
  assets/app.css      共通スタイル
  assets/app.js       一覧＆レコメンド
  assets/recipe.js    詳細表示（プレビューにも使う）
  assets/add.js       フォーム→GitHubコミット
  data/index.json     全レシピの軽量インデックス
  data/recipes/*.json レシピ本体
  data/images/*.jpg   サムネイル
scripts/reindex.mjs          index.json 再生成（Node, 依存なし）
.github/workflows/site.yml   push時に index.json を再生成してから public/ を公開
```

## 公開の手順（GitHub Pages）

1. GitHub に **public** リポジトリを作り、このディレクトリを push する。
2. Settings → Pages → Build and deployment の Source を **GitHub Actions** にする。
3. `main` に push すると [`site.yml`](.github/workflows/site.yml) が
   `index.json` を再生成してから `public/` をそのまま配信する。
   数十秒後に `https://<owner>.github.io/<repo>/` で開ける。

> Pages の「Deploy from a branch」はフォルダに `/` か `/docs` しか選べず、`/public` を
> 指定できません。仕様どおり `public/` を公開ルートにするため、ビルドをしない
> アップロードだけの Actions ワークフローで配信しています。
> （`public/` を `docs/` にリネームすれば Actions なしの構成にもできます。その場合は
> `assets/add.js` の `REPO_PREFIX` と各ワークフローの `paths` も直してください。）

## レシピを追加する

### A. フォームから（スマホ可）

1. 公開サイトの `add.html` を開く。
2. 「GitHub 設定」を開いて入力し、保存する（初回のみ）。
   - オーナー / リポジトリ名 / ブランチ（GitHub Pages 上ならオーナーとリポジトリは自動で埋まる）
   - アクセストークン: **Fine-grained PAT**
     - Repository access: このリポジトリだけに限定
     - Repository permissions → **Contents: Read and write** のみ
     - 有効期限を設定する
3. フォームを入力し、「プレビュー」で確認 →「投稿する」。
4. 次の3ファイルが順にコミットされる。
   - `public/data/images/<id>.jpg`（画像を選んだときだけ）
   - `public/data/recipes/<id>.json`
   - `public/data/index.json`（更新）
5. GitHub Pages への反映まで数十秒。

**トークンの扱い**: トークンは投稿する本人のブラウザの `localStorage` にだけ保存されます。
リポジトリやコードには含まれません。共有PCでは使わないでください。不要になったら
「トークンを削除」ボタン、または GitHub 側で失効させてください。

投稿の途中で失敗した場合は、どこまで成功したかが進捗欄に表示され、
「失敗したところから再実行」で続きから再開できます（Contents API は複数ファイルを
1コミットにまとめられないため、3ファイルを逐次コミットしています）。

画像はコミット前にブラウザ内で縮小されます（長辺1024px / JPEG品質0.8 / 目標150KB以下）。
画像なしでも投稿でき、その場合は一覧に 🍳 のプレースホルダが出ます。

### B. 手でJSONを置く

`public/data/recipes/<id>.json` を追加して push すれば OK。
GitHub Actions（`site.yml`）が `index.json` を作り直してコミットし、
そのまま公開まで済ませるので、インデックスを手で直す必要はありません。

手元で作り直したいときは:

```bash
node scripts/reindex.mjs
```

`id` はファイル名と一致させてください（`2026-0004-xxx.json` なら `"id": "2026-0004-xxx"`）。
不一致や壊れたJSONがあると reindex は中断し、`index.json` は書き換えません。

## データ形式

`public/data/recipes/<id>.json`:

```jsonc
{
  "id": "2026-0001-gyudon",   // <年>-<4桁連番>-<スラッグ>
  "title": "簡単10分 牛丼",
  "thumb": "data/images/2026-0001-gyudon.jpg", // 無ければ null（public からの相対パス）
  "timeMinutes": 10,
  "servings": 1,
  "ingredients": [{ "name": "牛こま肉", "amount": "150g" }],
  "steps": ["玉ねぎを薄切りにする。"],
  "tags": ["丼", "時短"],
  "sourceUrl": null,          // note等の元記事URL。あれば詳細に「元記事を見る」が出る
  "createdAt": "2026-08-06",
  "notes": ""
}
```

`index.json` は上記から生成される要約（`id / title / thumb / timeMinutes / ing / tags / createdAt`）。
`ing` は正規化済みの材料名だけのユニーク配列です。

### 材料名の正規化

`normalizeIngredient()` を `assets/app.js` / `assets/add.js` / `scripts/reindex.mjs` の
3か所で同じロジックとして持っています（**変更するときは3つとも直すこと**）。

- `NFKC` 正規化（全角/半角の統一）
- 括弧書きを落とす: `玉ねぎ（中）` → `玉ねぎ`
- 空白の除去

分量は `amount` に分離しているので、`name` に量を書かない運用にしてください。

## 材料レコメンドの仕様

`index.html` 上部の材料チップを複数タップすると、その場で（通信なしで）絞り込まれます。

- **いずれか含む（OR・既定）**: 選んだ材料のどれかを使うレシピ。一致数が多い順 → 所要時間が短い順。
- **これだけで作れる（サブセット）**: レシピの材料がすべて「選んだ材料」に収まるもの。
  「基本調味料は自動で含む」を ON にすると、塩・醤油・砂糖・油・水・こしょう・味噌・酒・みりん
  （`assets/app.js` の `PANTRY`）を持っているものとして扱います。
- 未選択のときは新着順で全件。タイトルの部分一致検索も併用できます。
- 選択状態は `sessionStorage` に保存され、詳細ページから戻っても保持されます。

## 今後の拡張余地（今回は未実装）

- **PWA化**: `manifest.json` + Service Worker で `index.html` / CSS / JS / `index.json` を
  キャッシュすれば、2回目以降は即表示・オフラインでも一覧とレコメンドが動く。
- **note連携**: `assets/app.js` の `renderNoteFeed()` が空のフックとして置いてある。
  note の RSS（`https://note.com/<user>/rss`）を並べる想定。CORSで直接取得できない場合は
  GitHub Actions で定期取得して `data/note.json` にキャッシュする。
- **表記ゆれ辞書**: `data/aliases.json`（例 `{"たまねぎ":"玉ねぎ"}`）を正規化関数から参照する。
- **原子コミット**: Git Data API（blobs → tree → commit → update ref）で3ファイルを1コミットにまとめる。
- **トークンを持たない投稿**: GitHub Issue Forms + Actions で、Issue入力から JSON を生成してコミットする方式。
  UXは落ちるが、ブラウザに秘密情報を置かずに済む。

## 動作確認の手順

1. `npx serve public` を起動する。
2. `/index.html` … サンプルレシピがカードで一覧表示される（新着順）。
3. 材料チップ「玉ねぎ」をタップ → 牛丼と親子丼だけになり、`6材料中1つ一致` のバッジが出る。
4. さらに「牛こま肉」「ごはん」を選び、「これだけで作れる」に切り替える → 牛丼だけが残る
   （醤油・砂糖・酒は基本調味料として自動で含まれるため）。「基本調味料は自動で含む」を
   OFF にすると0件になる。
5. カードをクリック → `/recipe.html?id=<id>` … 材料表と手順が表示される。
   存在しないIDでは「見つかりませんでした。」。
6. `/add.html` … 空のまま「投稿する」で必須項目のエラーが出る。入力後「プレビュー」で
   詳細ページと同じ見た目が出る。
7. ブラウザ幅 375px で横スクロールが発生しない。
8. `node scripts/reindex.mjs` … `index.json` が再生成され、2回実行しても差分が出ない。
