// ========================================
// gsheets.js - Google Sheets 連携
// ========================================

// 取得したクライアントIDをここにハードコーディングします。
// 空文字列のままであれば、設定画面の手動入力値（localStorage）が使用されます。
const GSHEETS_CLIENT_ID = '826506708716-5lccjontlbg22p1218lg2f9die78lfap.apps.googleusercontent.com';

const GSHEETS_SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

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
      reject(new Error('Client IDが設定されていません。'));
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

async function driveRequest(method, url, body = null) {
  const token = await gsheetsEnsureToken();
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Drive API error ${res.status}`);
  }
  return res.json();
}

// ユーザーのマイドライブから既存のアプリ専用スプレッドシートを検索し、無ければ新規作成する
async function gsheetsFindOrCreateSpreadsheet() {
  const filename = 'Gymny_Training_Log';
  showToast('Google ドライブ内を検索中...🔍', '');
  
  // 1. 既存のファイルがないか名前で検索
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    `name='${filename}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  )}&fields=files(id,name)`;
  
  const searchResult = await driveRequest('GET', searchUrl);
  
  if (searchResult.files && searchResult.files.length > 0) {
    const sheetId = searchResult.files[0].id;
    localStorage.setItem('gs_spreadsheet_id', sheetId);
    showToast('既存のスプレッドシートと連携しました 🔗', 'success');
    return sheetId;
  }
  
  // 2. なければ新規スプレッドシートを作成
  showToast('新規スプレッドシートを作成中...📄', '');
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const createBody = {
    name: filename,
    mimeType: 'application/vnd.google-apps.spreadsheet',
  };
  
  const createdFile = await driveRequest('POST', createUrl, createBody);
  const newSheetId = createdFile.id;
  localStorage.setItem('gs_spreadsheet_id', newSheetId);
  showToast('スプレッドシートを新規作成し連携しました ✨', 'success');
  return newSheetId;
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
// 差分同期 ＆ 双方向マージロジック
// ========================================

async function gsheetFetchAllRows(spreadsheetId, sheetName) {
  try {
    const res = await sheetsRequest('GET',
      `/${spreadsheetId}/values/${encodeURIComponent(sheetName + '!A2:J')}?majorDimension=ROWS`
    );
    return res.values || [];
  } catch (e) {
    console.warn(`Failed to fetch sheet ${sheetName}:`, e);
    return [];
  }
}

// 1. セッションの双方向同期
async function gsheetSyncSessions(spreadsheetId) {
  const localItems = await db.sessions.toArray();
  const remoteRows = await gsheetFetchAllRows(spreadsheetId, 'sessions');

  const localMap = new Map(localItems.map(s => [String(s.id), s]));
  const remoteMap = new Map();
  
  remoteRows.forEach(row => {
    if (!row[0]) return;
    remoteMap.set(String(row[0]), {
      id: Number(row[0]),
      facility: row[1] || '',
      startTime: row[2] || '',
      endTime: row[3] || null,
      note: row[4] || '',
    });
  });

  let localAdded = 0;
  let remoteToAdd = [];

  // スプレッドシート -> ローカルDB (マージ・追加)
  for (const [idStr, remoteItem] of remoteMap.entries()) {
    const localItem = localMap.get(idStr);
    if (!localItem) {
      await db.sessions.put(remoteItem);
      localAdded++;
    } else {
      // 重複時は開始時間を比較し、より最新のデータや終了時間がある方を優先
      const hasUpdates = (remoteItem.endTime && !localItem.endTime) || 
                         (remoteItem.note && !localItem.note);
      if (hasUpdates) {
        await db.sessions.update(localItem.id, {
          endTime: remoteItem.endTime || localItem.endTime,
          note: remoteItem.note || localItem.note,
        });
      }
    }
  }

  // ローカルDB -> スプレッドシート (不足分を抽出)
  for (const [idStr, localItem] of localMap.entries()) {
    if (!remoteMap.has(idStr)) {
      remoteToAdd.push([
        localItem.id,
        localItem.facility || '',
        localItem.startTime || '',
        localItem.endTime || '',
        localItem.note || '',
      ]);
    }
  }

  if (remoteToAdd.length > 0) {
    await sheetsRequest('POST',
      `/${spreadsheetId}/values/${encodeURIComponent('sessions!A2')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: remoteToAdd }
    );
  }

  return { localAdded, remoteAdded: remoteToAdd.length };
}

// 2. エクササイズの双方向同期
async function gsheetSyncExercises(spreadsheetId) {
  const localItems = await db.exercises.toArray();
  const remoteRows = await gsheetFetchAllRows(spreadsheetId, 'exercises');

  const localMap = new Map(localItems.map(e => [String(e.id), e]));
  const remoteMap = new Map();

  remoteRows.forEach(row => {
    if (!row[0]) return;
    let dataParsed = [];
    try {
      dataParsed = JSON.parse(row[6] || '[]');
    } catch (err) {
      console.error('Error parsing exercise data from sheet:', err);
    }
    remoteMap.set(String(row[0]), {
      id: Number(row[0]),
      sessionId: Number(row[1]),
      machineId: row[2] || '',
      machineName: row[3] || '',
      category: row[4] || '',
      type: row[5] || '',
      data: dataParsed,
      saveMode: row[7] || '',
      note: row[8] || '',
      createdAt: row[9] || '',
    });
  });

  let localAdded = 0;
  let remoteToAdd = [];

  // スプレッドシート -> ローカルDB (追加)
  for (const [idStr, remoteItem] of remoteMap.entries()) {
    if (!localMap.has(idStr)) {
      await db.exercises.put(remoteItem);
      localAdded++;
    }
  }

  // ローカルDB -> スプレッドシート (追加)
  for (const [idStr, localItem] of localMap.entries()) {
    if (!remoteMap.has(idStr)) {
      remoteToAdd.push([
        localItem.id,
        localItem.sessionId,
        localItem.machineId,
        localItem.machineName || '',
        localItem.category || '',
        localItem.type || '',
        JSON.stringify(localItem.data),
        localItem.saveMode || '',
        localItem.note || '',
        localItem.createdAt || '',
      ]);
    }
  }

  if (remoteToAdd.length > 0) {
    await sheetsRequest('POST',
      `/${spreadsheetId}/values/${encodeURIComponent('exercises!A2')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: remoteToAdd }
    );
  }

  return { localAdded, remoteAdded: remoteToAdd.length };
}

// 3. 体組成データの双方向同期
async function gsheetSyncBody(spreadsheetId) {
  const localItems = await db.bodyComposition.toArray();
  const remoteRows = await gsheetFetchAllRows(spreadsheetId, 'bodyComposition');

  const localMap = new Map(localItems.map(r => [String(r.id), r]));
  const remoteMap = new Map();

  remoteRows.forEach(row => {
    if (!row[0]) return;
    remoteMap.set(String(row[0]), {
      id: Number(row[0]),
      date: row[1] || '',
      weight: row[2] ? parseFloat(row[2]) : null,
      bodyFat: row[3] ? parseFloat(row[3]) : null,
      muscleMass: row[4] ? parseFloat(row[4]) : null,
      bmi: row[5] ? parseFloat(row[5]) : null,
      visceralFat: row[6] ? parseFloat(row[6]) : null,
      note: row[7] || '',
    });
  });

  let localAdded = 0;
  let remoteToAdd = [];

  // スプレッドシート -> ローカルDB (追加)
  for (const [idStr, remoteItem] of remoteMap.entries()) {
    if (!localMap.has(idStr)) {
      await db.bodyComposition.put(remoteItem);
      localAdded++;
    }
  }

  // ローカルDB -> スプレッドシート (追加)
  for (const [idStr, localItem] of localMap.entries()) {
    if (!remoteMap.has(idStr)) {
      remoteToAdd.push([
        localItem.id,
        localItem.date || '',
        localItem.weight || '',
        localItem.bodyFat || '',
        localItem.muscleMass || '',
        localItem.bmi || '',
        localItem.visceralFat || '',
        localItem.note || '',
      ]);
    }
  }

  if (remoteToAdd.length > 0) {
    await sheetsRequest('POST',
      `/${spreadsheetId}/values/${encodeURIComponent('bodyComposition!A2')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: remoteToAdd }
    );
  }

  return { localAdded, remoteAdded: remoteToAdd.length };
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
  
  return {
    sessions: s.remoteAdded + s.localAdded,
    exercises: e.remoteAdded + e.localAdded,
    body: b.remoteAdded + b.localAdded,
    localDownloaded: s.localAdded + e.localAdded + b.localAdded
  };
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
       Google Cloud Console でOAuth2クライアントIDを取得し、
       承認済みオリジンに <code style="font-size:0.65rem">https://ambit1977.github.io</code> を追加してください。`;

  // 連携済みのスプレッドシートID表示
  const spreadsheetInfoHtml = authed
    ? `<div class="mb-md" style="background:var(--bg-elevated); padding:8px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
        <div class="text-xs text-muted">連携中のスプレッドシート</div>
        <div class="text-xs font-bold" style="word-break:break-all; color:var(--accent);">Gymny_Training_Log</div>
        <div class="text-xs text-muted mt-xs" style="font-size:0.65rem; word-break:break-all;">ID: ${spreadsheetId || '未同期'}</div>
      </div>`
    : ``;

  return `
    <div class="card mb-md">
      <div class="text-sm font-bold mb-sm">📊 Google Sheets 連携</div>
      <p class="text-xs text-muted mb-md">${descriptionHtml}</p>

      ${clientInputHtml}
      ${spreadsheetInfoHtml}

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
  const clientIdEl = document.getElementById('gs-client-id');
  if (clientIdEl?.value) localStorage.setItem('gs_client_id', clientIdEl.value);

  try {
    // 1. Google 認証
    await gsheetsSignIn();
    
    // 2. マイドライブ内から専用シートを検索 or 新規作成
    await gsheetsFindOrCreateSpreadsheet();
    
    showToast('Googleアカウントと連携しました ✅', 'success');
    renderSettings(document.getElementById('main-content'));
  } catch (e) {
    showToast(`連携エラー: ${e.message}`, 'danger');
  }
}

async function gsheetsSyncAllUI() {
  showToast('同期中...⏳', '');
  try {
    const result = await gsheetsSyncAll();
    // 双方向マージ結果をトーストでお知らせ
    if (result.localDownloaded > 0) {
      showToast(
        `同期完了 ✅  スプレッドシートから ${result.localDownloaded} 件の新しいデータを反映し、未同期分をアップロードしました。`,
        'success'
      );
    } else {
      showToast(
        `同期完了 ✅  データは最新です（スプレッドシートに未同期データをアップロードしました）`,
        'success'
      );
    }
    renderSettings(document.getElementById('main-content'));
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
