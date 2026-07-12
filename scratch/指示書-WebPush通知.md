# 指示書: インターバル終了のWeb Push通知（バックグラウンド・ロック画面対応）

## 背景と目的

前回実装分（Wake Lock + WAVビープ + 点滅）で**フォアグラウンド時**のアラートは完成した。
残る課題: アプリがバックグラウンドに回った／画面がロックされた場合、JSが凍結するためアラートが出せない。

iOSでバックグラウンドのWebアプリからユーザーに通知する唯一の手段は **Web Push**（iOS 16.4+、ホーム画面追加済みPWAのみ利用可。本アプリは `display: standalone` で条件を満たす）。
ロック画面・バナーにネイティブアプリ同等の通知（音・バイブ付き）が出る。

### 設計の核心: 「終了時に送る」のではなく「開始時に予約する」

バックグラウンドではJSが動かないので、タイマー終了の瞬間にクライアントから送信することは不可能。
**インターバル開始のタップ時にサーバーへ配信予約を入れ、サーバーが時刻になったらAPNs経由でpushを送る**。

```
[＋インターバル タップ]
  → fetch でWorkerに「終了時刻+3秒後にpush配信」を予約
  → アプリがバックグラウンド/ロックされてもサーバーが時限発火
  → ロック画面に通知

[フォアグラウンドのままタイマー終了]
  → 既存のビープが鳴る → 即座に予約をキャンセル(fetch)
  → 通知は来ない（+3秒バッファはこのキャンセル猶予のため）

[＋1分 延長] → 予約時刻を上書き
[タイマー破棄（保存・画面クローズ等の既存クリーンアップ経路）] → 予約キャンセル
```

## 全体構成

| コンポーネント | 場所 | 内容 |
|---|---|---|
| クライアント | `app.js`, `sw.js`（既存） | 通知許可・購読、予約/キャンセルfetch、pushイベントで通知表示 |
| プッシュサーバー | `push-server/`（本リポジトリに新規サブフォルダ） | Cloudflare Worker + Durable Object。予約管理とpush送信 |

