# じすいレシピ（レシピ共有サイト）

自分のレシピを蓄積し、知人に公開するためのシンプルな静的サイト。
**ビルド不要・フレームワーク不要**。表示はすべて JSON を fetch するだけ。

- 公開ルート: `/public`（GitHub Pages はこのディレクトリを公開する設定にする）
- データ: `public/data/recipes/<id>.json`（1レシピ1ファイル）＋ `public/data/index.json`（軽量インデックス）

## ローカルで動かす

```bash
npx serve public
```

`http://localhost:3000` を開く。（`python3 -m http.server 4174 --directory public` でも可）

※ `file://` 直開きは fetch が CORS で失敗するため不可。必ず静的サーバー経由で開くこと。

## ディレクトリ構成

```
public/
  index.html          一覧・材料レコメンド
  recipe.html         詳細（?id=<id>）
  add.html            投稿フォーム（管理用）
  assets/app.css      共通スタイル
  assets/app.js       一覧＆レコメンド
  assets/recipe.js    詳細表示
  assets/add.js       フォーム→GitHubコミット
  data/index.json     全レシピの軽量インデックス
  data/recipes/*.json レシピ本体
  data/images/*.jpg   サムネイル
scripts/reindex.mjs             index.json 再生成
.github/workflows/reindex.yml   同上を自動実行
```

## 確認手順

1. `npx serve public` を起動する。
2. `/index.html` … サンプルレシピがカードで一覧表示される（新着順）。
3. カードをクリック → `/recipe.html?id=<id>` … 材料表と手順が表示される。
4. `/recipe.html?id=zzz`（存在しないID）… 「見つかりませんでした。」と表示される。
5. ブラウザ幅 375px でも横スクロールが発生しない。
