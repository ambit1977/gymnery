# トレーニング室アプリ (Gymnery) 技術仕様書

このドキュメントは、本アプリの開発に携わる他のAIエージェントが、プロジェクトの全体像・アーキテクチャ・データベース構造・設計方針を即座に理解できるようにまとめたものです。

## 1. アプリケーション概要
「トレーニング室アプリ（Gymnery）」は、ジムでのトレーニング記録（種目、重量、回数、有酸素の時間/距離）、体組成、履歴を管理するための Web アプリケーション (PWA) です。
最大の特徴は、**オフラインファーストのローカルDB（IndexedDB）** を主軸としつつ、**Google Sheets をユーザーの個人クラウドデータベースとして活用** してデータを同期・バックアップする点です。

## 2. 技術スタック
* **フロントエンド**: HTML5, Vanilla JavaScript, Vanilla CSS (CSS Variables)
* **データベース (ローカル)**: IndexedDB (ラッパーとして `Dexie.js` v3 を使用)
* **データベース (クラウド/バックアップ)**: Google Sheets API (Google Identity Services 経由で OAuth2 認証) & Google Apps Script (GAS)
* **グラフ描画**: `Chart.js` v4
* **PWA**: Service Worker (`sw.js`) によるキャッシュ、Web Push API による通知
* **ホスティング**: GitHub Pages (フロントエンド) / Supabase Edge Functions または Node.js (Push通知用サーバー `push-server/`)

## 3. ファイルとディレクトリ構成
* `index.html`: アプリのエントリーポイント。SPA (Single Page Application) の骨組み。
* `style.css`: 全てのスタイリング。CSS変数を多用し、ダークテーマベースで構築。
* `app.js`: アプリケーションのメインロジック（UIの描画、ルーティング、タイマー処理、グラフ描画、イベントハンドリングなど）。非常に長大なファイル。
* `db.js`: Dexie.js を用いた IndexedDB のスキーマ定義および CRUD 操作関数群。
* `gsheets.js`: Google Identity Services を使った OAuth 認証、Google Sheets API への直接書き込み、および GAS を経由した自動同期ロジック。
* `sw.js`: PWA 用の Service Worker。静的アセットのキャッシュと Web Push 通知の受信処理。
* `config/`: 各ジム・施設のマシン設定ファイル（JSON）。例: `facility_asahicho.json`。UI側で動的にロードされる。
* `gas/`: Google Sheets 側に紐づく Google Apps Script のコード。
* `push-server/`: Push通知をブラウザに送信するためのバックエンドサーバー用コード。

## 4. データベース設計 (db.js / IndexedDB)
データベース名: `TrainingRoomApp`

### テーブル
1. **`sessions` (セッション = 1回のジム訪問)**
   * `id`: (PK, Auto-increment)
   * `startTime`: セッション開始日時 (ISO 8601 文字列)
   * `endTime`: セッション終了日時 (ISO 8601 文字列)
   * `note`: セッションに対するメモ

2. **`exercises` (種目 = セッション内での各マシンの記録)**
   * `id`: (PK, Auto-increment)
   * `sessionId`: 紐づくセッションのID
   * `machineId`: 実施したマシンのID（設定JSONとリンク）
   * `machineName`: マシンの名称
   * `category`: 部位（`cardio`, `upper`, `lower`, `core`, `arm` 等）
   * `type`: マシンのタイプ（`strength` = 筋トレ, `cardio` = 有酸素 等）
   * `data`: 記録データ。`strength` の場合は配列 `[{weight, reps}, ...]`。`cardio` の場合はオブジェクト `{distance, speed, cal, ...}`。
   * `createdAt`: 記録日時
   * `note`: メモ
   * `saveMode`: 成長判定（'ok' = 重量アップ等, 'stay' = 維持等）

3. **`body` (体組成記録)**
   * `id`: (PK, Auto-increment)
   * `date`: 測定日 (YYYY-MM-DD)
   * `weight`: 体重 (kg)
   * `fat`: 体脂肪率 (%)
   * `muscle`: 筋肉量 (kg)
   * `note`: メモ
   * `createdAt`: 記録日時

## 5. Google Sheets 同期アーキテクチャ (gsheets.js)
ユーザーは自身の Google アカウントでログインし、自分の Google Drive 内に専用のスプレッドシートを作成してデータを同期します。
* **手動同期**: `gsheets.js` 内の `syncDataToGSheets()` などにより、REST API を叩いてローカルのIndexedDBからSheetsにデータをエクスポート。
* **自動同期 (GAS連携)**: GAS アプリケーションの URL を登録することで、アプリ内でセッションや記録が更新された際に、GAS エンドポイントへ非同期 (fire-and-forget) で POST リクエストを送り、自動的に Sheets を更新します。

## 6. 特筆すべきロジック・仕様
1. **「中X日」の計算**: マシンごとに前回の実施日からの経過日数を計算し、「回復済み」かどうかのバッジを表示します。この計算には `exercise.createdAt` ではなく、紐づくセッションの `startTime` を使用します (`getExerciseDate` 関数)。
2. **タイマーとプッシュ通知**: セッション開始時に 60分のカウントダウンタイマーが開始されます。裏側でプッシュ通知サーバーに「55分後」と「60分後」の通知予約リクエスト (`pushSchedule`) を送信し、アプリを閉じていても Service Worker 経由で通知が届きます。
3. **キーボードによるレイアウト崩れ対策**: iOS Safari などでソフトウェアキーボードが出現した際、`position: fixed; bottom: 0;` のナビゲーションバーが浮き上がるバグを回避するため、リサイズイベントや focus/blur を検知し、キーボード表示中はナビゲーションバーを一時的に `display: none` にする処理が `app.js` の末尾に入っています。
4. **バージョン管理とキャッシュバスター**: `index.html` 内の `app.js?v74` のようにクエリパラメータを付与することでキャッシュを破棄させています。

## 7. 開発時の注意事項
* `app.js` は非常に長大なため、既存の関数名やロジックを変更する際は慎重に検索してください。
* UIを修正する際は Vanilla CSS を編集します。CSS Variables（`--bg-primary`, `--accent` 等）を活用してください。
* 新しいDOM操作を追加する際は、可能な限り `insertAdjacentHTML` などを使い、既存のイベントリスナーを破壊しないように注意してください。
