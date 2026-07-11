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

// 安全な日付パース関数 (iOS / タイムゾーン対応)
function safeParseDate(str) {
  if (!str) return null;
  const s = str.trim();
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  
  const parts = s.split(/[\sT]/);
  const datePart = parts[0] || '';
  const timePart = parts[1] || '';
  
  const dParts = datePart.split(/[-\/]/);
  const tParts = timePart.split(':');
  
  if (dParts.length < 3) return new Date(s);
  
  const year = parseInt(dParts[0], 10);
  const month = parseInt(dParts[1], 10) - 1;
  const day = parseInt(dParts[2], 10);
  
  const hour = tParts[0] ? parseInt(tParts[0], 10) : 0;
  const minute = tParts[1] ? parseInt(tParts[1], 10) : 0;
  const second = tParts[2] ? parseInt(tParts[2], 10) : 0;
  
  return new Date(year, month, day, hour, minute, second);
}

// タイムゾーンによる時間のズレ(9時間など)を無視して、年月日・時分の一致で同一判定を行うためのヘルパー
function getLocalYMDHMString(date) {
  if (!date || isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
}

// リモートIDとローカルIDのマッピングを保持するグローバルオブジェクト
let remoteSessionIdToLocalIdMap = new Map();

// 1. セッションの双方向同期
async function gsheetSyncSessions(spreadsheetId) {
  let localItems = await db.sessions.toArray();
  const remoteRows = await gsheetFetchAllRows(spreadsheetId, 'sessions');

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

  // 【重複クリーンアップ】ローカル側で同一年月日のセッションが複数重複してしまっている場合、
  // 0種目の不要な方を自動削除（クリーンアップ）する
  const seenYMDHM = new Set();
  const idsToDelete = [];
  for (const s of localItems) {
    const sDate = safeParseDate(s.startTime);
    if (!sDate) continue;
    const ymdhm = getLocalYMDHMString(sDate);
    if (seenYMDHM.has(ymdhm)) {
      // 既に同じ日時のセッションが存在する場合、種目数が少ない方（特に0種目のもの）を削除対象にする
      const existingExs = await db.exercises.where('sessionId').equals(s.id).count();
      if (existingExs === 0) {
        idsToDelete.push(s.id);
      }
    } else {
      seenYMDHM.add(ymdhm);
    }
  }
  if (idsToDelete.length > 0) {
    await db.sessions.where('id').anyOf(idsToDelete).delete();
    // 最新のローカルデータを再取得
    localItems = await db.sessions.toArray();
  }

  let localAdded = 0;
  remoteSessionIdToLocalIdMap.clear();

  // スプレッドシート -> ローカルDB (マージ・追加)
  for (const [remoteIdStr, remoteItem] of remoteMap.entries()) {
    const remoteParsedStart = safeParseDate(remoteItem.startTime);
    if (!remoteParsedStart) continue;

    // 日時の文字列表現(分単位まで)で同一セッションがあるか検索
    const remoteYMDHM = getLocalYMDHMString(remoteParsedStart);
    let localItem = localItems.find(s => {
      const localStart = safeParseDate(s.startTime);
      return localStart && getLocalYMDHMString(localStart) === remoteYMDHM;
    });

    if (!localItem) {
      // ローカルに存在しないセッションなので、自動増分IDで新規追加
      const newLocalId = await db.sessions.add({
        facility: remoteItem.facility,
        startTime: remoteParsedStart.toISOString(),
        endTime: remoteItem.endTime ? safeParseDate(remoteItem.endTime).toISOString() : null,
        note: remoteItem.note
      });
      remoteSessionIdToLocalIdMap.set(remoteIdStr, newLocalId);
      localAdded++;
    } else {
      // 存在する場合はIDの対応関係を記録
      remoteSessionIdToLocalIdMap.set(remoteIdStr, localItem.id);

      const localStart = safeParseDate(localItem.startTime);
      const localStartMs = localStart ? localStart.getTime() : 0;
      const localEnd = safeParseDate(localItem.endTime);
      const remoteEnd = safeParseDate(remoteItem.endTime);
      
      const localEndMs = localEnd ? localEnd.getTime() : 0;
      const remoteEndMs = remoteEnd ? remoteEnd.getTime() : 0;

      // ローカルの終了時刻が開始時刻より過去になっている（壊れている）場合、
      // またはスプレッドシート側に正しい終了時刻が入っているがローカルが未設定・不一致の場合は上書き修復
      const isEndTimeBroken = localEnd && localEndMs <= localStartMs;

      if (isEndTimeBroken || (remoteEndMs > 0 && localEndMs === 0) || (remoteEndMs > 0 && localEndMs !== remoteEndMs)) {
        await db.sessions.update(localItem.id, {
          endTime: remoteEnd ? remoteEnd.toISOString() : new Date(localStartMs + 60 * 60 * 1000).toISOString(),
          note: remoteItem.note || localItem.note
        });
      }
    }
  }

  // ローカルDBに存在するアクティブな変更をスプレッドシートに反映 (アップロード)
  const remoteToAdd = [];
  const remoteToUpdate = [];

  for (const localItem of localItems) {
    // 自身が現在トレーニング中のセッションはスプレッドシートへの早期送信を避ける (セッション終了時に送る)
    if (localItem.id === activeSessionId && !localItem.endTime) continue;

    // 種目が0件のセッションはアップロードしない
    const exCount = await db.exercises.where('sessionId').equals(localItem.id).count();
    if (exCount === 0 && localItem.endTime) continue;

    // 開始時間でスプレッドシート側のセッションがあるかチェック
    const localStart = safeParseDate(localItem.startTime);
    if (!localStart) continue;
    const localYMDHM = getLocalYMDHMString(localStart);
    let remoteItem = null;
    let remoteRowIdx = -1;

    remoteRows.forEach((row, idx) => {
      if (!row[0]) return;
      const remoteStart = safeParseDate(row[2]);
      if (remoteStart && getLocalYMDHMString(remoteStart) === localYMDHM) {
        remoteItem = {
          id: Number(row[0]),
          facility: row[1],
          startTime: row[2],
          endTime: row[3],
          note: row[4]
        };
        remoteRowIdx = idx + 2; // スプレッドシートの1ベース行インデックス (ヘッダ含む)
      }
    });

    if (!remoteItem) {
      // スプレッドシートに存在しないので新規追加
      remoteToAdd.push([
        localItem.id,
        localItem.facility || '',
        localItem.startTime || '',
        localItem.endTime || '',
        localItem.note || '',
      ]);
    } else {
      // 存在し、かつローカル側でセッションが終了しているのにスプレッドシート側が終了していない場合更新
      const localEnd = safeParseDate(localItem.endTime);
      const remoteEnd = safeParseDate(remoteItem.endTime);

      if (localEnd && !remoteEnd) {
        remoteToUpdate.push({
          range: `sessions!D${remoteRowIdx}:E${remoteRowIdx}`, // endTime と note を更新
          values: [[localItem.endTime || '', localItem.note || '']]
        });
      }
    }
  }

  if (remoteToAdd.length > 0) {
    await sheetsRequest('POST',
      `/${spreadsheetId}/values/${encodeURIComponent('sessions!A2')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: remoteToAdd }
    );
  }

  // スプレッドシート側の終了時刻・メモの一括更新を実行
  if (remoteToUpdate.length > 0) {
    await sheetsRequest('POST', `/${spreadsheetId}/values:batchUpdate`, {
      valueInputOption: 'RAW',
      data: remoteToUpdate
    });
  }

  return { localAdded, remoteAdded: remoteToAdd.length };
}

// 2. エクササイズの双方向同期
async function gsheetSyncExercises(spreadsheetId) {
  const localItems = await db.exercises.toArray();
  const remoteRows = await gsheetFetchAllRows(spreadsheetId, 'exercises');

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
  const remoteToAdd = [];

  // スプレッドシート -> ローカルDB (追加)
  for (const [remoteIdStr, remoteItem] of remoteMap.entries()) {
    // リモートの sessionId に対応するローカルの sessionId を取得
    const mappedLocalSessionId = remoteSessionIdToLocalIdMap.get(String(remoteItem.sessionId));
    if (!mappedLocalSessionId) {
      continue;
    }

    const remoteCreatedMs = safeParseDate(remoteItem.createdAt).getTime();

    // 同一の種目データ(sessionId, machineId, 作成日時がほぼ一致)がローカルにあるかチェック
    const isExist = localItems.some(e => {
      const localCreated = safeParseDate(e.createdAt);
      return e.sessionId === mappedLocalSessionId &&
             e.machineId === remoteItem.machineId &&
             localCreated && Math.abs(localCreated.getTime() - remoteCreatedMs) < 3000;
    });

    if (!isExist) {
      await db.exercises.add({
        sessionId: mappedLocalSessionId,
        machineId: remoteItem.machineId,
        machineName: remoteItem.machineName,
        category: remoteItem.category,
        type: remoteItem.type,
        data: remoteItem.data,
        saveMode: remoteItem.saveMode,
        note: remoteItem.note,
        createdAt: safeParseDate(remoteItem.createdAt).toISOString()
      });
      localAdded++;
    }
  }

  // ローカルDB -> スプレッドシート (追加)
  for (const localItem of localItems) {
    if (localItem.sessionId === activeSessionId) continue; // トレーニング中は送信しない

    const localCreated = safeParseDate(localItem.createdAt);
    if (!localCreated) continue;
    const localCreatedMs = localCreated.getTime();

    // スプレッドシート側に登録済みかチェック
    const isExist = Array.from(remoteMap.values()).some(e => {
      const mappedLocalSessionId = remoteSessionIdToLocalIdMap.get(String(e.sessionId));
      const remoteCreated = safeParseDate(e.createdAt);
      return mappedLocalSessionId === localItem.sessionId &&
             e.machineId === localItem.machineId &&
             remoteCreated && Math.abs(remoteCreated.getTime() - localCreatedMs) < 3000;
    });

    if (!isExist) {
      // スプレッドシート側のセッションID（リモートID）を逆引き
      let remoteSessionId = null;
      for (const [rId, lId] of remoteSessionIdToLocalIdMap.entries()) {
        if (lId === localItem.sessionId) {
          remoteSessionId = Number(rId);
          break;
        }
      }
      
      if (remoteSessionId) {
        remoteToAdd.push([
          localItem.id,
          remoteSessionId,
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
  
  // sessions を先に完全に完了させてから exercises を処理する
  const s = await gsheetSyncSessions(spreadsheetId);
  const [e, b] = await Promise.all([
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

      ${authed ? `
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button class="btn btn-ghost btn-sm" onclick="gsheetsShowRawDataLog()" style="flex:1; border:1px dashed var(--border-color); font-size:0.7rem; color:var(--text-secondary);">🔍 スプシの中身を確認・修復</button>
        </div>
        <p class="text-xs text-muted mt-sm" style="text-align:center">✅ Google アカウント連携済み</p>
      ` : ''}
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
    // 画面を自動リロードしてIndexedDBの最新修正データを強制ロードする
    setTimeout(() => {
      location.reload();
    }, 1500);
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

// スプレッドシートから特定のセッションとそれに紐づく種目の行を削除する
async function gsheetsDeleteSessionAndExercises(sessionId) {
  const spreadsheetId = localStorage.getItem('gs_spreadsheet_id');
  if (!spreadsheetId) return;

  try {
    // 1. 各種シートのIDとインデックスの対応マップを取得
    const meta = await sheetsRequest('GET', `/${spreadsheetId}?fields=sheets`);
    const sheetMap = {};
    meta.sheets.forEach(s => {
      sheetMap[s.properties.title] = s.properties.sheetId;
    });

    const requests = [];

    // --- sessions シートの行検索 ---
    const sessionRows = await gsheetFetchAllRows(spreadsheetId, 'sessions');
    const sessionIdxToDelete = [];
    sessionRows.forEach((row, idx) => {
      if (String(row[0]) === String(sessionId)) {
        // スプレッドシートの行は 1-indexed でヘッダがあるため、データ配列の idx に対する行番号は `idx + 2`
        // deleteDimensionで使うインデックスは 0-indexed なので、行番号-1 = `idx + 1` となります。
        sessionIdxToDelete.push(idx + 1);
      }
    });

    // --- exercises シートの行検索 ---
    const exerciseRows = await gsheetFetchAllRows(spreadsheetId, 'exercises');
    const exerciseIdxToDelete = [];
    exerciseRows.forEach((row, idx) => {
      if (String(row[1]) === String(sessionId)) {
        exerciseIdxToDelete.push(idx + 1);
      }
    });

    // 行がズレないよう、インデックスの降順に削除リクエストを作成します。
    // まず exercises から削除
    if (exerciseIdxToDelete.length > 0 && sheetMap['exercises'] !== undefined) {
      exerciseIdxToDelete.sort((a, b) => b - a);
      exerciseIdxToDelete.forEach(rowIdx => {
        requests.push({
          deleteDimension: {
            range: {
              sheetId: sheetMap['exercises'],
              dimension: 'ROWS',
              startIndex: rowIdx,
              endIndex: rowIdx + 1
            }
          }
        });
      });
    }

    // 次に sessions を削除
    if (sessionIdxToDelete.length > 0 && sheetMap['sessions'] !== undefined) {
      sessionIdxToDelete.sort((a, b) => b - a);
      sessionIdxToDelete.forEach(rowIdx => {
        requests.push({
          deleteDimension: {
            range: {
              sheetId: sheetMap['sessions'],
              dimension: 'ROWS',
              startIndex: rowIdx,
              endIndex: rowIdx + 1
            }
          }
        });
      });
    }

    // 削除リクエストの一括実行
    if (requests.length > 0) {
      await sheetsRequest('POST', `/${spreadsheetId}:batchUpdate`, { requests });
      showToast('スプレッドシート側も削除同期しました ☁️', 'success');
    }
  } catch (e) {
    console.error('Failed to delete rows from Google Sheets:', e);
    showToast(`Google Sheetsでの削除同期に失敗しました: ${e.message}`, 'danger');
  }
}

// ========================================
// メンテナンス・デバッグ用 (スプレッドシート確認とクリーンアップ)
// ========================================

async function gsheetsShowRawDataLog() {
  const spreadsheetId = localStorage.getItem('gs_spreadsheet_id');
  if (!spreadsheetId) {
    showToast('スプレッドシートIDがありません。', 'danger');
    return;
  }
  showToast('スプレッドシートからデータを取得中...⏳', '');
  try {
    const [sessions, exercises] = await Promise.all([
      gsheetFetchAllRows(spreadsheetId, 'sessions'),
      gsheetFetchAllRows(spreadsheetId, 'exercises')
    ]);

    let sessionRowsHtml = sessions.map((row, idx) => {
      return `<tr style="border-bottom:1px solid var(--border-color); font-size:0.75rem;">
        <td style="padding:6px;">${row[0]}</td>
        <td style="padding:6px; font-weight:bold;">${row[2]}</td>
        <td style="padding:6px; color:var(--text-secondary);">${row[3] || '空'}</td>
        <td style="padding:6px; font-size:0.65rem;">${row[4] || ''}</td>
      </tr>`;
    }).join('');

    let exRowsHtml = exercises.map((row, idx) => {
      return `<tr style="border-bottom:1px solid var(--border-color); font-size:0.7rem;">
        <td style="padding:4px;">${row[1]} (セッション)</td>
        <td style="padding:4px; font-weight:bold;">${row[3]}</td>
        <td style="padding:4px; font-size:0.6rem; color:var(--text-secondary); word-break:break-all;">${row[6] || ''}</td>
      </tr>`;
    }).join('');

    showModal(`
      <div class="modal-handle"></div>
      <div class="flex items-center justify-between mb-md">
        <div class="modal-title" style="margin-bottom:0">スプレッドシートの登録生データ</div>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:4px 12px;font-size:14px;color:var(--text-secondary)">✕ 閉じる</button>
      </div>
      
      <div style="font-size:0.8rem; font-weight:bold; margin-bottom:6px; color:var(--accent);">■ sessions シート (${sessions.length}行)</div>
      <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: var(--space-md);">
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead>
            <tr style="background:var(--bg-secondary); font-size:0.7rem; border-bottom:1px solid var(--border-color);">
              <th style="padding:6px;">ID</th>
              <th style="padding:6px;">開始日時</th>
              <th style="padding:6px;">終了日時</th>
              <th style="padding:6px;">メモ</th>
            </tr>
          </thead>
          <tbody>
            ${sessionRowsHtml || '<tr><td colspan="4" style="padding:12px; text-align:center;">データなし</td></tr>'}
          </tbody>
        </table>
      </div>

      <div style="font-size:0.8rem; font-weight:bold; margin-bottom:6px; color:var(--accent);">■ exercises シート (${exercises.length}行)</div>
      <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: var(--space-md);">
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead>
            <tr style="background:var(--bg-secondary); font-size:0.7rem; border-bottom:1px solid var(--border-color);">
              <th style="padding:4px;">セッションID</th>
              <th style="padding:4px;">種目名</th>
              <th style="padding:4px;">データ値</th>
            </tr>
          </thead>
          <tbody>
            ${exRowsHtml || '<tr><td colspan="3" style="padding:12px; text-align:center;">データなし</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <div class="flex gap-sm">
        <button class="btn btn-secondary btn-block" onclick="closeModal()">閉じる</button>
        <button class="btn btn-danger btn-block" onclick="closeModal(); gsheetsCleanRemoteDuplicates();" style="background:var(--danger); border-color:var(--danger); color:#fff;">スプシ側の重複行を修復削除</button>
      </div>
    `);
  } catch (e) {
    console.error(e);
    showToast(`スプレッドシート読み込みエラー: ${e.message}`, 'danger');
  }
}

async function gsheetsCleanRemoteDuplicates() {
  const spreadsheetId = localStorage.getItem('gs_spreadsheet_id');
  if (!spreadsheetId) return;
  showToast('スプレッドシートのクリーンアップ中...⏳', '');

  try {
    const meta = await sheetsRequest('GET', `/${spreadsheetId}?fields=sheets`);
    const sheetMap = {};
    meta.sheets.forEach(s => {
      sheetMap[s.properties.title] = s.properties.sheetId;
    });

    const sessionRows = await gsheetFetchAllRows(spreadsheetId, 'sessions');
    const seenYMDHM = new Map();
    const requests = [];

    // 重複するセッション行（年月日時間が同じ）を抽出する
    // 重複した行のうち、後から登録された「中身が空・狂っている可能性のある行」を削除対象にする
    sessionRows.forEach((row, idx) => {
      if (!row[0]) return;
      const start = safeParseDate(row[2]);
      if (!start) return;
      const ymdhm = getLocalYMDHMString(start);
      
      if (seenYMDHM.has(ymdhm)) {
        // 重複があった場合、前に登録された方(初発)を残し、今回の行(idx + 1)を削除リストに追加
        requests.push(idx + 1);
      } else {
        seenYMDHM.set(ymdhm, idx + 1);
      }
    });

    if (requests.length > 0 && sheetMap['sessions'] !== undefined) {
      // 降順にソートして削除リクエストを作成 (行ずれ防止)
      requests.sort((a, b) => b - a);
      const batchRequests = requests.map(rowIdx => ({
        deleteDimension: {
          range: {
            sheetId: sheetMap['sessions'],
            dimension: 'ROWS',
            startIndex: rowIdx,
            endIndex: rowIdx + 1
          }
        }
      }));

      await sheetsRequest('POST', `/${spreadsheetId}:batchUpdate`, { requests: batchRequests });
      showToast(`スプシ側の重複したセッションデータ ${requests.length} 件を修復・削除しました ✅`, 'success');
      
      // ローカルDBも再度同期を実行して名寄せを確実にする
      setTimeout(() => {
        gsheetsSyncAllUI();
      }, 1500);
    } else {
      showToast('スプレッドシート側に重複したセッションはありません ✨', 'success');
    }
  } catch (e) {
    console.error(e);
    showToast(`クリーンアップエラー: ${e.message}`, 'danger');
  }
}
