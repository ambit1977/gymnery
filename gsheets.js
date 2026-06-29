// ========================================
// gsheets.js - Google Sheets 連携
// ========================================

// 取得したクライアントIDをここにハードコーディングします。
// 空文字列のままであれば、設定画面の手動入力値（localStorage）が使用されます。
const GSHEETS_CLIENT_ID = '331967203622-vkssp85s9g6h3bvdq908p7v1k19p01m6.apps.googleusercontent.com'; // 例としてGen-Langプロジェクト用の形式、後ほど書き換えて使用

const GSHEETS_SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let gsheetsAccessToken = null;
let gsheetsTokenExpiry = 0;

// ========================================
// 認証
// ========================================

function gsheetsIsAuthorized() {
  return gsheetsAccessToken && Date.now() < gsheetsTokenExpiry;
}

function gsheetsGetClientId() {
  return GSHEETS_CLIENT_ID || localStorage.getItem('gs_client_id') || '';
}

function gsheetsSignIn() {
  return new Promise((resolve, reject) => {
    const clientId = gsheetsGetClientId();
    if (!clientId) {
      reject(new Error('Client IDが設定されていません。コードに記述するか設定画面で入力してください。'));
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Servicesが読み込まれていません。'));
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GSHEETS_SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        gsheetsAccessToken = response.access_token;
        gsheetsTokenExpiry = Date.now() + (response.expires_in - 60) * 1000;
        localStorage.setItem('gs_authed', '1');
        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken();
  });
}

function gsheetsSignOut() {
  if (gsheetsAccessToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(gsheetsAccessToken);
  }
  gsheetsAccessToken = null;
  gsheetsTokenExpiry = 0;
  localStorage.removeItem('gs_authed');
  showToast('Googleアカウントとの連携を解除しました', 'success');
  renderSettings(document.getElementById('main-content'));
}

async function gsheetsEnsureToken() {
  if (!gsheetsIsAuthorized()) {
    await gsheetsSignIn();
  }
  return gsheetsAccessToken;
}

// ========================================
// Sheets API ユーティリティ
// ========================================

async function sheetsRequest(method, endpoint, body = null) {
  const token = await gsheetsEnsureToken();
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${endpoint}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets API error ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ========================================
// スプレッドシートのセットアップ
// ========================================

async function gsheetEnsureSheets(spreadsheetId) {
  const meta = await sheetsRequest('GET', `/${spreadsheetId}?fields=sheets.properties.title`);
  const existingTitles = meta.sheets.map(s => s.properties.title);
  const required = ['sessions', 'exercises', 'bodyComposition'];
  const toAdd = required.filter(t => !existingTitles.includes(t));

  if (toAdd.length > 0) {
    await sheetsRequest('POST', `/${spreadsheetId}:batchUpdate`, {
      requests: toAdd.map(title => ({
        addSheet: { properties: { title } },
      })),
    });
  }

  // ヘッダ行がなければ書き込む
  const headers = {
    sessions: ['id', 'facility', 'startTime', 'endTime', 'note'],
    exercises: ['id', 'sessionId', 'machineId', 'machineName', 'category', 'type', 'data', 'saveMode', 'note', 'createdAt'],
    bodyComposition: ['id', 'date', 'weight', 'bodyFat', 'muscleMass', 'bmi', 'visceralFat', 'note'],
  };

  for (const title of required) {
    const check = await sheetsRequest('GET',
      `/${spreadsheetId}/values/${encodeURIComponent(title + '!A1')}?majorDimension=ROWS`
    );
    if (!check.values || check.values.length === 0) {
      await sheetsRequest('PUT',
        `/${spreadsheetId}/values/${encodeURIComponent(title + '!A1')}?valueInputOption=RAW`,
        { values: [headers[title]] }
      );
    }
  }
}

// ========================================
// 差分同期ロジック
// ========================================

async function gsheetGetExistingIds(spreadsheetId, sheetName) {
  try {
    const res = await sheetsRequest('GET',
      `/${spreadsheetId}/values/${encodeURIComponent(sheetName + '!A2:A')}?majorDimension=COLUMNS`
    );
    return new Set((res.values?.[0] || []).map(String));
  } catch {
    return new Set();
  }
}

async function gsheetSyncSessions(spreadsheetId) {
  const sessions = await getAllSessions();
  const existing = await gsheetGetExistingIds(spreadsheetId, 'sessions');
  const newRows = sessions
    .filter(s => !existing.has(String(s.id)))
    .map(s => [s.id, s.facility || '', s.startTime || '', s.endTime || '', s.note || '']);

  if (newRows.length === 0) return 0;
  await sheetsRequest('POST',
    `/${spreadsheetId}/values/${encodeURIComponent('sessions!A2')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: newRows }
  );
  return newRows.length;
}

async function gsheetSyncExercises(spreadsheetId) {
  const all = await db.exercises.toArray();
  const existing = await gsheetGetExistingIds(spreadsheetId, 'exercises');
  const newRows = all
    .filter(e => !existing.has(String(e.id)))
    .map(e => [
      e.id, e.sessionId, e.machineId,
      e.machineName || '', e.category || '', e.type || '',
      JSON.stringify(e.data),
      e.saveMode || '', e.note || '', e.createdAt || '',
    ]);

  if (newRows.length === 0) return 0;
  await sheetsRequest('POST',
    `/${spreadsheetId}/values/${encodeURIComponent('exercises!A2')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: newRows }
  );
  return newRows.length;
}

async function gsheetSyncBody(spreadsheetId) {
  const all = await db.bodyComposition.toArray();
  const existing = await gsheetGetExistingIds(spreadsheetId, 'bodyComposition');
  const newRows = all
    .filter(r => !existing.has(String(r.id)))
    .map(r => [r.id, r.date || '', r.weight || '', r.bodyFat || '',
                r.muscleMass || '', r.bmi || '', r.visceralFat || '', r.note || '']);

  if (newRows.length === 0) return 0;
  await sheetsRequest('POST',
    `/${spreadsheetId}/values/${encodeURIComponent('bodyComposition!A2')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: newRows }
  );
  return newRows.length;
}

async function gsheetsSyncAll() {
  const spreadsheetId = localStorage.getItem('gs_spreadsheet_id');
  if (!spreadsheetId) throw new Error('スプレッドシートIDが設定されていません。');

  await gsheetEnsureSheets(spreadsheetId);
  const [s, e, b] = await Promise.all([
    gsheetSyncSessions(spreadsheetId),
    gsheetSyncExercises(spreadsheetId),
    gsheetSyncBody(spreadsheetId),
  ]);
  return { sessions: s, exercises: e, body: b };
}

// ========================================
// 設定画面UI
// ========================================

function gsheetsSettingsHtml() {
  const isHardCoded = !!GSHEETS_CLIENT_ID;
  const clientId = gsheetsGetClientId();
  const spreadsheetId = localStorage.getItem('gs_spreadsheet_id') || '';
  const authed = localStorage.getItem('gs_authed') === '1';
  const autoSync = localStorage.getItem('gs_auto_sync') === '1';

  // クライアントIDがハードコードされている場合の入力フィールドの表示制御
  const clientInputHtml = isHardCoded
    ? `<input type="hidden" id="gs-client-id" value="${clientId}">`
    : `<div class="input-group mb-sm">
        <label class="input-label">クライアントID</label>
        <input type="text" class="input text-xs" id="gs-client-id" value="${clientId}"
          placeholder="xxxx.apps.googleusercontent.com"
          onchange="localStorage.setItem('gs_client_id', this.value)">
      </div>`;

  const descriptionHtml = isHardCoded
    ? `トレーニングデータをスプレッドシートにバックアップします。`
    : `トレーニングデータをスプレッドシートにバックアップします。<br>
       <a href="https://console.cloud.google.com/" target="_blank"
          style="color:var(--accent)">Google Cloud Console</a> でOAuth2クライアントIDを取得し、
       承認済みオリジンに <code style="font-size:0.65rem">https://ambit1977.github.io</code> を追加してください。`;

  return `
    <div class="card mb-md">
      <div class="text-sm font-bold mb-sm">📊 Google Sheets 連携</div>
      <p class="text-xs text-muted mb-md">${descriptionHtml}</p>

      ${clientInputHtml}

      <div class="input-group mb-md">
        <label class="input-label">スプレッドシートID</label>
        <input type="text" class="input text-xs" id="gs-sheet-id" value="${spreadsheetId}"
          placeholder="URLの /d/ と /edit の間の文字列"
          onchange="localStorage.setItem('gs_spreadsheet_id', this.value)">
      </div>

      <div class="flex items-center justify-between mb-md">
        <span class="text-xs">トレーニング終了時に自動同期</span>
        <label style="position:relative;display:inline-block;width:44px;height:24px;">
          <input type="checkbox" id="gs-auto-sync" ${autoSync ? 'checked' : ''}
            onchange="localStorage.setItem('gs_auto_sync', this.checked ? '1' : '0')"
            style="opacity:0;width:0;height:0;">
          <span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
            background:${autoSync ? 'var(--accent)' : 'var(--bg-elevated)'};
            border-radius:12px;transition:.3s;border:1px solid var(--border-color);">
            <span style="position:absolute;height:18px;width:18px;left:${autoSync ? '22px' : '2px'};
              bottom:2px;background:#fff;border-radius:50%;transition:.3s;"></span>
          </span>
        </label>
      </div>

      <div class="flex gap-sm">
        ${authed
          ? `<button class="btn btn-secondary btn-sm" onclick="gsheetsSignOut()" style="flex:1">ログアウト</button>`
          : `<button class="btn btn-primary btn-sm" onclick="gsheetsSignInAndUpdate()" style="flex:1">Googleでログイン</button>`
        }
        <button class="btn btn-secondary btn-sm" onclick="gsheetsSyncAllUI()" style="flex:1"
          ${!authed ? 'disabled style="flex:1;opacity:0.4"' : 'style="flex:1"'}>今すぐ同期</button>
      </div>

      ${authed ? `<p class="text-xs text-muted mt-sm" style="text-align:center">✅ Google アカウント連携済み</p>` : ''}
    </div>
  `;
}

async function gsheetsSignInAndUpdate() {
  // 入力欄の値を先に保存
  const clientIdEl = document.getElementById('gs-client-id');
  const sheetIdEl = document.getElementById('gs-sheet-id');
  if (clientIdEl?.value) localStorage.setItem('gs_client_id', clientIdEl.value);
  if (sheetIdEl?.value) localStorage.setItem('gs_spreadsheet_id', sheetIdEl.value);

  try {
    await gsheetsSignIn();
    showToast('Googleアカウントと連携しました ✅', 'success');
    renderSettings(document.getElementById('main-content'));
  } catch (e) {
    showToast(`認証エラー: ${e.message}`, 'danger');
  }
}

async function gsheetsSyncAllUI() {
  const sheetIdEl = document.getElementById('gs-sheet-id');
  if (sheetIdEl?.value) localStorage.setItem('gs_spreadsheet_id', sheetIdEl.value);

  showToast('同期中...⏳', '');
  try {
    const result = await gsheetsSyncAll();
    showToast(
      `同期完了 ✅  セッション+${result.sessions} / 記録+${result.exercises} / 体組成+${result.body}`,
      'success'
    );
  } catch (e) {
    console.error(e);
    showToast(`同期エラー: ${e.message}`, 'danger');
  }
}

// セッション終了後に呼ばれる（app.js の endTraining から）
async function gsheetsMaybeAutoSync() {
  if (localStorage.getItem('gs_auto_sync') !== '1') return;
  if (!localStorage.getItem('gs_spreadsheet_id')) return;
  if (!localStorage.getItem('gs_client_id')) return;
  try {
    await gsheetsSyncAll();
    showToast('Google Sheetsに同期しました ☁️', 'success');
  } catch (e) {
    console.warn('Auto sync failed:', e.message);
  }
}
