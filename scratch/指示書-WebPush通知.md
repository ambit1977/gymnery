# 指示書: インターバル終了のWeb Push通知（バックグラウンド・ロック画面対応）【VPS版】

## 背景と目的

前回実装分（Wake Lock + WAVビープ + 点滅）で**フォアグラウンド時**のアラートは完成した。
残る課題: アプリがバックグラウンドに回った／画面がロックされた場合、JSが凍結するためアラートが出せない。

iOSでバックグラウンドのWebアプリからユーザーに通知する唯一の手段は **Web Push**（iOS 16.4+、ホーム画面追加済みPWAのみ利用可。本アプリは `display: standalone` で条件を満たす）。
ロック画面・バナーにネイティブアプリ同等の通知（音・バイブ付き）が出る。

Web Pushに外部サービスのアカウントは不要。鍵は自己生成のVAPID鍵ペアで、購読時にブラウザが返す `subscription.endpoint`（Appleのpushサーバー）へ自サーバーから署名付きPOSTするだけ。プッシュサーバーは**自前のさくらVPS**に置く。

### 設計の核心: 「終了時に送る」のではなく「開始時に予約する」

バックグラウンドではJSが動かないので、タイマー終了の瞬間にクライアントから送信することは不可能。
**インターバル開始のタップ時にサーバーへ配信予約を入れ、サーバーが時刻になったらAPNs経由でpushを送る**。

```
[＋インターバル タップ]
  → fetch でVPSに「終了時刻+3秒後にpush配信」を予約
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
| プッシュサーバー | 本リポジトリ `push-server/`（ソース）→ VPSへデプロイ | Node.js + `web-push`。予約管理とpush送信 |

### デプロイ先VPSの前提（詳細は `/Users/ambit/Documents/遊び/サーバー操作のお試し/ONBOARDING.md`）

- さくらVPS / AlmaLinux 9.4、SSHは `ssh sakura-vps`（多段接続設定済み、ユーザー `alma`）
- Apache 2.4 稼働中、**`ambit.go2020.tokyo` のLet's Encrypt証明書が取得済み**（certbot自動更新あり）→ DNS追加・証明書取得は不要
- 開放ポートは 22/80/443 のみ → Node は直接公開せず **127.0.0.1 で待ち受け、Apacheのリバースプロキシでパスを切る**
- 公開URL: `https://ambit.go2020.tokyo/gymnery-push/`
- メモリ961MBの小さいサーバー。常駐はNodeプロセス1つに留める（PM2等は使わずsystemdで管理）

⚠️ **このVPSは本番運用に近い検証サーバーで、多数のドメイン・DBが稼働中**。作業は「ファイル追加 + 既存vhostへの数行追記」に限定し、既存設定の変更・パッケージのメジャー更新はしないこと。vhost編集前にバックアップを取り、`apachectl configtest` が通ってから `systemctl reload httpd` すること。

## サーバー実装仕様（push-server/）

### アプリ本体

