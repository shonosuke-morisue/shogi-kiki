# 利き将棋

ブラウザで遊べる将棋です。盤上の各マスに、先手(青)・後手(赤)の駒が何枚利いているかを色の濃さ(グラデーション)で表示します。

- **AIと対戦**: やさしい / ふつう / つよい の3段階
- **オンライン対戦**: 部屋を作って招待リンクを送るだけで、離れた相手と対局できます (Firebase Realtime Database を使用)
- **ふたりで対局**: 1台の端末で交互に指します
- 利きの表示は「両方 / 先手 / 後手 / なし」を切り替えられ、利きの数を数字でも表示できます
- ルール: 合法手のみ指せます (二歩・打ち歩詰め・行き所のない駒の禁止、成りの選択、詰み判定、千日手・連続王手の千日手)

## 開発

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # ルールのテスト
npm run build
```

## オンライン対戦の設定

サーバーを自分で立てる代わりに Firebase (無料の Spark プランで十分) を使います。

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作成します。
2. **Authentication** を開き、ログイン方法で **匿名** を有効にします。
3. **Realtime Database** を作成し、「ルール」タブに [`database.rules.json`](database.rules.json) の内容を貼り付けて公開します。
4. **プロジェクトの設定 > マイアプリ** でウェブアプリを追加し、表示された設定値を `.env.example` をコピーした `.env.local` に書き込みます。`.env.local` は Git に含まれません。

### GitHub Pages で公開する場合

1. リポジトリの **Settings > Pages** で Source を **GitHub Actions** にします。
2. **Settings > Secrets and variables > Actions** に `.env.example` と同じ名前で Firebase の設定値を登録します。
3. `main` に push すると `.github/workflows/deploy.yml` が `https://<ユーザー名>.github.io/<リポジトリ名>/` に公開します。
4. Firebase コンソールの **Authentication > 設定 > 承認済みドメイン** に `<ユーザー名>.github.io` を追加します。

### Firebase Emulator で試す

```sh
npx firebase-tools emulators:start --only auth,database --project demo-shogi
```

`.env.local` に `VITE_FIREBASE_EMULATOR=1` と、適当な値 (`VITE_FIREBASE_API_KEY=fake`、`VITE_FIREBASE_DATABASE_URL=https://demo-shogi-default-rtdb.firebaseio.com` など) を入れると、エミュレーターに接続します。

## 構成

| パス | 内容 |
| --- | --- |
| `src/shogi/rules.ts` | 盤面・合法手生成・利きの計算・USI 形式の変換 |
| `src/shogi/game.ts` | 対局の進行 (棋譜・詰み・千日手の判定) |
| `src/shogi/ai.ts` | AI (アルファベータ探索 + 駒得の評価)。Web Worker で動かします |
| `src/components/` | 盤面・持ち駒・利きの表示 |
| `src/online/firebase.ts` | オンライン対戦の部屋・指し手の同期 |