- 本アプリはGitHub Pages（`https://ambit1977.github.io`）ホストの静的サイトなので、サーバーはCloudflare Workers**無料プラン**に置く
- Durable Objects は無料プランで利用可能（**SQLiteバックエンド必須**、alarm対応）。「N秒後に1回だけ実行」はDOの `storage.setAlarm()` を使う
- Web Push送信ライブラリ: [`@block65/webcrypto-web-push`](https://github.com/block65/webcrypto-web-push)（Node専用の `web-push` はWorkersで動かない。このライブラリはWorkers公式サンプルあり）
- 利用者は開発者本人1人。マルチユーザー対応は不要（ただし購読は複数端末ぶん保持できる素直な作りにしておく）

## サーバー仕様（push-server/）

### セットアップ

- `npm create cloudflare@latest`（TypeScript, Hello Worldテンプレート）で `push-server/` を作成
- `wrangler.jsonc`: DOバインディング + `new_sqlite_classes` のmigration を定義
- VAPID鍵はローカルで一度だけ生成: `npx web-push generate-vapid-keys`
- シークレット（`wrangler secret put`）: `VAPID_PRIVATE_KEY`, `AUTH_TOKEN`（下記）。`VAPID_PUBLIC_KEY` と `VAPID_SUBJECT`（`mailto:ambit.akiyama@gmail.com`）は `vars` でよい
- **秘密鍵・トークンをリポジトリにコミットしないこと**（このリポジトリはpublic。`wrangler secret` のみで管理）

### APIエンドポイント（Worker）

全エンドポイント共通:

- ヘッダ `Authorization: Bearer <AUTH_TOKEN>` を検証（不一致は401）。AUTH_TOKENはランダム文字列。クライアントに埋め込むため公開ソース上では見えるが、個人アプリの悪戯防止バーとして許容する
- CORS: `Access-Control-Allow-Origin: https://ambit1977.github.io`、`OPTIONS` プリフライト対応、`Authorization`/`Content-Type` ヘッダ許可

| Method/Path | Body | 動作 |
|---|---|---|
| `POST /subscribe` | `{ subscription }` (PushSubscription JSON) | 購読を保存。endpointをキーに重複排除 |
| `POST /schedule` | `{ subscription, fireAt }` (epoch ms) | 配信予約。既存予約があれば上書き（延長もこれで実現） |
| `POST /cancel` | `{ subscription }` | 予約取消 |

### Durable Object

- 1ユーザーアプリなので固定名（例 `idFromName('default-user')`）の単一インスタンスでよい
- `storage` に購読リストと予約時刻を保存し、`storage.setAlarm(fireAt)` をセット。上書き予約は `setAlarm` を張り直すだけ（DOのalarmは1つなので自然に上書きされる）
- `alarm()` ハンドラ: 保存済みの全購読へpush送信 → 予約情報をクリア
  - ペイロード例: `{ title: 'インターバル終了 ⏱', body: 'セットを再開しましょう' }`
  - 送信結果が **404/410 の購読は失効しているので削除**する
- キャンセル: `storage.deleteAlarm()` + 予約情報クリア

## クライアント仕様

### 1. 通知の有効化（設定画面）

- 設定画面に「バックグラウンド通知」の有効化ボタン（またはトグル）を追加
- タップ（ユーザージェスチャ）で:
  1. `Notification.requestPermission()`
  2. `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })`
  3. `POST /subscribe`
- **iOSは通知許可リクエストがユーザージェスチャ内でないと失敗する**。ページロード時の自動リクエストは禁止
- ホーム画面追加していないSafariタブでは `pushManager` が存在しない。存在チェックし、未対応時は「ホーム画面に追加すると通知が使えます」の案内を表示
- 許可拒否・購読失敗時もアプリ本体の動作に影響させない（通知機能だけ無効化）

### 2. タイマー連携（app.js の既存インターバルタイマーに追加）

前回実装（Wake Lock・ビープ・クリーンアップ）のライフサイクルフックと同じ箇所に足す:

- **開始時** (`startIntervalTimer`): 購読済みなら `POST /schedule { fireAt: intervalTimerEndTime + 3000 }`
- **＋1分延長時** (`addOneMinuteToInterval`): 同じく `/schedule` を新しい `fireAt` で再送（上書き）
- **フォアグラウンドでタイムアップした瞬間**（ビープを鳴らす既存箇所）: `POST /cancel`
- **タイマー破棄の全経路**（保存・クローズ等、前回実装で洗い出したクリーンアップ箇所）: `POST /cancel`
- fetchはすべて fire-and-forget（await不要、失敗はconsoleに出すのみ）。ジム内の電波不安定でUIをブロックしないこと

### 3. sw.js への追加

```js
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'インターバル終了 ⏱', {
      body: data.body || '',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    if (list.length) return list[0].focus();
    return clients.openWindow('./index.html');
  }));
});
```

- **重要（iOS仕様）**: pushを受けたら**必ず** `showNotification` を呼ぶこと。通知を表示しないpushを数回続けるとiOSが購読を無効化する
- `CACHE_NAME` のバージョンを+1（このリポジトリの慣習）

### 4. 購読の維持

- アプリ起動時、通知が有効化済みなら `pushManager.getSubscription()` で購読を確認し、失われていれば静かに再購読 + `/subscribe`（許可済みなら再購読にジェスチャは不要）
- `pushsubscriptionchange` イベントで再購読 + `/subscribe`

## iOS固有の注意（実装者向けメモ）

- 対応はiOS 16.4+、**ホーム画面追加済みのWebアプリのみ**。Safariタブでは不可
- 通知の音・バイブはOS設定に従う（設定 > 通知 にこのWebアプリが並ぶ）。マナーモード時は音なしバイブあり＝ジム利用では十分
- 通知オプションは最小限（title/body）に留める。actions等はiOS未対応
- ロック画面表示・Apple Watch連携はネイティブ同等に機能する

## 受け入れ条件

実機iPhone（ホーム画面追加済みPWA）+ デプロイ済みWorkerで:

1. 設定画面から通知を有効化できる（iOS標準の許可ダイアログが出る）
2. インターバル開始 → **即座にアプリを閉じて画面ロック** → 約63秒後にロック画面へ通知が届く
3. 「＋1分」後に同様の操作 → 約123秒後に通知が届く（60秒時点では来ない）
4. フォアグラウンドのままタイムアップ → ビープのみで**通知は来ない**（キャンセルが効いている）
5. タイマー中に記録を保存して閉じた場合 → 通知は来ない
6. 通知タップでアプリが開く／フォアグラウンドに戻る
7. 通知未許可・オフライン時でも既存機能（ビープ・Wake Lock含む）が一切劣化しない
8. リポジトリに秘密鍵・AUTH_TOKENの実値がコミットされていない

## 動作確認のヒント

- Workerはまず `wrangler dev` ではなく**デプロイして実機で**確認する（APNsへの送信・PWA購読はlocalhostでは再現しにくい）
- 送信部分の単体確認は、`/schedule` を `fireAt: Date.now()+10000` で直接curlして10秒後に通知が来るかを見るのが早い
- iOSの購読が失効した場合（404/410）はアプリの再購読フローで復帰できることを確認

## スコープ外

- 前回実装分（Wake Lock・ビープ）の変更。共存させること
- マルチユーザー対応・認証の本格化
- Googleスプレッドシート同期まわり（`gsheets.js`）には触れない