- Node.js + Express + 定番の [`web-push`](https://github.com/web-push-libs/web-push) ライブラリ（Node環境なのでそのまま使える）
- 依存は最小限（express, web-push のみ。可能なら express も省いて素の `http` でよい）
- `127.0.0.1:3300` で listen（外部公開はApache経由のみ）
- 予約は**メモリ上の `setTimeout`** で管理: 予約=タイマーセット、上書き予約=既存を `clearTimeout` して張り直し、キャンセル=`clearTimeout`。60秒程度の予約なのでプロセス再起動時の予約消失は許容（購読情報は下記のとおり永続化）
- 購読情報は JSONファイルに永続化（例 `/var/lib/gymnery-push/subscriptions.json`）。起動時に読み込み
- 設定は環境変数から: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`（`mailto:ambit.akiyama@gmail.com`）, `AUTH_TOKEN`, `PORT`

### APIエンドポイント

全エンドポイント共通:

- ヘッダ `Authorization: Bearer <AUTH_TOKEN>` を検証（不一致は401）。AUTH_TOKENはランダム文字列。クライアントに埋め込むため公開ソース上では見えるが、個人アプリの悪戯防止バーとして許容する
- CORS: `Access-Control-Allow-Origin: https://ambit1977.github.io`、`OPTIONS` プリフライト対応、`Authorization`/`Content-Type` ヘッダ許可
- Apacheが `/gymnery-push/` を剥がしてプロキシするため、Node側のルートは `/subscribe` 等のプレフィックスなしで実装

| Method/Path | Body | 動作 |
|---|---|---|
| `POST /subscribe` | `{ subscription }` (PushSubscription JSON) | 購読を保存。endpointをキーに重複排除 |
| `POST /schedule` | `{ fireAt }` (epoch ms) | 配信予約。既存予約があれば上書き（延長もこれで実現） |
| `POST /cancel` | なし | 予約取消 |
| `GET /health` | なし | 200を返すだけ（疎通確認用、認証不要でよい） |

- 発火時: 保存済みの**全購読**へ送信。ペイロード例 `{ title: 'インターバル終了 ⏱', body: 'セットを再開しましょう' }`
- 送信結果が **404/410 の購読は失効しているので削除**してファイルに反映

### VPSへの配置・常駐化

1. **Node.jsインストール**（AlmaLinux 9のAppStreamモジュール。既存PHP/MariaDBに影響しない）:
   ```sh
   ssh sakura-vps "sudo dnf module install -y nodejs:22"
   ```
2. **VAPID鍵生成**（ローカルで一度だけ）: `npx web-push generate-vapid-keys`
3. **配置**: `rsync` で `push-server/` を `sakura-vps:/opt/gymnery-push/` へ（`node_modules` は除外し、サーバー上で `npm ci --omit=dev`）
4. **環境変数ファイル** `/etc/gymnery-push.env`（**root所有 / chmod 600**。リポジトリにはサンプルの `gymnery-push.env.example` のみ入れ、実値は絶対にコミットしない）:
   ```
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:ambit.akiyama@gmail.com
   AUTH_TOKEN=...
   PORT=3300
   ```
5. **systemdユニット** `/etc/systemd/system/gymnery-push.service`:
   ```ini
   [Unit]
   Description=Gymnery interval push server
   After=network.target

   [Service]
   ExecStart=/usr/bin/node /opt/gymnery-push/server.js
   EnvironmentFile=/etc/gymnery-push.env
   User=alma
   Restart=always
   RestartSec=5
   StateDirectory=gymnery-push

   [Install]
   WantedBy=multi-user.target
   ```
   `sudo systemctl daemon-reload && sudo systemctl enable --now gymnery-push`
   ※ `StateDirectory` により `/var/lib/gymnery-push/` が自動作成される
6. **Apacheリバースプロキシ**: `ambit.go2020.tokyo` のSSL vhost（`/etc/httpd/conf.d/httpd-vhosts-le-ssl.conf` 内。編集前に `sudo cp` でバックアップ）に追記:
   ```apache
   ProxyPass        /gymnery-push/ http://127.0.0.1:3300/
   ProxyPassReverse /gymnery-push/ http://127.0.0.1:3300/
   ```
   反映: `sudo apachectl configtest && sudo systemctl reload httpd`
7. **SELinux**（AlmaLinuxはenforcingの可能性が高い。RHEL系の定番ハマりポイント）: Apache→localhostのプロキシを許可する
   ```sh
   getenforce   # Enforcing なら以下が必要
   sudo setsebool -P httpd_can_network_connect 1
   ```
8. **疎通確認**:
   ```sh
   curl https://ambit.go2020.tokyo/gymnery-push/health
   ```

## クライアント仕様

`app.js` に定数を追加: `PUSH_SERVER_URL = 'https://ambit.go2020.tokyo/gymnery-push'` と `PUSH_AUTH_TOKEN`、`VAPID_PUBLIC_KEY`（公開鍵は埋め込みでよい）。

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

- **開始時** (`startIntervalTimer`): 通知有効なら `POST /schedule { fireAt: intervalTimerEndTime + 3000 }`
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

実機iPhone（ホーム画面追加済みPWA）+ VPSデプロイ済みで:

1. `curl https://ambit.go2020.tokyo/gymnery-push/health` が200を返し、`sudo systemctl status gymnery-push` がactive
2. 設定画面から通知を有効化できる（iOS標準の許可ダイアログが出る）
3. インターバル開始 → **即座にアプリを閉じて画面ロック** → 約63秒後にロック画面へ通知が届く
4. 「＋1分」後に同様の操作 → 約123秒後に通知が届く（60秒時点では来ない）
5. フォアグラウンドのままタイムアップ → ビープのみで**通知は来ない**（キャンセルが効いている）
6. タイマー中に記録を保存して閉じた場合 → 通知は来ない
7. 通知タップでアプリが開く／フォアグラウンドに戻る
8. 通知未許可・オフライン時でも既存機能（ビープ・Wake Lock含む）が一切劣化しない
9. リポジトリにVAPID秘密鍵・AUTH_TOKENの実値がコミットされていない（実値は `/etc/gymnery-push.env` のみ）
10. VPSの既存サービス（Apache配下の他ドメイン、MariaDB）に影響がない（vhostへの追記はProxyPassの2行のみ）
11. VPS再起動後もpushサーバーが自動起動する（`systemctl enable` 済み）

## 動作確認のヒント

- 送信部分の単体確認は、`/schedule` を `fireAt: Date.now()+10000` で直接curlして10秒後に実機へ通知が来るかを見るのが早い:
  ```sh
  curl -X POST https://ambit.go2020.tokyo/gymnery-push/schedule \
    -H "Authorization: Bearer $AUTH_TOKEN" -H "Content-Type: application/json" \
    -d "{\"fireAt\": $(( $(date +%s%3N) + 10000 ))}"
  ```
- サーバーログ: `ssh sakura-vps "sudo journalctl -u gymnery-push -f"`
- 通知が来ない場合の切り分け順: ①healthが通るか → ②journalctlでpush送信ログ/エラー（403はVAPID鍵不一致、404/410は購読失効）→ ③iOS側の通知設定 → ④SELinux（`sudo ausearch -m avc -ts recent`）
- iOSの購読が失効した場合はアプリの再購読フローで復帰できることを確認

## スコープ外

- 前回実装分（Wake Lock・ビープ）の変更。共存させること
- マルチユーザー対応・認証の本格化
- Googleスプレッドシート同期まわり（`gsheets.js`）には触れない
- VPS上の既存サービス・設定の変更（ProxyPass追記を除く）
