# clasp (Google Apps Script CLI) の管理方法

このプロジェクトのGoogle Apps Script（GAS）コードは、`gas/` ディレクトリ配下に `clasp` を使って管理・デプロイできるようセットアップされています。

## ディレクトリ構成
- `gas/.clasp.json`: clasp の環境設定ファイル（スクリプトIDの紐付け）
- `gas/src/convert.js`: 先ほど作成した UTC ➡️ JST 一括変換用のスクリプト
- `gas/src/appsscript.json`: GASプロジェクトのマニフェスト（タイムゾーン等）

---

## 🚀 使い方

まだ `clasp` 自体が端末にインストールされていない場合は、下記コマンドでインストール・ログイン・設定を行ってください。

### 1. claspのグローバルインストールとログイン
```bash
# claspのインストール
npm install -g @google/clasp

# Googleアカウントへのログイン (ブラウザが開くので許可します)
clasp login
```
※事前にGoogleアカウント設定で [Google Apps Script API](https://script.google.com/home/usersettings) を **オン** にしておく必要があります。

---

### 2. 既存のスクリプトと紐付ける場合
すでにスプレッドシート側に紐づくコンテナバインドスクリプトのIDがある場合は、以下の手順で設定します。

1. スプレッドシート上の `拡張機能 > Apps Script` を開き、右側メニューの **「プロジェクトの設定」⚙️** をクリックします。
2. 表示される **「スクリプト ID」**（`1mC-...` のような文字列）をコピーします。
3. `gas/.clasp.json` を開き、`scriptId` の値をコピーしたIDに書き換えます。

---

### 3. コマンド操作

#### 📥 リモートからコードを取得する
```bash
cd gas
clasp pull
```

#### 📤 ローカルのコードをデプロイする
```bash
cd gas
clasp push
```

#### 🌐 ブラウザでスクリプトエディタを開く
```bash
cd gas
clasp open
```
