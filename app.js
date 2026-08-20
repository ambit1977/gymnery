
// ========================================
// 施設データ共有・コミュニティ貢献機能 (Phase 2)
// ========================================
window.openFacilityShareModal = function() {
  const fac = window.GymneryFacility || {};
  const machineCount = fac.machines ? fac.machines.length : 0;
  const currentNick = localStorage.getItem('contributor_nickname') || '';

  const modalHtml = `
    <div class="modal-overlay active" id="facility-share-modal" onclick="closeModalCustom('facility-share-modal')">
      <div class="modal-content" onclick="event.stopPropagation()" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-handle"></div>
        <div class="flex items-center justify-between mb-md">
          <div class="modal-title" style="margin-bottom:0; font-size:1.1rem;">📤 施設・マシン情報を共有</div>
          <button class="btn btn-ghost btn-sm" onclick="closeModalCustom('facility-share-modal')" style="color:var(--text-muted);">✕</button>
        </div>

        <p class="text-xs text-muted mb-md" style="line-height: 1.6;">
          あなたが修正・設定した<strong>「${fac.name || '施設'}」</strong>のマシン情報（全 ${machineCount} 台）をコミュニティに送信し、公式カタログへの反映を提案できます。
        </p>

        <div class="card mb-md" style="background:var(--bg-secondary); padding:10px 12px; font-size:0.75rem;">
          <div class="flex justify-between mb-xs">
            <span class="text-muted">施設名:</span>
            <span class="font-bold">${fac.name || '未設定'}</span>
          </div>
          <div class="flex justify-between mb-xs">
            <span class="text-muted">登録マシン数:</span>
            <span class="font-bold">${machineCount} 台</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">ステータス:</span>
            <span class="font-bold" style="color:var(--accent);">${fac.isMachineVerified ? '検証済み ✅' : 'ユーザー編集データ 📝'}</span>
          </div>
        </div>

        <div class="input-group mb-sm">
          <label class="input-label text-xs">ニックネーム（任意・クレジット表記用）</label>
          <input type="text" id="share-nickname" class="input text-xs" value="${currentNick}" placeholder="例: 練馬のトレーニー">
        </div>

        <div class="input-group mb-md">
          <label class="input-label text-xs">修正内容・現場メモ（任意）</label>
          <textarea id="share-comment" class="input text-xs" placeholder="例: レッグプレスの重りを現場の実機に合わせて修正しました。チェストプレスを追加しました。" style="height:70px; resize:none;"></textarea>
        </div>

        <div class="flex gap-sm">
          <button class="btn btn-secondary" onclick="closeModalCustom('facility-share-modal')" style="flex:1;">キャンセル</button>
          <button class="btn btn-primary" id="btn-submit-share" onclick="submitFacilityShare()" style="flex:2;">🚀 共有する（送信）</button>
        </div>

        <div class="mt-md text-center">
          <button class="btn btn-ghost text-xs" onclick="copyFacilityJsonToClipboard()" style="color:var(--text-muted); font-size:0.7rem;">📋 設定JSONをクリップボードにコピー</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.submitFacilityShare = async function() {
  const btn = document.getElementById('btn-submit-share');
  const nickname = document.getElementById('share-nickname')?.value.trim() || '匿名トレーニー';
  const comment = document.getElementById('share-comment')?.value.trim() || '';
  
  localStorage.setItem('contributor_nickname', nickname);

  const payload = {
    facilityId: localStorage.getItem('selected_facility_preset') || 'custom',
    facilityName: window.GymneryFacility?.name || '名称未設定',
    nickname: nickname,
    comment: comment,
    facilityData: window.GymneryFacility,
    submittedAt: new Date().toISOString(),
    appVersion: 'v92'
  };

  // GAS Web App URL (ローカルストレージまたは環境設定)
  const gasEndpoint = localStorage.getItem('custom_facility_share_endpoint') || 'https://script.google.com/macros/s/AKfycbz_fallback_endpoint/exec';

  if (btn) {
    btn.disabled = true;
    btn.textContent = '送信中... ⏳';
  }

  try {
    // 実際にエンドポイントへPOST送信 (no-cors mode fallback supported)
    await fetch(gasEndpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    closeModalCustom('facility-share-modal');
    showToast('🎉 施設情報を共有しました！ご協力ありがとうございます💪', 'success');
  } catch (err) {
    console.warn('Share submit error, fallback to copy:', err);
    closeModalCustom('facility-share-modal');
    copyFacilityJsonToClipboard();
    showToast('送信に失敗したため、設定JSONをコピーしました。GitHub等へ共有可能です。', 'info');
  }
};

window.copyFacilityJsonToClipboard = function() {
  const jsonStr = JSON.stringify(window.GymneryFacility, null, 2);
  navigator.clipboard.writeText(jsonStr).then(() => {
    showToast('設定JSONをクリップボードにコピーしました 📋', 'success');
  }).catch(() => {
    prompt('以下の設定JSONをコピーしてください:', jsonStr);
  });
};

window.switchFacilityPreset = function(facilityId) {
  if (!facilityId) return;
  const presets = {
    'asahicho': '旭町南地区区民館',
    'hikarigaoka': '光が丘体育館',
    'nerima_sougou': '練馬区立総合体育館',
    'heiwadai': '平和台体育館',
    'kamishakujii': '上石神井体育館'
  };
  const name = presets[facilityId] || facilityId;
  if (confirm(`施設プリセットを「${name}」に切り替えますか？`)) {
    localStorage.removeItem('custom_facility_info');
    localStorage.removeItem('custom_machines');
    localStorage.setItem('selected_facility_preset', facilityId);
    const url = new URL(window.location.href);
    url.searchParams.set('facility', facilityId);
    window.location.href = url.toString();
  }
};

// 種目履歴フィルター用グローバルステート
window.machineHistoryFilterCategory = 'all';
window.machineHistoryFilterMuscle = null;

window.navigateToMachineHistoryByMuscle = function(muscleId) {
  window.machineHistoryFilterMuscle = muscleId;
  window.machineHistoryFilterCategory = 'all';
  currentHistoryTab = 'machines';
  navigateTo('history');
};

window.setMachineHistoryCategoryFilter = function(cat) {
  window.machineHistoryFilterCategory = cat;
  window.machineHistoryFilterMuscle = null;
  const tabContent = document.getElementById('history-tab-content');
  if (tabContent) renderMachinesTab(tabContent);
};

window.clearMachineHistoryMuscleFilter = function() {
  window.machineHistoryFilterMuscle = null;
  const tabContent = document.getElementById('history-tab-content');
  if (tabContent) renderMachinesTab(tabContent);
};
let lastViewedSessionId = null;
let lastViewedSessionDate = null;
// ========================================
// app.js - メインアプリケーション
// ========================================

let currentPage = 'home';
let activeSessionId = null;
let timerInterval = null;
let alertedMinutes = new Set();
let chartInstances = {};
let intervalTimerId = null;
let intervalTimerEndTime = 0;
let intervalTimerMachineId = null;
let wakeLockSentinel = null;
let intervalBeepAudio = null;

// ========================================
// 施設設定ロード処理 ＆ マシンヘルパー関数
// ========================================
window.GymneryFacility = null;

async function loadFacilityConfig() {
  const urlParams = new URLSearchParams(window.location.search);
  const configUrl = urlParams.get('config');
  const facilityId = urlParams.get('facility') || localStorage.getItem('selected_facility_preset') || 'asahicho';

  let configData = null;

  if (configUrl) {
    try {
      const res = await fetch(configUrl);
      if (res.ok) {
        configData = await res.json();
      }
    } catch (e) {
      console.error('Failed to load external config:', e);
    }
  }

  if (!configData && facilityId) {
    try {
      const res = await fetch(`config/facility_${facilityId}.json`);
      if (res.ok) {
        configData = await res.json();
      }
    } catch (e) {
      console.error(`Failed to load preset config: facility_${facilityId}.json`, e);
    }
  }

  // どちらも失敗した場合はデフォルト（asahicho）をロードする
  if (!configData) {
    try {
      const res = await fetch('config/facility_asahicho.json');
      if (res.ok) {
        configData = await res.json();
      }
    } catch (e) {
      console.error('Failed to load fallback config (facility_asahicho.json):', e);
    }
  }

  if (configData) {
    // カスタム施設情報のマージ
    try {
      const customFac = JSON.parse(localStorage.getItem('custom_facility_info') || 'null');
      if (customFac) Object.assign(configData, customFac);
    } catch (e) {}

    // カスタムマシン一覧のマージ
    try {
      const customMachines = JSON.parse(localStorage.getItem('custom_machines') || 'null');
      if (customMachines && Array.isArray(customMachines)) {
        configData.machines = customMachines;
      }
    } catch (e) {}

    window.GymneryFacility = configData;
    // タイトルの書き換え
    document.title = `トレーニング記録 - ${configData.name}`;
    const headerTitle = document.getElementById('header-subtitle');
    if (headerTitle) {
      headerTitle.textContent = configData.name;
    }
    console.log(`Loaded facility config: ${configData.name}`);
  } else {
    // 完全に失敗した場合の最低限のフォールバック
    window.GymneryFacility = {
      name: 'トレーニング室',
      machines: [],
      categories: {}
    };
  }
}

function getMachineById(id) {
  if (!window.GymneryFacility || !window.GymneryFacility.machines) return null;
  return window.GymneryFacility.machines.find(m => m.id === id);
}

function getMachinesByCategory(category) {
  if (!window.GymneryFacility || !window.GymneryFacility.machines) return [];
  return window.GymneryFacility.machines.filter(m => m.category === category);
}

function getCategoryLabel(category) {
  if (!window.GymneryFacility || !window.GymneryFacility.categories) return category;
  return window.GymneryFacility.categories[category]?.label || category;
}

function getCategoryIcon(category) {
  if (!window.GymneryFacility || !window.GymneryFacility.categories) return '🏋️';
  return window.GymneryFacility.categories[category]?.icon || '🏋️';
}

function getCategoryColor(category) {
  if (!window.GymneryFacility || !window.GymneryFacility.categories) return '#888';
  return window.GymneryFacility.categories[category]?.color || '#888';
}

// ========================================
// Web Push 通知設定
// ========================================
const PUSH_SERVER_URL = 'https://ambit.go2020.tokyo/gymnery-push';
const PUSH_AUTH_TOKEN = '110c51d7a0df23e3727416a0bc63273fc17d8df0a4cc2a06';
const VAPID_PUBLIC_KEY = 'BMJVOWIjd6G60ktizFUf9hC843o-kO29XXhZPZoKvgt_4dBDamEu-wEK59wMc6iwsB32VwJ5SV-kpyK9HzuVL1Q';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Push予約をVPSへ送信
function pushSchedule(fireAt, type = 'interval') {
  if (localStorage.getItem('push_enabled') !== '1') {
    console.log('Push is disabled');
    return;
  }
  const showToastFlag = (type === 'interval');
  if (showToastFlag) showToast('通知予約送信中...☁️', '');
  
  fetch(`${PUSH_SERVER_URL}/schedule`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PUSH_AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fireAt, type })
  }).then(res => {
    if (!res.ok) {
      if (showToastFlag) showToast(`通知予約エラー (${res.status}) ❌`, 'danger');
    } else {
      if (showToastFlag) showToast('通知予約完了 ✅', 'success');
    }
  }).catch(e => {
    console.warn('Push schedule failed:', e);
    if (showToastFlag) showToast(`通知予約失敗: ${e.message} ❌`, 'danger');
  });
}

// Push予約キャンセルをVPSへ送信
function pushCancel(type = 'interval') {
  if (localStorage.getItem('push_enabled') !== '1') return;
  fetch(`${PUSH_SERVER_URL}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PUSH_AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type })
  }).then(res => {
    if (res.ok) {
      console.log(`Push cancel completed for type=${type}`);
    }
  }).catch(e => console.warn(`Push cancel failed for type=${type}:`, e));
}

// 通知の有効化処理
async function pushSubscribe() {
  const btn = document.getElementById('push-enable-btn');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('このブラウザ/環境はバックグラウンド通知に対応していません。ホーム画面に追加(PWA化)してからお試しください。');
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = '登録中...';
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('通知許可が拒否されました。設定アプリから許可を有効にしてください。');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '通知を有効にする';
      }
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    showToast('サーバーへ購読情報を送信中...⏳', '');
    const res = await fetch(`${PUSH_SERVER_URL}/subscribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PUSH_AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ subscription: sub })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    localStorage.setItem('push_enabled', '1');
    showToast('バックグラウンド通知を有効にしました 🔔', 'success');
    renderSettings(document.getElementById('main-content'));
  } catch (err) {
    console.error('Push subscription failed:', err);
    alert('通知登録に失敗しました: ' + err.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '通知を有効にする';
    }
  }
}

// アプリ起動時に購読確認
async function pushEnsureSubscription() {
  if (localStorage.getItem('push_enabled') !== '1') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    let isResubscribed = false;

    if (!sub) {
      console.log('Push subscription lost. Resubscribing...');
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      isResubscribed = true;
    }

    if (sub) {
      const res = await fetch(`${PUSH_SERVER_URL}/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PUSH_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscription: sub })
      });
      if (res.ok) {
        console.log('Push subscription successfully ensured/updated in background.');
        if (isResubscribed) {
          showToast('バックグラウンド通知の購読を自動復旧しました 🔔', 'success');
        }
      } else {
        console.warn(`Push subscription update failed: HTTP ${res.status}`);
      }
    }
  } catch (e) {
    console.warn('Subscription ensure failed:', e);
  }
}

let _sessionCacheForDates = null;
async function getExerciseDate(exercise) {
  if (!exercise) return null;
  if (!_sessionCacheForDates) {
    const sessions = await getAllSessions();
    _sessionCacheForDates = new Map(sessions.map(s => [s.id, s.startTime || s.createdAt]));
  }
  const st = _sessionCacheForDates.get(exercise.sessionId);
  return st ? new Date(st) : new Date(exercise.createdAt);
}
function clearSessionDateCache() {
  _sessionCacheForDates = null;
}

function getDaysDiff(date1, date2) {
  if (!date1 || !date2) return 0;
  const dObj1 = date1 instanceof Date ? date1 : new Date(date1);
  const dObj2 = date2 instanceof Date ? date2 : new Date(date2);
  if (isNaN(dObj1.getTime()) || isNaN(dObj2.getTime())) return 0;
  
  const d1 = new Date(dObj1.getFullYear(), dObj1.getMonth(), dObj1.getDate());
  const d2 = new Date(dObj2.getFullYear(), dObj2.getMonth(), dObj2.getDate());
  return Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

// ========================================
// Screen Wake Lock (インターバル中のスリープ防止)
// ========================================
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (wakeLockSentinel) return;
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
  } catch (e) {
    console.warn('Wake Lock request failed:', e);
  }
}

function releaseWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release();
    wakeLockSentinel = null;
  }
}

// 画面復帰時およびPWAコールドスタート時の復元処理
function clearLocalIntervalTimer() {
  if (intervalTimerId) {
    clearInterval(intervalTimerId);
    intervalTimerId = null;
  }
  intervalTimerEndTime = 0;
  intervalTimerMachineId = null;
  localStorage.removeItem('interval_timer_end_time');
  localStorage.removeItem('interval_timer_machine_id');
  localStorage.removeItem('interval_timer_triggered');
  releaseWakeLock();
  pushCancel('interval');
}

async function restoreIntervalTimer() {
  const endTimeStr = localStorage.getItem('interval_timer_end_time');
  const machineId = localStorage.getItem('interval_timer_machine_id');
  const triggered = localStorage.getItem('interval_timer_triggered');

  if (!endTimeStr || !machineId) return;

  const endTime = Number(endTimeStr);
  const now = Date.now();

  // すでにタイムアップ時間を過ぎているが、まだ追加処理が未実行の場合
  if (now >= endTime && triggered === '0') {
    localStorage.setItem('interval_timer_triggered', '1');
    if (activeSessionId) {
      const modal = document.querySelector('.modal-overlay');
      if (modal && modal.dataset.isExercise === 'true' && modal.dataset.machineId === machineId) {
        addSetRow(machineId);
      } else {
        addSetToDraft(machineId);
      }
      showToast('インターバルが終了したため、次のセットを追加しました ⏱', 'success');
    }
    clearLocalIntervalTimer();
  } else if (now < endTime) {
    // まだ時間がある場合はタイマー表示を再起動
    const container = document.getElementById('interval-timer-container');
    if (container && container.style.display === 'flex') {
      intervalTimerEndTime = endTime;
      startIntervalTimer(machineId, true); // trueを渡して初期予約をスキップ
    }
  }
}

// 画面復帰時やフォーカス時に復元処理をトリガー
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    requestWakeLock();
    if (intervalTimerId) {
      // 稼働中の場合はWake Lockだけ再取得
    } else {
      await restoreIntervalTimer();
    }
  }
});

window.addEventListener('pageshow', async () => {
  await restoreIntervalTimer();
});

// ========================================
// インターバル終了音 (WAVプログラム生成)
// ========================================
function ensureIntervalBeepAudio() {
  if (intervalBeepAudio) return intervalBeepAudio;

  const sampleRate = 22050;
  const freq = 880;
  const beepDuration = 0.2;
  const gapDuration = 0.15;
  const beepCount = 3;

  const beepSamples = Math.floor(sampleRate * beepDuration);
  const gapSamples = Math.floor(sampleRate * gapDuration);
  const totalSamples = beepCount * beepSamples + (beepCount - 1) * gapSamples;

  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  let offset = 44;
  for (let b = 0; b < beepCount; b++) {
    for (let i = 0; i < beepSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, i / 200, (beepSamples - i) / 200);
      const sample = Math.sin(2 * Math.PI * freq * t) * 0.6 * envelope;
      view.setInt16(offset, sample * 32767, true);
      offset += 2;
    }
    if (b < beepCount - 1) {
      for (let i = 0; i < gapSamples; i++) {
        view.setInt16(offset, 0, true);
        offset += 2;
      }
    }
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  intervalBeepAudio = new Audio(url);
  intervalBeepAudio.volume = 1.0;
  return intervalBeepAudio;
}

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  // Load facility configuration first
  await loadFacilityConfig();

  // Check for active session in localStorage
  activeSessionId = localStorage.getItem('activeSessionId')
    ? Number(localStorage.getItem('activeSessionId'))
    : null;

  // Validate active session still exists
  if (activeSessionId) {
    const session = await getSession(activeSessionId);
    if (!session || session.endTime) {
      activeSessionId = null;
      localStorage.removeItem('activeSessionId');
    }
  }

  // Initialize default member ID (blank by default)
  // If not set, user will be prompted to enter on tap.

  // Handle body composition URL parameters (Shortcut integration)
  await handleUrlParamsImport();

  // Setup navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  navigateTo('home');
  registerSW();
  pushEnsureSubscription();
  restoreIntervalTimer();
  checkOnboardingWizard();
});

async function handleUrlParamsImport() {
  const params = new URLSearchParams(window.location.search);
  const weight = params.get('weight') || params.get('w');
  const fat = params.get('fat') || params.get('f');
  const muscle = params.get('muscle') || params.get('m');
  const visceral = params.get('visceral') || params.get('v');
  const bmi = params.get('bmi') || params.get('b');
  const date = params.get('date') || params.get('d') || new Date().toISOString().split('T')[0];

  if (weight || fat || muscle) {
    const data = {
      date,
      weight: weight ? parseFloat(weight) : null,
      bodyFat: fat ? parseFloat(fat) : null,
      muscleMass: muscle ? parseFloat(muscle) : null,
      bmi: bmi ? parseFloat(bmi) : null,
      visceralFat: visceral ? parseFloat(visceral) : null,
      note: 'Appleヘルスケア / ショートカット連携'
    };

    try {
      await addBodyComposition(data);
      showToast(`ヘルスケア連携: 体組成をインポートしました (体重: ${data.weight}kg) ✅`, 'success');
      // クエリパラメータを消してURLをクリーンに保つ (リロードによる多重登録防止)
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    } catch (e) {
      console.error('Shortcut import failed:', e);
      showToast('ヘルスケア連携インポートに失敗しました', 'danger');
    }
  }
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  const headerTitle = document.getElementById('header-title');
  const headerSubtitle = document.getElementById('header-subtitle');
  const headerActions = document.getElementById('header-actions');
  headerActions.innerHTML = '';

  const titles = {
    home: 'トレーニング記録',
    history: '履歴',
    stats: '統計',
    body: '体組成',
    settings: '設定',
  };
  headerTitle.textContent = titles[page] || 'トレーニング記録';
  headerSubtitle.textContent = window.GymneryFacility?.name || 'トレーニング室';

  const activeModal = document.querySelector('.modal-overlay');
  if (activeModal && activeModal.dataset.isExercise === 'true') {
    const machineId = activeModal.dataset.machineId;
    const editId = activeModal.dataset.editExerciseId ? Number(activeModal.dataset.editExerciseId) : null;
    const targetId = activeModal.dataset.targetSessionId ? Number(activeModal.dataset.targetSessionId) : null;
    saveExerciseDraft(machineId, editId, targetId);
    closeModal(true);
  }
  clearTimer();
  destroyCharts();
  renderPage(page);
  renderActiveExerciseBar();
}

async function renderPage(page) {
  const main = document.getElementById('main-content');
  switch (page) {
    case 'home': return renderHome(main);
    case 'history': return renderHistory(main);
    case 'stats': return renderStats(main);
    case 'body': return renderBody(main);
    case 'settings': return renderSettings(main);
    default: return renderHome(main);
  }
}

// ========================================
// Toast
// ========================================
function showToast(msg, type = '') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type ? 'toast-' + type : ''}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ========================================
// Timer
// ========================================
function clearTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  pushCancel('session_5min');
  pushCancel('session_end');
}

function startTimer(startTime, timerContainer) {
  clearTimer();
  alertedMinutes.clear();
  const SESSION_DURATION = 60 * 60 * 1000; // 1時間

  // サーバーへプッシュ通知スケジュールを送信（5分前警告＆終了時）
  const startTimeMs = new Date(startTime).getTime();
  pushSchedule(startTimeMs + 55 * 60 * 1000, 'session_5min');
  pushSchedule(startTimeMs + 60 * 60 * 1000, 'session_end');

  const notifyUser = (remainMin) => {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    showToast(`⏳ まもなく1時間です（残り ${remainMin} 分）`, 'warning');
  };

  const update = () => {
    const diff = Date.now() - new Date(startTime).getTime();
    const totalMinutes = Math.floor(diff / 60000);
    const remain = SESSION_DURATION - diff;
    const isOvertime = remain <= 0;

    // Elapsed time
    const eH = Math.floor(diff / 3600000);
    const eM = Math.floor((diff % 3600000) / 60000);
    const eS = Math.floor((diff % 60000) / 1000);
    const elapsedStr = `${String(eH).padStart(2,'0')}:${String(eM).padStart(2,'0')}:${String(eS).padStart(2,'0')}`;

    // Remaining time
    const absRemain = Math.abs(remain);
    const rM = Math.floor(absRemain / 60000);
    const rS = Math.floor((absRemain % 60000) / 1000);
    const remainStr = `${isOvertime ? '-' : ''}${String(rM).padStart(2,'0')}:${String(rS).padStart(2,'0')}`;

    // Progress percentage (capped at 100)
    const progress = Math.min(diff / SESSION_DURATION * 100, 100);

    // Urgency class
    let urgencyClass = 'timer-safe';
    if (isOvertime) urgencyClass = 'timer-overtime';
    else if (remain <= 3 * 60 * 1000) urgencyClass = 'timer-danger';
    else if (remain <= 5 * 60 * 1000) urgencyClass = 'timer-warning';

    // Alert at 5, 3, 1 minute(s) remaining
    const minInHour = totalMinutes % 60;
    if ([55, 57, 59].includes(minInHour) && !alertedMinutes.has(totalMinutes)) {
      alertedMinutes.add(totalMinutes);
      notifyUser(60 - minInHour);
    }

    // Update the timer container
    const remainEl = timerContainer.querySelector('.timer-remain');
    const sessionCard = timerContainer.closest('.session-active') || timerContainer.parentElement;
    const elapsedEl = sessionCard ? sessionCard.querySelector('.timer-elapsed') : null;
    const progressBar = timerContainer.querySelector('.timer-progress-fill');
    const startTimeEl = timerContainer.querySelector('.timer-start-time');

    if (remainEl) {
      remainEl.textContent = remainStr;
      remainEl.className = `timer-remain ${urgencyClass}`;
    }
    if (elapsedEl) elapsedEl.textContent = elapsedStr;
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      progressBar.className = `timer-progress-fill ${urgencyClass}`;
    }
    if (startTimeEl) {
      startTimeEl.textContent = formatTime(startTime);
    }
    
    // Update modal timer if exists
    const modalTimerEl = document.getElementById('modal-timer-display');
    if (modalTimerEl) {
      modalTimerEl.textContent = remainStr;
      modalTimerEl.className = urgencyClass;
    }
    
    // Overtime alert
    if (isOvertime && !alertedMinutes.has('overtime')) {
      alertedMinutes.add('overtime');
      if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
      showToast('⚠️ 1時間が経過しました。セッションを終了してください。', 'danger');
    }
  };
  update();
  timerInterval = setInterval(update, 1000);
}

async function adjustStartTime(deltaMinutes) {
  if (!activeSessionId) return;
  const session = await getSession(activeSessionId);
  if (!session) return;
  const current = new Date(session.startTime);
  current.setMinutes(current.getMinutes() + deltaMinutes);
  await db.sessions.update(activeSessionId, { startTime: current.toISOString() });
  // Re-render home to pick up the new start time
  navigateTo('home');
}

function destroyCharts() {
  Object.values(chartInstances).forEach(c => {
    if (c && typeof c.destroy === 'function') {
      c.destroy();
    }
  });
  chartInstances = {};
}

// ========================================
// ホーム画面
// ========================================
async function renderHome(main) {
  const sessions = await getAllSessions();
  const recentSessions = sessions.slice(0, 3);
  const latest = await getLatestBodyComposition();

  let activeHtml = '';
  if (activeSessionId) {
    const session = await getSession(activeSessionId);
    const exercises = await getExercisesBySession(activeSessionId);

    let exListHtml = '';
    for (const ex of exercises) {
      const machine = getMachineById(ex.machineId);
      const catColor = getCategoryColor(ex.category);
      let setsHtml = '';
      if (ex.type === 'strength' && Array.isArray(ex.data)) {
        ex.data.forEach((s, i) => {
          setsHtml += `<span class="exercise-set-val">${s.weight || 0}kg × ${s.reps || 0}</span>`;
        });
      } else {
        if (machine) {
          machine.fields.forEach(f => {
            if (ex.data[f.key]) setsHtml += `<span class="exercise-set-val">${ex.data[f.key]} ${f.label}</span>`;
          });
          if (machine.id === 'treadmill' && ex.data.distance && ex.data.speed) {
            const calcDuration = Math.round((ex.data.distance / ex.data.speed) * 60);
            setsHtml += `<span class="exercise-set-val">${calcDuration} 時間(分)</span>`;
          }
        }
      }
      const cameraBtn = (machine && machine.image) ? `<span onclick="event.stopPropagation(); showMachinePhoto('${ex.machineId}')" style="cursor:pointer; font-size:1.0rem; padding: 2px; margin-left: 6px; background:var(--bg-secondary); border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
      const videoBtn = (machine && machine.videoUrl) ? `<a href="${machine.videoUrl}" target="_blank" onclick="event.stopPropagation();" style="cursor:pointer; font-size:1.0rem; padding: 2px; margin-left: 6px; background:var(--bg-secondary); border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; text-decoration:none;" title="動画を見る">🎬</a>` : '';
      const modeBadge = ex.saveMode ? `<span class="badge" style="background:var(--bg-elevated); color:var(--text-secondary); font-size:0.6rem; padding:2px 4px; margin-left:4px;">${ex.saveMode === 'ok' ? 'UP↑' : '維持→'}</span>` : '';
      const noteHtml = ex.note ? `<div class="text-xs text-muted mt-xs" style="padding-left:4px;">💡 ${ex.note}</div>` : '';
      exListHtml += `
        <div class="exercise-item" style="border-left:3px solid ${catColor}; cursor:pointer" onclick="openExerciseInput('${ex.machineId}', ${ex.id})">
          <div class="exercise-header">
            <span class="exercise-name">${getCategoryIcon(ex.category)} ${ex.machineName}${cameraBtn}${videoBtn}${modeBadge}</span>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); confirmDeleteExercise(${ex.id},${activeSessionId})" style="color:var(--danger);padding:4px">✕</button>
          </div>
          <div class="exercise-sets">${setsHtml}</div>
          ${noteHtml}
        </div>`;
    }

    activeHtml = `
      <div class="card session-active mb-lg" id="active-session-card">
        <div class="flex items-center justify-between mb-sm">
          <span class="text-sm font-bold">🟢 トレーニング中</span>
          <span class="text-xs text-muted">経過 <span class="timer-elapsed">00:00:00</span></span>
        </div>
        <div class="timer-block" id="session-timer">
          <div class="timer-remain-label">残り時間</div>
          <div class="timer-remain timer-safe">60:00</div>
          <div class="timer-progress"><div class="timer-progress-fill timer-safe" style="width:0%"></div></div>
          <div class="timer-meta">
            <div class="timer-start-adjust">
              <button class="btn-timer-adj" onclick="adjustStartTime(-1)" title="開始時刻を1分前へ">-1分</button>
              <span class="timer-start-time">${formatTime(session.startTime)}</span> 開始
              <button class="btn-timer-adj" onclick="adjustStartTime(1)" title="開始時刻を1分後へ">+1分</button>
            </div>
          </div>
        </div>
        <div class="text-sm mb-md">${exercises.length > 0 ? `${exercises.length}種目 記録済み` : 'まだ記録がありません'}</div>
        ${exListHtml}
        <div class="flex gap-sm mt-md" style="margin-right: 28px;">
          <button class="btn btn-primary btn-sm btn-pulse" onclick="showMachineSelect()" style="flex:2">＋ マシン記録</button>
          <button class="btn btn-secondary btn-sm" onclick="confirmEndSession()" style="flex:1">終了</button>
        </div>
      </div>`;
  } else {
    activeHtml = `
      <div class="mb-lg">
        <button class="btn btn-start" onclick="startNewSession()">
          💪 トレーニング開始
        </button>
      </div>`;
  }

  let recentHtml = '';
  if (recentSessions.length > 0) {
    recentHtml = `<div class="section-title">最近のセッション</div>`;
    for (const s of recentSessions) {
      if (s.id === activeSessionId) continue;
      const exs = await getExercisesBySession(s.id);
      const cats = [...new Set(exs.map(e => e.category))];
      const badges = cats.map(c => `<span class="badge badge-${c}">${getCategoryIcon(c)} ${getCategoryLabel(c)}</span>`).join('');
      const d = new Date(s.startTime);
      recentHtml += `
        <div class="history-item" onclick="showSessionDetail(${s.id})">
          <div class="history-date">
            <div class="history-day">${d.getDate()}</div>
            <div class="history-month">${d.getMonth()+1}月</div>
            <div class="history-dow">${getDayOfWeek(s.startTime)}</div>
          </div>
          <div class="history-info">
            <div class="history-title">${exs.length}種目${s.endTime ? ' · ' + getSessionDuration(s) : ''}</div>
            <div class="history-badges">${badges}</div>
          </div>
          <div class="machine-arrow">›</div>
        </div>`;
    }
  }

  let bodyHtml = '';
  if (latest) {
    bodyHtml = `
      <div class="section-title mt-lg">体組成（最新）</div>
      <div class="body-comp-card">
        <div class="body-comp-grid">
          ${latest.weight ? `<div><div class="body-comp-value">${latest.weight}</div><div class="body-comp-label">体重 kg</div></div>` : ''}
          ${latest.bodyFat ? `<div><div class="body-comp-value">${latest.bodyFat}</div><div class="body-comp-label">体脂肪率 %</div></div>` : ''}
          ${latest.muscleMass ? `<div><div class="body-comp-value">${latest.muscleMass}</div><div class="body-comp-label">筋肉量 kg</div></div>` : ''}
        </div>
        <div class="text-xs text-muted mt-sm text-center">${formatDate(latest.date)}</div>
      </div>`;
  }

  // ========================================
  // 持ち物チェックリスト & 会員証初期化
  // ========================================
  const dCheck = new Date();
  const padCheck = (n) => String(n).padStart(2, '0');
  const todayStr = `${dCheck.getFullYear()}-${padCheck(dCheck.getMonth() + 1)}-${padCheck(dCheck.getDate())}`;
  const lastChecklistDate = localStorage.getItem('checklist_date');
  if (lastChecklistDate !== todayStr) {
    // 日付が変わったらチェック状態をすべてクリア
    localStorage.setItem('checklist_date', todayStr);
    localStorage.setItem('checklist_states', JSON.stringify([]));
  }

  let checkedItems = [];
  try {
    checkedItems = JSON.parse(localStorage.getItem('checklist_states') || '[]');
  } catch (e) {
    checkedItems = [];
  }

  let checklistItems = JSON.parse(localStorage.getItem('custom_checklist') || 'null');
  if (!checklistItems) {
    // 既存ユーザー判定: 過去のトレーニングデータがあるかどうかで判別
    // (checklist_statesは毎回セットされるので判定に使えない)
    const hasExistingData = localStorage.getItem('last_session_id') || localStorage.getItem('member_id');
    if (hasExistingData) {
      // 既存ユーザー: 洗面用具類を含む旧デフォルトを維持
      checklistItems = ['靴', 'スマホ', 'スマホ充電', 'ワイヤレスイヤホン', 'タオル', '替靴下', '替下着', '替シャツ', '替ズボン', '洗面用具類', 'スマートウォッチ', '小銭', 'ドリンクボトル', 'ビニール袋', 'プロテイン飲む', 'ティッシュ / ウェットティッシュ'];
    } else {
      // 新規ユーザー: 洗面用具類なし
      checklistItems = ['靴', 'スマホ', 'スマホ充電', 'ワイヤレスイヤホン', 'タオル', '替靴下', '替下着', '替シャツ', '替ズボン', 'スマートウォッチ', '小銭', 'ドリンクボトル', 'ビニール袋', 'プロテイン飲む', 'ティッシュ / ウェットティッシュ'];
    }
    localStorage.setItem('custom_checklist', JSON.stringify(checklistItems));
  }

  const memberId = localStorage.getItem('member_id') || '';
  const memberIdDisplay = memberId
    ? `<div class="text-lg font-bold" style="color: var(--accent); font-family: monospace; letter-spacing: 1px; font-size: 1.4rem;">${memberId}</div>`
    : `<div class="text-xs" style="color: var(--accent); font-weight: bold; border: 1px dashed var(--accent); padding: 3px 8px; border-radius: 6px; margin-top: 2px;">未設定 (登録)</div>`;

  // 会員証・利用番号カードHTML
  const memberCardHtml = `
    <div class="card mb-md" onclick="editMemberId()" style="cursor: pointer; background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-card-hover) 100%); border: 1px solid var(--accent-glow); padding: 16px; display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-md);" title="タップして利用番号・記号を編集">
      <div>
        <div class="text-xs text-muted" style="letter-spacing: 1px;">MEMBERSHIP CARD</div>
        <div class="text-md font-bold mt-xs" style="color: var(--text-primary); font-size: 1.05rem;">利用番号・記号</div>
      </div>
      <div class="text-right">
        <div class="text-xs text-muted">受付番号 ✏️</div>
        ${memberIdDisplay}
      </div>
    </div>
  `;

  // チェックリストHTML
  let checklistRowsHtml = '';
  checklistItems.forEach((item, idx) => {
    const isChecked = checkedItems.includes(item);
    checklistRowsHtml += `
      <label class="flex items-center gap-sm py-xs" style="cursor: pointer; user-select: none; font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.03);">
        <input type="checkbox" class="checklist-item-check" data-item="${item}" ${isChecked ? 'checked' : ''} onchange="toggleChecklistItem(this)" style="width: 18px; height: 18px; accent-color: var(--accent);">
        <span style="color: ${isChecked ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${isChecked ? 'line-through' : 'none'};">${item}</span>
      </label>
    `;
  });

  const isChecklistOpen = localStorage.getItem('checklist_open') === '1';

  const checklistHtml = `
    <div class="card mb-md" style="padding: 0; overflow: hidden; border: 1px solid var(--border-color);">
      <div onclick="toggleChecklistAccordion()" class="flex items-center justify-between" style="padding: 12px 16px; background: var(--bg-secondary); cursor: pointer; user-select: none;">
        <span class="text-sm font-bold flex items-center gap-xs">🎒 持ち物チェックリスト <span id="checklist-progress-badge" class="badge" style="background: var(--accent-glow); color: var(--accent); font-size: 0.7rem; padding: 2px 6px;">${checkedItems.length}/${checklistItems.length}</span> <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); editChecklist()" style="padding:0; margin-left:4px;" title="編集">✏️</button></span>
        <span id="checklist-arrow" style="transform: ${isChecklistOpen ? 'rotate(90deg)' : 'rotate(0)'}; transition: transform 0.2s;">▶</span>
      </div>
      <div id="checklist-body" style="display: ${isChecklistOpen ? 'block' : 'none'}; padding: 12px 16px; background: var(--bg-card); max-height: 280px; overflow-y: auto;">
        ${checklistRowsHtml}
      </div>
    </div>
  `;

  const unverifiedBannerHtml = (window.GymneryFacility && window.GymneryFacility.isMachineVerified === false) ? `
    <div class="card mb-md" style="background: rgba(255, 152, 0, 0.08); border: 1.5px dashed #ff9800; padding: 12px 14px; border-radius: var(--radius-md);">
      <div class="flex items-center justify-between">
        <div style="font-size: 0.85rem; font-weight: bold; color: #ff9800;">⚠️ マシン設定は仮テンプレートです</div>
        <button class="btn btn-sm btn-secondary" onclick="showMachineManagementList()" style="font-size: 0.7rem; padding: 2px 8px; border-color: #ff9800; color: #ff9800;">設定する ›</button>
      </div>
      <p class="text-xs text-muted mt-xs" style="margin-bottom: 0; line-height: 1.4;">
        ${window.GymneryFacility.name}の実機マシンと重り刻みは未確認です。現場に合わせて設定画面から重りを設定してください。
      </p>
    </div>
  ` : '';

  main.innerHTML = `<div class="page">${unverifiedBannerHtml}${memberCardHtml}${checklistHtml}${activeHtml}${recentHtml}${bodyHtml}</div>`;

  if (activeSessionId) {
    const session = await getSession(activeSessionId);
    const timerContainer = document.getElementById('session-timer');
    if (timerContainer) startTimer(session.startTime, timerContainer);
  }
}

// ========================================
// セッション操作
// ========================================
async function startNewSession() {
  clearSessionDateCache();
  activeSessionId = await createSession();
  localStorage.setItem('activeSessionId', activeSessionId);
  showToast('トレーニング開始！💪', 'success');
  navigateTo('home');
}

function confirmEndSession() {
  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">トレーニング終了</div>
    <div class="input-group">
      <label class="input-label">メモ（任意）</label>
      <textarea class="input" id="session-note" placeholder="今日のトレーニングの感想など"></textarea>
    </div>
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">キャンセル</button>
      <button class="btn btn-primary" onclick="doEndSession()" style="flex:1">終了する</button>
    </div>
  `);
}

async function doEndSession() {
  clearSessionDateCache();
  const note = document.getElementById('session-note')?.value || '';
  await endSession(activeSessionId, note);
  const sid = activeSessionId;

  // 種目が0件のセッションは保存しない（削除する）
  const exerciseCount = await db.exercises.where('sessionId').equals(sid).count();
  if (exerciseCount === 0) {
    await deleteSession(sid);
    activeSessionId = null;
    localStorage.removeItem('activeSessionId');
    clearTimer();
    closeModal();
    showToast('種目が記録されなかったため、セッションを破棄しました', '');
    navigateTo('home');
    return;
  }

  activeSessionId = null;
  localStorage.removeItem('activeSessionId');
  clearTimer();
  closeModal();
  showToast('お疲れさまでした！🎉', 'success');
  showSessionDetail(sid);
  // Google Sheets 自動同期（設定がONの場合のみ）
  if (window.GymneryGSheets && window.GymneryGSheets.maybeAutoSync) {
    window.GymneryGSheets.maybeAutoSync().catch(e => console.warn('Sheets auto-sync:', e.message));
  }
}

// 直近3回の成長履歴（UP/STAY）バッジを取得するヘルパー関数
async function getPastThreeGrowthBadgesHtml(machineId) {
  const past = await getExercisesByMachine(machineId);
  if (!past || past.length === 0) return '';
  
  // 直近の最大3回分を取得して逆順（古い順）に並べる
  const recent = past.slice(0, 3).reverse();
  const badges = recent.map(ex => {
    if (!ex.saveMode) return '';
    const isOk = ex.saveMode === 'ok';
    const color = isOk ? '#4ecdc4' : 'var(--text-secondary)';
    const text = isOk ? 'UP↑' : '維持→';
    return `<span class="badge" style="color:${color}; background:${color}15; border:1px solid ${color}33; font-size:0.6rem; padding:1px 4px; border-radius:4px; font-weight:bold; font-family:var(--font-primary);">${text}</span>`;
  }).filter(b => b !== '').join(' ');

  return badges ? `<div style="display:flex; gap:3px; margin-top:2px;">${badges}</div>` : '';
}

// ========================================
// マシン選択
// ========================================
let currentMachineViewMode = 'recommended'; // 'recommended' or 'category'
let currentMachineSortOrder = 'newest';    // 'newest' or 'oldest'

async function showMachineSelect() {
  const catOrder = ['cardio', 'upper', 'lower', 'core', 'arm'];
  
  // 今日のセッションで実施済みのマシンIDと部位(カテゴリ)を取得
  const activeExs = activeSessionId ? await getExercisesBySession(activeSessionId) : [];
  const completedMachineIds = new Set(activeExs.map(e => e.machineId));
  const completedCategories = new Set(activeExs.map(e => {
    const machine = getMachineById(e.machineId);
    return machine ? machine.category : null;
  }).filter(c => c !== null));

  const now = new Date();

  // モーダルの基本構造を出力
  let html = `
    <div class="modal-handle"></div>
    <div class="flex items-center justify-between mb-md">
      <div class="modal-title" style="margin-bottom:0">マシン選択</div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:4px 12px;font-size:14px;color:var(--text-secondary)">✕ 閉じる</button>
    </div>
    
    <!-- タブ切り替えバー -->
    ${(window.GymneryFacility && window.GymneryFacility.isMachineVerified === false) ? `
      <div style="background:rgba(255,152,0,0.1); border:1px solid #ff9800; padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:10px; font-size:0.72rem; color:#ff9800; line-height:1.4;">
        ⚠️ マシン・重り設定は仮テンプレートです。現場と異なる場合は「設定 ＞ 設置マシン一覧」から重りを調整してください。
      </div>
    ` : ''}
    <div class="flex gap-xs mb-md" style="background:var(--bg-secondary); padding:4px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
      <button class="btn btn-sm ${currentMachineViewMode === 'recommended' ? 'btn-primary' : 'btn-ghost'}" onclick="changeMachineViewMode('recommended')" style="flex:1; border-radius:var(--radius-sm); font-size:0.8rem; font-weight:bold;">今日おすすめ (回復済)</button>
      <button class="btn btn-sm ${currentMachineViewMode === 'category' ? 'btn-primary' : 'btn-ghost'}" onclick="changeMachineViewMode('category')" style="flex:1; border-radius:var(--radius-sm); font-size:0.8rem; font-weight:bold;">部位別</button>
    </div>
  `;

  // 「今日おすすめ」モードの時のみソート切り替えボタンを表示
  if (currentMachineViewMode === 'recommended') {
    html += `
      <div class="flex items-center justify-between mb-sm" style="padding: 0 4px;">
        <span class="text-xs text-muted">過去に実施した回復済みの種目</span>
        <button class="btn btn-secondary btn-sm" onclick="toggleMachineSortOrder()" style="padding:4px 8px; font-size:0.75rem; border-radius:var(--radius-sm); font-weight:bold;">
          ${currentMachineSortOrder === 'newest' ? '📅 新しい順 ⬇' : '📅 古い順 ⬆'}
        </button>
      </div>
    `;
  }

  html += `<div style="max-height: 55vh; overflow-y: auto; padding-right: 4px;">`;

  let completedMachinesHtml = '';

  if (currentMachineViewMode === 'recommended') {
    // === 今日おすすめ（回復済＆過去に実施したことのある種目）ビュー ===
    const recommendedList = [];
    const machinesList = window.GymneryFacility?.machines || [];

    for (const m of machinesList) {
      // 実施済みのものは除外
      if (completedMachineIds.has(m.id)) {
        const past = await getExercisesByMachine(m.id);
        const lastDate = past && past.length > 0 ? await getExerciseDate(past[0]) : null;
        const badgesHtml = await getPastThreeGrowthBadgesHtml(m.id);
        
        let daysStr = '今日';
        const cameraBtn = m.image ? `<span onclick="event.stopPropagation(); showMachinePhoto('${m.id}', 'select')" style="cursor:pointer; font-size:1.0rem; padding: 4px; background:var(--bg-secondary); border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
        const cardHtml = `
          <div class="machine-card" onclick="openExerciseInput('${m.id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer; transition: 0.2s; opacity: 0.5; filter: grayscale(50%);">
            <div style="display: flex; align-items: center; gap: var(--space-sm);">
              <div class="machine-icon" style="background:${getCategoryColor(m.category)}22; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${getCategoryIcon(m.category)}</div>
              <div class="machine-info">
                <div class="machine-name" style="font-weight: bold; font-size: 0.95rem;">
                  ${m.name}
                  ${completedCategories.has(m.category) ? `<span style="font-size: 0.7rem; color: #ff9800; font-weight: normal; margin-left: 4px; display: inline-flex; align-items: center;" title="この部位は既に鍛えています">(！)部位済</span>` : ''}
                </div>
                ${badgesHtml}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${cameraBtn}
              <span class="badge" style="color: var(--text-secondary); background: var(--bg-elevated); border: 1px solid var(--border-color); font-size: 0.75rem; padding: 3px 8px; border-radius: 12px; font-weight: bold;">${daysStr}</span>
              <div class="machine-arrow" style="color: var(--text-secondary); font-size: 1.2rem;">›</div>
            </div>
          </div>
        `;
        completedMachinesHtml += cardHtml;
        continue;
      }

      const past = await getExercisesByMachine(m.id);
      if (!past || past.length === 0) continue; // 過去に一度もやったことがないものはここには出さない（部位別で選ぶ）

      const lastDate = await getExerciseDate(past[0]);
      const diffDays = getDaysDiff(now, lastDate);

      // 回復判定
      let isRecovered = false;
      let badgeColor = '#4ecdc4';

      if (m.category === 'upper' || m.category === 'arm') {
        isRecovered = diffDays >= 2;
        badgeColor = diffDays < 2 ? '#ff6b6b' : (diffDays === 2 ? '#ffe66d' : '#4ecdc4');
      } else if (m.category === 'lower') {
        isRecovered = diffDays >= 3;
        badgeColor = diffDays < 3 ? '#ff6b6b' : (diffDays === 3 ? '#ffe66d' : '#4ecdc4');
      } else if (m.category === 'core') {
        isRecovered = diffDays >= 1;
        badgeColor = diffDays < 1 ? '#ff6b6b' : (diffDays === 1 ? '#ffe66d' : '#4ecdc4');
      } else {
        isRecovered = true; // 有酸素は常に回復扱い
      }

      if (isRecovered) {
        recommendedList.push({
          machine: m,
          lastDate,
          diffDays,
          badgeColor
        });
      }
    }

    // ソート処理
    if (currentMachineSortOrder === 'newest') {
      recommendedList.sort((a, b) => b.lastDate - a.lastDate); // 新しい順
    } else {
      recommendedList.sort((a, b) => a.lastDate - b.lastDate); // 古い順
    }

    if (recommendedList.length > 0) {
      for (const item of recommendedList) {
        const m = item.machine;
        const daysStr = item.diffDays === 0 ? '今日' : (item.diffDays === 1 ? '昨日' : `中 ${item.diffDays - 1} 日`);
        const badgesHtml = await getPastThreeGrowthBadgesHtml(m.id);

        const cameraBtn = m.image ? `<span onclick="event.stopPropagation(); showMachinePhoto('${m.id}', 'select')" style="cursor:pointer; font-size:1.0rem; padding: 4px; background:var(--bg-secondary); border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
        html += `
          <div class="machine-card" onclick="openExerciseInput('${m.id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer; transition: 0.2s;">
            <div style="display: flex; align-items: center; gap: var(--space-sm);">
              <div class="machine-icon" style="background:${getCategoryColor(m.category)}22; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${getCategoryIcon(m.category)}</div>
              <div class="machine-info">
                <div class="machine-name" style="font-weight: bold; font-size: 0.95rem;">
                  ${m.name}
                  ${completedCategories.has(m.category) ? `<span style="font-size: 0.7rem; color: #ff9800; font-weight: normal; margin-left: 4px; display: inline-flex; align-items: center;" title="この部位は既に鍛えています">(！)部位済</span>` : ''}
                </div>
                ${badgesHtml}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${cameraBtn}
              <span class="badge" style="color: ${item.badgeColor}; background: ${item.badgeColor}15; border: 1px solid ${item.badgeColor}33; font-size: 0.75rem; padding: 3px 8px; border-radius: 12px; font-weight: bold;">${daysStr}</span>
              <div class="machine-arrow" style="color: var(--text-secondary); font-size: 1.2rem;">›</div>
            </div>
          </div>
        `;
      }
    } else {
      html += `
        <div class="empty-state" style="padding: 24px 16px;">
          <div class="empty-icon" style="font-size:2rem; margin-bottom:8px;">🥗</div>
          <div class="empty-text" style="font-size:0.85rem;">本日おすすめ（回復済み）の過去実施種目はありません。部位別から選択してください。</div>
        </div>
      `;
    }

  } else {
    // === 部位別（カテゴリ）ビュー (従来の表示順) ===
    for (const cat of catOrder) {
      const machines = getMachinesByCategory(cat);
      let categoryHasActiveMachines = false;
      
      let categoryHtml = `
        <div class="category-section" style="margin-bottom: var(--space-md);">
          <div class="category-header" style="margin-bottom: var(--space-xs);">
            <span class="category-icon">${getCategoryIcon(cat)}</span>
            <span class="category-label" style="color:${getCategoryColor(cat)}; font-weight: bold;">${getCategoryLabel(cat)}</span>
          </div>`;

      for (const m of machines) {
        const past = await getExercisesByMachine(m.id);
        const badgesHtml = await getPastThreeGrowthBadgesHtml(m.id);
        let daysStr = '初実施';
        let badgeColor = '#4ecdc4';
        let badgeBg = '#4ecdc415';

        if (past && past.length > 0) {
          const lastDate = await getExerciseDate(past[0]);
          const diffDays = getDaysDiff(now, lastDate);
          
          daysStr = diffDays === 0 ? '今日' : (diffDays === 1 ? '昨日' : `中 ${diffDays - 1} 日`);

          if (cat === 'upper' || cat === 'arm') {
            badgeColor = diffDays < 2 ? '#ff6b6b' : (diffDays === 2 ? '#ffe66d' : '#4ecdc4');
          } else if (cat === 'lower') {
            badgeColor = diffDays < 3 ? '#ff6b6b' : (diffDays === 3 ? '#ffe66d' : '#4ecdc4');
          } else if (cat === 'core') {
            badgeColor = diffDays < 1 ? '#ff6b6b' : (diffDays === 1 ? '#ffe66d' : '#4ecdc4');
          }
          badgeBg = `${badgeColor}15`;
        }

        const cameraBtn = m.image ? `<span onclick="event.stopPropagation(); showMachinePhoto('${m.id}', 'select')" style="cursor:pointer; font-size:1.0rem; padding: 4px; background:var(--bg-secondary); border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
        const cardHtml = `
          <div class="machine-card" onclick="openExerciseInput('${m.id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer; transition: 0.2s;">
            <div style="display: flex; align-items: center; gap: var(--space-sm);">
              <div class="machine-icon" style="background:${getCategoryColor(m.category)}22; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${getCategoryIcon(m.category)}</div>
              <div class="machine-info">
                <div class="machine-name" style="font-weight: bold; font-size: 0.95rem;">
                  ${m.name}
                  ${completedCategories.has(m.category) ? `<span style="font-size: 0.7rem; color: #ff9800; font-weight: normal; margin-left: 4px; display: inline-flex; align-items: center;" title="この部位は既に鍛えています">(！)部位済</span>` : ''}
                </div>
                ${badgesHtml}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${cameraBtn}
              <span class="badge" style="color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeColor}33; font-size: 0.75rem; padding: 3px 8px; border-radius: 12px; font-weight: bold;">${daysStr}</span>
              <div class="machine-arrow" style="color: var(--text-secondary); font-size: 1.2rem;">›</div>
            </div>
          </div>
        `;

        if (completedMachineIds.has(m.id)) {
          completedMachinesHtml += cardHtml.replace('machine-card"', 'machine-card" style="opacity: 0.5; filter: grayscale(50%);"');
        } else {
          categoryHtml += cardHtml;
          categoryHasActiveMachines = true;
        }
      }
      
      categoryHtml += `</div>`;
      if (categoryHasActiveMachines) {
        html += categoryHtml;
      }
    }
  }

  // 実施済みセクションの追加
  if (completedMachinesHtml) {
    html += `
      <div class="category-section" style="margin-top: var(--space-lg); border-top: 1px dashed var(--border-color); padding-top: var(--space-md);">
        <div class="category-header" style="margin-bottom: var(--space-xs);">
          <span class="category-icon">✅</span>
          <span class="category-label" style="color: var(--text-secondary); font-weight: bold;">本日の実施済み種目</span>
        </div>
        ${completedMachinesHtml}
      </div>
    `;
  }

  html += `</div>`;
  showModal(html);
}

// ビューモード切り替えハンドラ
function changeMachineViewMode(mode) {
  currentMachineViewMode = mode;
  showMachineSelect();
}

// ソート切り替えハンドラ
function toggleMachineSortOrder() {
  currentMachineSortOrder = currentMachineSortOrder === 'newest' ? 'oldest' : 'newest';
  showMachineSelect();
}

// ========================================
// エクササイズ入力
// ========================================

// ========================================
// マシン記録下書き＆マルチタスク管理
// ========================================
window.currentExerciseDraft = null;

function getExerciseFormData() {
  const container = document.getElementById('sets-container');
  const cardioContainer = document.getElementById('cardio-inputs');
  const noteEl = document.getElementById('machine-note');
  const note = noteEl ? noteEl.value : '';

  if (container) {
    const rows = container.querySelectorAll('.set-row');
    const sets = [];
    rows.forEach(row => {
      const set = {};
      row.querySelectorAll('input').forEach(inp => {
        const val = inp.type === 'number' ? (parseFloat(inp.value) || 0) : inp.value;
        set[inp.dataset.key] = val;
      });
      sets.push(set);
    });
    return { type: 'strength', data: sets, note };
  } else if (cardioContainer) {
    const data = {};
    cardioContainer.querySelectorAll('input').forEach(inp => {
      const key = inp.id.replace('field-', '');
      data[key] = inp.type === 'number' ? (parseFloat(inp.value) || 0) : inp.value;
    });
    return { type: 'cardio', data, note };
  }
  return null;
}

function saveExerciseDraft(machineId, editExerciseId = null, targetSessionId = null) {
  if (!machineId) {
    if (window.currentExerciseDraft) machineId = window.currentExerciseDraft.machineId;
    else return;
  }
  const form = getExerciseFormData();
  if (!form) return;

  window.currentExerciseDraft = {
    machineId,
    editExerciseId,
    targetSessionId,
    type: form.type,
    data: form.data,
    note: form.note,
    timestamp: Date.now()
  };
  try {
    localStorage.setItem('gymnery_exercise_draft', JSON.stringify(window.currentExerciseDraft));
  } catch (e) {}
  renderActiveExerciseBar();
}

function clearExerciseDraft() {
  window.currentExerciseDraft = null;
  try {
    localStorage.removeItem('gymnery_exercise_draft');
  } catch (e) {}
  renderActiveExerciseBar();
}

function minimizeExerciseInput() {
  const modal = document.querySelector('.modal-overlay');
  if (modal && modal.dataset.isExercise === 'true') {
    const machineId = modal.dataset.machineId;
    const editExerciseId = modal.dataset.editExerciseId && modal.dataset.editExerciseId !== 'null' ? Number(modal.dataset.editExerciseId) : null;
    const targetSessionId = modal.dataset.targetSessionId && modal.dataset.targetSessionId !== 'null' ? Number(modal.dataset.targetSessionId) : null;
    saveExerciseDraft(machineId, editExerciseId, targetSessionId);
    closeModal(true);
    showToast('休憩中（下部バーからいつでも再開できます）', 'info');
  } else {
    closeModal();
  }
}

function discardExerciseDraft() {
  if (confirm('この種目の入力を中止しますか？')) {
    clearLocalIntervalTimer();
    clearExerciseDraft();
    showToast('入力を中止しました', 'info');
  }
}

let floatingBarTimerInterval = null;

function renderActiveExerciseBar() {
  let bar = document.getElementById('active-exercise-floating-bar');
  
  // モーダルが開いている時はフローティングバーは非表示
  if (document.querySelector('.modal-overlay')) {
    if (bar && typeof bar.remove === 'function') bar.remove();
    if (floatingBarTimerInterval) { clearInterval(floatingBarTimerInterval); floatingBarTimerInterval = null; }
    return;
  }

  // 下書きのロード（未初期化ならlocalStorageから）
  if (!window.currentExerciseDraft) {
    try {
      const saved = localStorage.getItem('gymnery_exercise_draft');
      if (saved) window.currentExerciseDraft = JSON.parse(saved);
    } catch (e) {}
  }

  // 下書きもなくインターバルタイマーも動いていない場合はバー削除
  const isTimerRunning = intervalTimerEndTime && intervalTimerEndTime > Date.now();
  if (!window.currentExerciseDraft && !isTimerRunning) {
    if (bar && typeof bar.remove === 'function') bar.remove();
    if (floatingBarTimerInterval) { clearInterval(floatingBarTimerInterval); floatingBarTimerInterval = null; }
    return;
  }

  const draft = window.currentExerciseDraft || (intervalTimerMachineId ? { machineId: intervalTimerMachineId } : null);
  const machine = getMachineById(draft.machineId);
  if (!machine) {
    if (bar && typeof bar.remove === 'function') bar.remove();
    if (floatingBarTimerInterval) { clearInterval(floatingBarTimerInterval); floatingBarTimerInterval = null; }
    return;
  }

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'active-exercise-floating-bar';
    bar.className = 'active-exercise-floating-bar';
    document.body.appendChild(bar);
  }

  const updateBarContent = () => {
    const currentBar = document.getElementById('active-exercise-floating-bar');
    if (!currentBar) {
      if (floatingBarTimerInterval) { clearInterval(floatingBarTimerInterval); floatingBarTimerInterval = null; }
      return;
    }

    const now = Date.now();
    let timerBadge = '';
    let subText = '';

    if (intervalTimerEndTime && intervalTimerEndTime > now) {
      const remainMs = intervalTimerEndTime - now;
      const rM = Math.floor(remainMs / 60000);
      const rS = Math.floor((remainMs % 60000) / 1000);
      const timerStr = `${String(rM).padStart(2,'0')}:${String(rS).padStart(2,'0')}`;
      timerBadge = `<span class="badge" style="background:#ff6b6b; color:#fff; font-size:0.75rem; font-weight:bold; padding:2px 6px; animation:pulseIcon 1.5s infinite;">⏱️ ${timerStr}</span>`;
      subText = `<span style="color:#ff6b6b; font-weight:bold;">インターバル計測中</span> • タップして再開`;
    } else if (intervalTimerEndTime && intervalTimerEndTime <= now && (now - intervalTimerEndTime < 30000)) {
      timerBadge = `<span class="badge" style="background:#10b981; color:#fff; font-size:0.75rem; font-weight:bold; padding:2px 6px;">⏱️ 終了！</span>`;
      subText = `<span style="color:#10b981; font-weight:bold;">インターバル終了</span> • 次のセットへ`;
    } else {
      timerBadge = `<span class="badge" style="background:var(--accent)22; color:var(--accent); font-size:0.65rem; padding:1px 5px;">記録中</span>`;
      if (draft.type === 'strength' && Array.isArray(draft.data)) {
        subText = `${draft.data.length}セット入力中 • タップして再開`;
      } else {
        subText = '入力中 • タップして再開';
      }
    }

    currentBar.innerHTML = `
      <div class="floating-bar-info" onclick="openExerciseInput('${draft.machineId}', ${draft.editExerciseId ? draft.editExerciseId : 'null'}, ${draft.targetSessionId ? draft.targetSessionId : 'null'}, true)">
        <div class="floating-bar-icon">${getCategoryIcon(machine.category)}</div>
        <div class="floating-bar-text">
          <div class="floating-bar-title">
            <span>${machine.name}</span>
            ${timerBadge}
          </div>
          <div class="floating-bar-sub">${subText}</div>
        </div>
      </div>
      <div class="floating-bar-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); discardExerciseDraft()" style="color:var(--text-muted); font-size:0.85rem; padding:4px 8px;" title="入力を中止">✕</button>
      </div>
    `;
  };

  updateBarContent();

  if (intervalTimerEndTime && intervalTimerEndTime > Date.now()) {
    if (floatingBarTimerInterval) clearInterval(floatingBarTimerInterval);
    floatingBarTimerInterval = setInterval(updateBarContent, 500);
  }
}

async function openExerciseInput(machineId, editExerciseId = null, targetSessionId = null, isRestore = false) {
  const machine = getMachineById(machineId);
  closeModal(true);
  await new Promise(r => setTimeout(r, 150));

  let lastData = null;
  let lastNote = '';
  let resolvedSessionId = targetSessionId;
  if (!editExerciseId && !targetSessionId && activeSessionId) {
    resolvedSessionId = activeSessionId;
  }

  // 下書きがある場合は下書きデータを最優先で復元
  if (!window.currentExerciseDraft) {
    try {
      const saved = localStorage.getItem('gymnery_exercise_draft');
      if (saved) window.currentExerciseDraft = JSON.parse(saved);
    } catch (e) {}
  }

  const draft = window.currentExerciseDraft;
  const hasMatchingDraft = draft && draft.machineId === machineId && (editExerciseId ? draft.editExerciseId === editExerciseId : !draft.editExerciseId);

  if (hasMatchingDraft && (isRestore || draft.data)) {
    lastData = draft.data;
    lastNote = draft.note || '';
    if (draft.targetSessionId) resolvedSessionId = draft.targetSessionId;
  } else if (!isRestore) {
    // 最小化バーからの復元ではなく通常画面から開いた場合は古い下書きを破棄
    clearExerciseDraft();
  } else if (editExerciseId) {
    const db = new Dexie('TrainingRoomApp');
    db.version(1).stores({ exercises: '++id, sessionId, machineId, category, type, createdAt' });
    const ex = await db.exercises.get(editExerciseId);
    if (ex) {
      lastData = ex.data;
      lastNote = ex.note || '';
      resolvedSessionId = ex.sessionId;
    }
  } else {
    const setting = await getMachineSetting(machineId);
    if (setting && setting.data) {
      lastData = setting.data;
      lastNote = setting.note || '';
    } else {
      const pastExercises = await getExercisesByMachine(machineId);
      if (pastExercises.length > 0) {
        lastData = pastExercises[0].data;
        lastNote = pastExercises[0].note || '';
      }
    }
  }

  let timerHeaderHtml = '';
  if (activeSessionId && activeSessionId === resolvedSessionId) {
    timerHeaderHtml = `
      <div id="modal-timer-header" class="text-center" style="color:var(--accent); background:var(--bg-elevated); border-radius:var(--radius-sm); padding:10px; margin-bottom:12px; font-size:1.2rem; font-weight:800; border: 2px solid var(--accent-glow);">
        終了まで: <span id="modal-timer-display" style="font-variant-numeric: tabular-nums;">--:--</span>
      </div>`;
  }

  const badgesHtml = await getPastThreeGrowthBadgesHtml(machineId);

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:8px;">
      <button class="btn btn-ghost btn-sm" onclick="minimizeExerciseInput()" style="color:var(--accent); font-size:0.8rem; padding:4px 8px; font-weight:bold;">▼ 最小化 (他画面を見る)</button>
      <div class="modal-handle" style="margin:0;"></div>
      <button class="btn btn-ghost btn-sm" onclick="discardExerciseDraft();closeModal();" style="color:var(--text-muted); font-size:0.75rem; padding:4px 6px;">✕ 中止</button>
    </div>
    ${timerHeaderHtml}
    <div class="modal-title" style="display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 20px;">
      <div style="font-size:1.15rem; font-weight:bold;">${getCategoryIcon(machine.category)} ${machine.name}</div>
      ${badgesHtml}
    </div>`;

  if (machine.type === 'strength' && machine.hasSets) {
    let defaultSets = lastData && Array.isArray(lastData) ? lastData : [{}];
    // 新規作成で下書きでもない場合のみ1セット
    if (!editExerciseId && !hasMatchingDraft && defaultSets.length > 0) {
      defaultSets = [defaultSets[0]];
    }
    
    // 最小化中にインターバルタイマーが終了したのにセット未追加だった場合の安全リカバリー
    const intervalTriggered = localStorage.getItem('interval_timer_triggered');
    const intervalEndTime = Number(localStorage.getItem('interval_timer_end_time') || '0');
    const intervalMachine = localStorage.getItem('interval_timer_machine_id');
    if (intervalMachine === machineId && intervalEndTime > 0 && Date.now() >= intervalEndTime && intervalTriggered === '0') {
      localStorage.setItem('interval_timer_triggered', '1');
      if (defaultSets.length > 0) {
        const lastSet = defaultSets[defaultSets.length - 1];
        defaultSets.push({ ...lastSet });
      }
      clearLocalIntervalTimer();
      showToast('インターバルが終了したため、次のセットを追加しました ⏱', 'success');
    }
    html += `<div id="sets-container">`;
    defaultSets.forEach((s, i) => {
      html += renderSetRow(machine, i, s);
    });
    html += `</div>
      <div class="flex items-center gap-md mt-sm w-full">
        <button class="btn btn-secondary flex items-center justify-center" onclick="addSetRow('${machineId}')" style="width:42px; height:42px; border-radius:50%; padding:0; font-size:1.6rem; flex-shrink:0;">＋</button>
        <button class="btn btn-interval-highlight flex items-center justify-center" onclick="startIntervalTimer('${machineId}')" style="padding:0 20px; height:42px; font-size:0.95rem; flex-grow:1;">⏱️ ＋ インターバル</button>
      </div>
      <div id="interval-timer-container" class="card mt-md" style="display:none; align-items:center; justify-content:space-between; padding:12px 20px; border: 1.5px solid #ff6b6b;">
        <div id="interval-display" class="timer-safe" style="font-size:2.2rem; font-weight:800; font-variant-numeric: tabular-nums; line-height:1;">01:00</div>
        <button class="btn btn-interval-highlight btn-sm" onclick="addOneMinuteToInterval()" style="padding:8px 14px; border-radius:var(--radius-sm); font-weight:bold;">＋1分</button>
      </div>`;
  } else {
    // Cardio
    html += `<div id="cardio-inputs">`;
    for (const f of machine.fields) {
      const val = lastData ? (lastData[f.key] !== undefined ? lastData[f.key] : '') : '';
      html += `
        <div class="input-group">
          <label class="input-label">${f.label}</label>
          <div class="input-with-unit">
            <input class="input" type="${f.type}" id="field-${f.key}" value="${val}"
              step="${f.step || 1}" min="${f.min || 0}" placeholder="0" inputmode="decimal">
            ${f.unit ? `<span class="input-unit">${f.unit}</span>` : ''}
          </div>
        </div>`;
    }
    html += `</div>`;
  }

  if (lastData && !editExerciseId) {
    html += `<div class="text-xs text-muted mt-sm">💡 前回の記録を反映しています</div>`;
  }

  html += `
    <div class="mt-sm mb-md">
      <input type="text" id="machine-note" class="input" placeholder="ポジションや設定のメモ (例: シート5)" value="${lastNote}">
    </div>
  `;

  if (editExerciseId) {
    html += `
      <div class="flex gap-sm mt-lg">
        <button class="btn btn-secondary" onclick="minimizeExerciseInput();showSessionDetail(${resolvedSessionId})" style="flex:1">戻る (保持)</button>
        <button class="btn btn-primary" onclick="saveExercise('${machineId}', ${editExerciseId}, 'update')" style="flex:1">更新</button>
      </div>`;
  } else if (targetSessionId) {
    // 過去セッションへの新規追加モード
    html += `
      <div class="flex gap-sm mt-lg">
        <button class="btn btn-secondary" onclick="minimizeExerciseInput();showPastSessionMachineSelect(${targetSessionId})" style="flex:1">戻る (保持)</button>
        <button class="btn btn-primary" onclick="saveExercise('${machineId}', null, 'ok', ${targetSessionId})" style="flex:1">保存</button>
      </div>`;
  } else {
    // 通常の進行中セッション追加モード
    html += `
      <div class="flex gap-sm mt-lg flex-wrap">
        <button class="btn btn-secondary" onclick="minimizeExerciseInput();showMachineSelect()" style="flex:1; min-width: 80px;">戻る (保持)</button>
        <button class="btn btn-secondary" onclick="saveExercise('${machineId}', null, 'again')" style="flex:1; min-width: 80px; background:var(--bg-card-hover);">再度(維持)</button>
        <button class="btn btn-primary" onclick="saveExercise('${machineId}', null, 'ok')" style="flex:1; min-width: 80px;">OK(次回UP)</button>
      </div>`;
  }

  showModal(html, true, machineId, editExerciseId, targetSessionId);

  // セッションタイマーが動いていればモーダルの残り時間を即座に更新＆タイマー起動
  if (activeSessionId && activeSessionId === resolvedSessionId) {
    getSession(activeSessionId).then(session => {
      if (session && session.startTime) {
        const modalTimerEl = document.getElementById('modal-timer-display');
        if (modalTimerEl) {
          const SESSION_DURATION = 60 * 60 * 1000;
          const diff = Date.now() - new Date(session.startTime).getTime();
          const remain = SESSION_DURATION - diff;
          const isOvertime = remain <= 0;
          const absRemain = Math.abs(remain);
          const remainMinutes = Math.floor(absRemain / 60000);
          const remainSeconds = Math.floor((absRemain % 60000) / 1000);
          const remainStr = `${isOvertime ? '+' : ''}${String(remainMinutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
          modalTimerEl.textContent = remainStr;
          modalTimerEl.className = isOvertime ? 'urgency-critical' : remain <= 5 * 60 * 1000 ? 'urgency-danger' : remain <= 15 * 60 * 1000 ? 'urgency-warning' : 'urgency-normal';
        }
        // timerInterval が停止している場合は再開
        if (!timerInterval) {
          const dummyContainer = document.getElementById('session-timer') || document.createElement('div');
          startTimer(session.startTime, dummyContainer);
        }
      }
    });
  }

  // インターバルタイマーが稼働中の場合は、モーダル内のタイマー表示を即座に再起動・再バインド
  if (intervalTimerEndTime && intervalTimerMachineId === machineId) {
    const container = document.getElementById('interval-timer-container');
    if (container) {
      container.style.display = 'flex';
      startIntervalTimer(machineId, true);
    }
  }
}

function renderSetRow(machine, index, data = {}) {
  const fields = machine.fields.map(f => {
    let val = data[f.key] !== undefined ? data[f.key] : '';
    if (val === '' && f.key === 'reps') val = 10;
    if (f.type === 'text') {
      return `<div class="set-input">
        <input type="text" data-key="${f.key}" value="${val}" placeholder="${f.label}">
        <div class="set-input-label">${f.label}</div>
      </div>`;
    }
    if (f.key === 'weight') {
      const presets = machine.weights || [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
      const isCustom = val !== '' && val !== undefined && !presets.includes(Number(val));
      const options = presets.map(p => `<option value="${p}" ${Number(val) === p ? 'selected' : ''}>${p}</option>`).join('');
      return `<div class="set-input weight-input-group">
        <div style="display:flex; flex-direction: column; width:100%">
          <select class="input" style="display:${isCustom ? 'none' : 'block'}; width:100%; margin-bottom:4px;" onchange="if(this.value==='custom'){this.style.display='none';this.nextElementSibling.style.display='block';this.nextElementSibling.focus();this.nextElementSibling.value='';}else{this.nextElementSibling.value=this.value;}">
            <option value="">--</option>
            ${options}
            <option value="custom">任意入力...</option>
          </select>
          <input class="input" type="number" data-key="${f.key}" value="${isCustom ? val : (val||'')}" step="${f.step||1}" min="${f.min||0}" placeholder="0" inputmode="decimal" style="display:${isCustom ? 'block' : 'none'}; width:100%;" onblur="if(this.value===''){this.style.display='none';this.previousElementSibling.style.display='block';this.previousElementSibling.value='';}">
        </div>
        <div class="set-input-label">${f.label}${f.unit ? '('+f.unit+')' : ''}</div>
      </div>`;
    }
    return `<div class="set-input">
      <input type="number" data-key="${f.key}" value="${val}" step="${f.step||1}" min="${f.min||0}" placeholder="0" inputmode="decimal">
      <div class="set-input-label">${f.label}${f.unit ? '('+f.unit+')' : ''}</div>
    </div>`;
  }).join('');

  return `<div class="set-row" data-set="${index}">
    <div class="set-number">${index + 1}</div>
    ${fields}
    <button class="set-delete" onclick="removeSetRow(this)">✕</button>
  </div>`;
}


function addSetToDraft(machineId) {
  let draft = window.currentExerciseDraft;
  if (!draft) {
    try {
      const saved = localStorage.getItem('gymnery_exercise_draft');
      if (saved) draft = JSON.parse(saved);
    } catch (e) {}
  }
  if (!draft || draft.machineId !== machineId) return;

  const machine = getMachineById(machineId);
  if (!machine || machine.type !== 'strength') return;

  if (!Array.isArray(draft.data)) draft.data = [{}];
  
  // 最後のセット内容をコピー
  const lastSet = draft.data[draft.data.length - 1] || {};
  const newSet = { ...lastSet };
  draft.data.push(newSet);

  window.currentExerciseDraft = draft;
  try {
    localStorage.setItem('gymnery_exercise_draft', JSON.stringify(draft));
  } catch (e) {}

  renderActiveExerciseBar();
}

function addSetRow(machineId) {
  const machine = getMachineById(machineId);
  const container = document.getElementById('sets-container');
  const rows = container.querySelectorAll('.set-row');
  // Copy values from last row
  const lastRow = rows[rows.length - 1];
  const data = {};
  if (lastRow) {
    lastRow.querySelectorAll('input').forEach(inp => {
      data[inp.dataset.key] = inp.value;
    });
  }
  const div = document.createElement('div');
  div.innerHTML = renderSetRow(machine, rows.length, data);
  container.appendChild(div.firstElementChild);
}

function removeSetRow(btn) {
  const container = document.getElementById('sets-container');
  const rows = container.querySelectorAll('.set-row');
  if (rows.length <= 1) return;
  btn.closest('.set-row').remove();
  // Renumber
  container.querySelectorAll('.set-row').forEach((row, i) => {
    row.querySelector('.set-number').textContent = i + 1;
    row.dataset.set = i;
  });
}

async function saveExercise(machineId, editExerciseId = null, mode = 'ok', targetSessionId = null) {
  // 連打による重複保存を防止
  const buttons = document.querySelectorAll('.modal button, .modal input[type="button"]');
  buttons.forEach(b => { b.disabled = true; });

  const machine = getMachineById(machineId);
  let data;

  if (machine.type === 'strength' && machine.hasSets) {
    const rows = document.querySelectorAll('#sets-container .set-row');
    data = [];
    rows.forEach(row => {
      const set = {};
      row.querySelectorAll('input').forEach(inp => {
        const val = inp.type === 'number' ? (parseFloat(inp.value) || 0) : inp.value;
        set[inp.dataset.key] = val;
      });
      data.push(set);
    });
  } else {
    data = {};
    machine.fields.forEach(f => {
      const inp = document.getElementById(`field-${f.key}`);
      data[f.key] = f.type === 'number' ? (parseFloat(inp.value) || 0) : inp.value;
    });
  }

  const machineNote = document.getElementById('machine-note') ? document.getElementById('machine-note').value : '';

  let resolvedSessionId = targetSessionId || activeSessionId;

  if (editExerciseId) {
    const db = new Dexie('TrainingRoomApp');
    db.version(1).stores({ exercises: '++id, sessionId, machineId, category, type, createdAt' });
    const ex = await db.exercises.get(editExerciseId);
    if (ex) {
      resolvedSessionId = ex.sessionId; // 編集対象セッションIDを取得
    }
    await updateExercise(editExerciseId, data, machineNote);
    showToast(`${machine.name} を更新しました ✅`, 'success');
  } else {
    await addExercise(resolvedSessionId, machineId, data, mode, machineNote);
    showToast(`${machine.name} を記録しました ✅`, 'success');
    
    // 進行中のアクティブセッションのみ初期値更新ロジックを実行
    if (resolvedSessionId === activeSessionId) {
      let defaultData = JSON.parse(JSON.stringify(data));
      if (machine.type === 'strength' && machine.hasSets) {
        if (mode === 'ok' && machine.weights && defaultData.length > 0) {
          const isAssisted = machine.id.startsWith('assisted_') || (machine.fields && machine.fields.some(f => f.label === 'アシスト'));
          if (isAssisted) {
            // アシスト系マシンは「重りを減らす（自重に近づける）＝負荷UP」
            let currentWeight = defaultData[0].weight !== undefined ? defaultData[0].weight : 999;
            const idx = machine.weights.findIndex(w => w === currentWeight);
            if (idx > 0) {
              const nextWeight = machine.weights[idx - 1]; // より軽いアシストへ
              defaultData.forEach(s => { s.weight = nextWeight; });
            }
          } else {
            // 通常マシンは「重りを増やす＝負荷UP」
            let maxWeight = 0;
            defaultData.forEach(s => { if (s.weight > maxWeight) maxWeight = s.weight; });
            const idx = machine.weights.findIndex(w => w >= maxWeight);
            if (idx !== -1 && idx < machine.weights.length - 1) {
              const nextWeight = machine.weights[idx + 1];
              defaultData.forEach(s => {
                if (s.weight === maxWeight) s.weight = nextWeight;
              });
            }
          }
        }
        await saveMachineSetting(machineId, { data: [defaultData[0]], note: machineNote });
      } else {
        await saveMachineSetting(machineId, { data: defaultData, note: machineNote });
      }
    }
  }

  clearLocalIntervalTimer();
  clearExerciseDraft();
  closeModal();

  if (window.GymneryGSheets && window.GymneryGSheets.maybeAutoSync) {
    window.GymneryGSheets.maybeAutoSync();
  }

  if (editExerciseId || targetSessionId) {
    // 過去セッションの編集・追加時は詳細画面に戻る
    showSessionDetail(resolvedSessionId);
  } else {
    navigateTo('home');
  }
}

function startIntervalTimer(machineId, skipSchedule = false) {
  const container = document.getElementById('interval-timer-container');
  const display = document.getElementById('interval-display');
  
  if (!container || !display) return;
  
  container.style.display = 'flex';
  display.className = 'timer-safe';
  display.classList.remove('interval-flash');

  // 既存タイマーのクリーンアップ（連打対策）
  if (intervalTimerId) clearInterval(intervalTimerId);

  // 状態の初期化
  intervalTimerMachineId = machineId;

  if (!skipSchedule) {
    // 新規開始時のみ状態を保存し予約を送信
    releaseWakeLock();
    pushCancel('interval');

    // デフォルト1分(60秒)で開始
    intervalTimerEndTime = Date.now() + 60 * 1000;

    localStorage.setItem('interval_timer_end_time', String(intervalTimerEndTime));
    localStorage.setItem('interval_timer_machine_id', machineId);
    localStorage.setItem('interval_timer_triggered', '0');

    // VPSへPush予約送信（バッファ3秒を追加）
    pushSchedule(intervalTimerEndTime + 3000, 'interval');
  }

  // Wake Lock 取得（スリープ防止）
  requestWakeLock();
  
  let hasTriggeredEnd = localStorage.getItem('interval_timer_triggered') === '1';
  const audio = ensureIntervalBeepAudio();

  const updateDisplay = () => {
    const remainMs = intervalTimerEndTime - Date.now();
    
    if (remainMs <= 0) {
      // タイムアップ時（最初の一度だけアラートと行追加を実行）
      if (!hasTriggeredEnd) {
        // アプリがバックグラウンドにいる場合は、フロントエンドのタイムアップ処理を行わず、
        // サーバーからの Web Push 通知と、復帰時の復元処理（restoreIntervalTimer）に委ねる
        if (document.hidden) return;

        hasTriggeredEnd = true;
        localStorage.setItem('interval_timer_triggered', '1');
        pushCancel('interval'); // フォアグラウンドでタイムアップしたので通知をキャンセル

        // 🔔 音声アラート（iOSサイレントスイッチでも鳴る）
        // タイムアップ予定時刻から3秒以上経過した後の復帰（バックグラウンドから戻ってきた時など）の場合は音を鳴らさない
        const isRestoredFromBackground = (Date.now() - intervalTimerEndTime) > 3000;
        if (!isRestoredFromBackground) {
          audio.currentTime = 0;
          audio.play().catch(() => {
            // フォールバック: Web Audio oscillator
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              osc.frequency.value = 880;
              osc.connect(ctx.destination);
              osc.start();
              setTimeout(() => osc.stop(), 500);
            } catch (e) {}
          });

          // 📳 バイブレーション（Android用、既存動作維持）
          if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
        }

        // ✨ 視覚フラッシュ + トースト
        display.classList.add('interval-flash');
        showToast('インターバル終了 ⏱', '');

        const setsContainer = document.getElementById('sets-container');
        if (setsContainer) {
          addSetRow(machineId);
        } else {
          addSetToDraft(machineId);
        }
      }
      
      // カウントアップ表示
      display.className = 'timer-danger';
      const elapsedMs = Math.abs(remainMs);
      const eM = Math.floor(elapsedMs / 60000);
      const eS = Math.floor((elapsedMs % 60000) / 1000);
      display.textContent = `+${String(eM).padStart(2,'0')}:${String(eS).padStart(2,'0')}`;
      return;
    }
    
    const rM = Math.floor(remainMs / 60000);
    const rS = Math.floor((remainMs % 60000) / 1000);
    display.textContent = `${String(rM).padStart(2,'0')}:${String(rS).padStart(2,'0')}`;
    
    if (remainMs <= 10000) display.className = 'timer-danger';
    else if (remainMs <= 30000) display.className = 'timer-warning';
    else display.className = 'timer-safe';
  };
  
  updateDisplay();
  intervalTimerId = setInterval(updateDisplay, 250);
}

function addOneMinuteToInterval() {
  if (intervalTimerId && intervalTimerMachineId) {
    intervalTimerEndTime += 60 * 1000;
    localStorage.setItem('interval_timer_end_time', String(intervalTimerEndTime));
    // もしすでにタイムアップしていた場合はトリガーフラグをリセット
    localStorage.setItem('interval_timer_triggered', '0');
    showToast('インターバルを1分追加しました ⏲️', 'success');
    pushCancel('interval');
    pushSchedule(intervalTimerEndTime + 3000, 'interval'); // 予約時間を更新
    
    // 表示更新のためタイマーを再セット
    startIntervalTimer(intervalTimerMachineId, true);
  }
}

// ========================================
// モーダル管理
// ========================================
function showModal(contentHtml, isExercise = false, machineId = null, editExerciseId = null, targetSessionId = null) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  if (isExercise) {
    overlay.dataset.isExercise = 'true';
    if (machineId) overlay.dataset.machineId = machineId;
    if (editExerciseId) overlay.dataset.editExerciseId = String(editExerciseId);
    if (targetSessionId) overlay.dataset.targetSessionId = String(targetSessionId);
  }
  overlay.innerHTML = `<div class="modal">${contentHtml}</div>`;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      if (isExercise) {
        minimizeExerciseInput();
      } else {
        closeModal();
      }
    }
  });
  document.body.appendChild(overlay);
  renderActiveExerciseBar();
}

function closeModal(skipDraftClear = false) {
  // 注意: インターバルタイマーは最小化中も継続動作させるため、ここではクリアしない

  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();

  renderActiveExerciseBar();
}


// ========================================
// セッション詳細
// ========================================
async function showSessionDetail(sessionId) {
  const session = await getSession(sessionId);
  if (session && session.startTime) {
    lastViewedSessionId = sessionId;
    lastViewedSessionDate = new Date(session.startTime);
    calendarDate = new Date(lastViewedSessionDate.getFullYear(), lastViewedSessionDate.getMonth(), 1);
  }
  const exercises = await getExercisesBySession(sessionId);
  const main = document.getElementById('main-content');

  let exHtml = '';
  for (const ex of exercises) {
    const machine = getMachineById(ex.machineId);
    const catColor = getCategoryColor(ex.category);

    if (ex.type === 'strength' && Array.isArray(ex.data)) {
      let setsHtml = '';
      ex.data.forEach((s, i) => {
        const exerciseLabel = s.exercise ? ` (${s.exercise})` : '';
        setsHtml += `
          <span class="exercise-set-num">${i+1}</span>
          <span class="exercise-set-val">${s.weight || 0}kg</span>
          <span class="exercise-set-val">${s.reps || 0}回${exerciseLabel}</span>`;
      });
      const cameraBtn = (machine && machine.image) ? `<span onclick="event.stopPropagation(); showMachinePhoto('${ex.machineId}', 'detail:${sessionId}')" style="cursor:pointer; font-size:1.0rem; padding: 2px; margin-left: 6px; background:var(--bg-secondary); border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
      const videoBtn = (machine && machine.videoUrl) ? `<a href="${machine.videoUrl}" target="_blank" onclick="event.stopPropagation();" style="cursor:pointer; font-size:1.0rem; padding: 2px; margin-left: 6px; background:var(--bg-secondary); border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; text-decoration:none;" title="動画を見る">🎬</a>` : '';
      const modeBadge = ex.saveMode ? `<span class="badge" style="background:var(--bg-elevated); color:var(--text-secondary); font-size:0.6rem; padding:2px 4px; margin-left:4px;">${ex.saveMode === 'ok' ? 'UP↑' : '維持→'}</span>` : '';
      const noteHtml = ex.note ? `<div class="text-xs text-muted mt-xs" style="padding-left:4px;">💡 ${ex.note}</div>` : '';
      exHtml += `
        <div class="exercise-item" style="border-left:3px solid ${catColor}">
          <div class="exercise-header">
            <span class="exercise-name">${getCategoryIcon(ex.category)} ${ex.machineName}${cameraBtn}${videoBtn}${modeBadge}</span>
            <div style="display:flex; gap:4px;">
              <button class="btn btn-ghost btn-sm" onclick="openExerciseInput('${ex.machineId}', ${ex.id})" style="color:var(--info);padding:4px">✏️</button>
              <button class="btn btn-ghost btn-sm" onclick="confirmDeleteExercise(${ex.id},${sessionId})" style="color:var(--danger);padding:4px">✕</button>
            </div>
          </div>
          <div class="exercise-sets">${setsHtml}</div>
          ${noteHtml}
        </div>`;
    } else {
      let statsHtml = '';
      if (machine) {
        machine.fields.forEach(f => {
          if (ex.data[f.key]) {
            statsHtml += `<div class="exercise-cardio-stat">
              <span class="exercise-cardio-stat-value">${ex.data[f.key]}</span>
              <span class="exercise-cardio-stat-label">${f.label}${f.unit ? '('+f.unit+')' : ''}</span>
            </div>`;
          }
        });
        if (machine.id === 'treadmill' && ex.data.distance && ex.data.speed) {
          const calcDuration = Math.round((ex.data.distance / ex.data.speed) * 60);
          statsHtml += `<div class="exercise-cardio-stat">
            <span class="exercise-cardio-stat-value">${calcDuration}</span>
            <span class="exercise-cardio-stat-label">時間(分)</span>
          </div>`;
        }
      }
      const cameraBtn = (machine && machine.image) ? `<span onclick="event.stopPropagation(); showMachinePhoto('${ex.machineId}', 'detail:${sessionId}')" style="cursor:pointer; font-size:1.0rem; padding: 2px; margin-left: 6px; background:var(--bg-secondary); border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
      const videoBtn = (machine && machine.videoUrl) ? `<a href="${machine.videoUrl}" target="_blank" onclick="event.stopPropagation();" style="cursor:pointer; font-size:1.0rem; padding: 2px; margin-left: 6px; background:var(--bg-secondary); border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; text-decoration:none;" title="動画を見る">🎬</a>` : '';
      const modeBadge = ex.saveMode ? `<span class="badge" style="background:var(--bg-elevated); color:var(--text-secondary); font-size:0.6rem; padding:2px 4px; margin-left:4px;">${ex.saveMode === 'ok' ? 'UP↑' : '維持→'}</span>` : '';
      const noteHtml = ex.note ? `<div class="text-xs text-muted mt-xs" style="padding-left:4px;">💡 ${ex.note}</div>` : '';
      exHtml += `
        <div class="exercise-item" style="border-left:3px solid ${catColor}">
          <div class="exercise-header">
            <span class="exercise-name">${getCategoryIcon(ex.category)} ${ex.machineName}${cameraBtn}${videoBtn}${modeBadge}</span>
            <div style="display:flex; gap:4px;">
              <button class="btn btn-ghost btn-sm" onclick="openExerciseInput('${ex.machineId}', ${ex.id})" style="color:var(--info);padding:4px">✏️</button>
              <button class="btn btn-ghost btn-sm" onclick="confirmDeleteExercise(${ex.id},${sessionId})" style="color:var(--danger);padding:4px">✕</button>
            </div>
          </div>
          <div class="exercise-cardio-stats">${statsHtml}</div>
          ${noteHtml}
        </div>`;
    }
  }

  const d = new Date(session.startTime);
  main.innerHTML = `
    <div class="page">
      <button class="header-back mb-md" onclick="navigateTo('${currentPage === 'home' ? 'home' : 'history'}')">← 戻る</button>
      <div class="card mb-lg">
        <div class="flex items-center justify-between">
          <div class="text-sm text-muted">${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 (${getDayOfWeek(session.startTime)})</div>
          <button class="btn btn-ghost btn-sm" onclick="editSessionTimes(${sessionId})" style="padding:0; color:var(--info);">✏️ 編集</button>
        </div>
        <div class="flex items-center justify-between mt-sm">
          <div class="text-sm">${formatTime(session.startTime)}${session.endTime ? ' - ' + formatTime(session.endTime) : ' 〜'}</div>
          ${session.endTime ? `<div class="badge" style="background:var(--accent-glow);color:var(--accent)">${getSessionDuration(session)}</div>` : '<div class="badge" style="background:var(--accent-glow);color:var(--accent)">進行中</div>'}
        </div>
        ${session.note ? `<div class="text-sm text-muted mt-sm">📝 ${session.note}</div>` : ''}
      </div>
      <div class="section-title">${exercises.length}種目</div>
      ${exHtml || '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">記録がありません</div></div>'}
      <button class="btn btn-primary btn-block mb-md" onclick="showPastSessionMachineSelect(${sessionId})" style="margin-top: 16px;">＋ 種目を追加</button>
      <div class="flex gap-sm">
        <button class="btn btn-secondary btn-sm" onclick="exportSession(${sessionId})" style="flex:1">📥 CSV出力</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteSession(${sessionId})" style="flex:1">🗑 削除</button>
      </div>
    </div>`;
}

async function showPastSessionMachineSelect(sessionId) {
  const catOrder = ['cardio', 'upper', 'lower', 'core', 'arm'];
  const sessionExs = await getExercisesBySession(sessionId);
  const completedMachineIds = new Set(sessionExs.map(e => e.machineId));

  let html = `
    <div class="modal-handle"></div>
    <div class="flex items-center justify-between mb-md">
      <div class="modal-title" style="margin-bottom:0">過去セッションへの種目追加</div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:4px 12px;font-size:14px;color:var(--text-secondary)">✕ 閉じる</button>
    </div>
    <div style="max-height: 55vh; overflow-y: auto; padding-right: 4px;">
  `;

  catOrder.forEach(catKey => {
    const cat = window.GymneryFacility?.categories?.[catKey] || { label: catKey, icon: '🏋️', color: '#888' };
    const catMachines = getMachinesByCategory(catKey);
    if (catMachines.length === 0) return;

    html += `
      <div style="margin-top: 12px; margin-bottom: 8px; font-weight: bold; font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
        <span>${cat.icon}</span>
        <span>${cat.label}</span>
      </div>
    `;

    catMachines.forEach(m => {
      const isCompleted = completedMachineIds.has(m.id);
      const cameraBtn = m.image ? `<span onclick="event.stopPropagation(); showMachinePhoto('${m.id}', 'select')" style="cursor:pointer; font-size:1.0rem; padding: 4px; background:var(--bg-secondary); border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
      const videoBtn = m.videoUrl ? `<a href="${m.videoUrl}" target="_blank" onclick="event.stopPropagation();" style="cursor:pointer; font-size:1.0rem; padding: 4px; background:var(--bg-secondary); border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; text-decoration:none;" title="動画を見る">🎬</a>` : '';
      
      html += `
        <div class="machine-card" onclick="openExerciseInput('${m.id}', null, ${sessionId})" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer; transition: 0.2s; ${isCompleted ? 'opacity: 0.6;' : ''}">
          <div style="display: flex; align-items: center; gap: var(--space-sm);">
            <div class="machine-icon" style="background:${getCategoryColor(m.category)}22; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${getCategoryIcon(m.category)}</div>
            <div class="machine-info">
              <div class="machine-name" style="font-weight: bold; font-size: 0.95rem;">${m.name}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${cameraBtn}
            ${videoBtn}
            ${isCompleted ? `<span class="badge" style="color:var(--text-secondary); background:var(--bg-elevated); font-size:0.7rem; padding:3px 6px;">記録済</span>` : ''}
            <div class="machine-arrow" style="color: var(--text-secondary); font-size: 1.2rem;">›</div>
          </div>
        </div>
      `;
    });
  });

  html += `
    </div>
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary btn-block" onclick="closeModal();showSessionDetail(${sessionId})">戻る</button>
    </div>
  `;

  showModal(html);
}

async function exportSession(sessionId) {
  const csv = await exportSessionToCSV(sessionId);
  const session = await getSession(sessionId);
  downloadCSV(`training_${formatDate(session.startTime).replace(/\//g,'-')}.csv`, csv);
  showToast('CSVをダウンロードしました', 'success');
}

function confirmDeleteExercise(exerciseId, sessionId) {
  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">この記録を削除しますか？</div>
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">キャンセル</button>
      <button class="btn btn-danger" onclick="doDeleteExercise(${exerciseId},${sessionId})" style="flex:1">削除</button>
    </div>`);
}

async function doDeleteExercise(exerciseId, sessionId) {
  await deleteExercise(exerciseId);
  closeModal();
  showToast('記録を削除しました', 'success');

  if (window.GymneryGSheets && window.GymneryGSheets.maybeAutoSync) {
    window.GymneryGSheets.maybeAutoSync();
  }

  showSessionDetail(sessionId);
}

async function confirmDeleteSession(sessionId) {
  const isLinked = localStorage.getItem('gs_spreadsheet_id') && localStorage.getItem('gs_authed') === '1';
  let sheetsOptionHtml = '';
  
  // ローカルの種目数をチェック（0件＝同期エラーの可能性が高い）
  const localExCount = await db.exercises.where('sessionId').equals(sessionId).count();
  
  if (isLinked) {
    if (localExCount === 0) {
      // 種目0件の場合、スプシ削除はデフォルトOFF＋警告表示
      sheetsOptionHtml = `
        <div class="card mt-md" style="padding:10px 14px; background:rgba(255,107,107,0.1); border:1px solid rgba(255,107,107,0.3); border-radius:var(--radius-sm);">
          <p style="color:#ff6b6b; font-size:0.8rem; margin:0 0 6px;">⚠️ このセッションはローカルに種目データがありません（同期エラーの可能性）。スプレッドシート側には正しいデータが残っている場合があります。</p>
          <label class="flex items-center gap-xs" style="cursor: pointer; user-select: none; font-size: 0.85rem;">
            <input type="checkbox" id="delete-from-sheets-checkbox" style="width: 16px; height: 16px; accent-color: var(--danger);">
            <span style="color: var(--text-secondary);">☁️ Googleスプレッドシートからも削除する（注意）</span>
          </label>
        </div>
      `;
    } else {
      sheetsOptionHtml = `
        <label class="flex items-center gap-xs mt-md mb-xs" style="cursor: pointer; user-select: none; font-size: 0.85rem;">
          <input type="checkbox" id="delete-from-sheets-checkbox" checked style="width: 16px; height: 16px; accent-color: var(--danger);">
          <span style="color: var(--text-secondary);">☁️ Googleスプレッドシートからも削除する</span>
        </label>
      `;
    }
  }

  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">このセッションを削除しますか？</div>
    <p class="text-sm text-muted">関連するすべての記録も削除されます。</p>
    ${sheetsOptionHtml}
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">キャンセル</button>
      <button class="btn btn-danger" onclick="doDeleteSession(${sessionId})" style="flex:1">削除</button>
    </div>`);
}

async function doDeleteSession(sessionId) {
  const deleteFromSheets = document.getElementById('delete-from-sheets-checkbox')?.checked;

  if (sessionId === activeSessionId) {
    activeSessionId = null;
    localStorage.removeItem('activeSessionId');
    clearTimer();
  }
  await deleteSession(sessionId);
  closeModal();
  showToast('セッションを削除しました', 'success');
  navigateTo('history');

  if (deleteFromSheets && window.GymneryGSheets && window.GymneryGSheets.deleteSessionAndExercises) {
    window.GymneryGSheets.deleteSessionAndExercises(sessionId).catch(e => console.error('Delete sync failed:', e));
  }
}

async function editSessionTimes(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return;
  const dStart = new Date(session.startTime);
  const dEnd = session.endTime ? new Date(session.endTime) : null;
  
  const pad = (n) => String(n).padStart(2,'0');
  const dStr = `${dStart.getFullYear()}-${pad(dStart.getMonth()+1)}-${pad(dStart.getDate())}`;
  const tStartStr = `${pad(dStart.getHours())}:${pad(dStart.getMinutes())}`;
  const tEndStr = dEnd ? `${pad(dEnd.getHours())}:${pad(dEnd.getMinutes())}` : '';

  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">セッション編集</div>
    <div class="input-group">
      <label class="input-label">日付</label>
      <input type="date" class="input" id="edit-session-date" value="${dStr}">
    </div>
    <div class="input-group">
      <label class="input-label">開始時刻</label>
      <input type="time" class="input" id="edit-session-start" value="${tStartStr}">
    </div>
    <div class="input-group">
      <label class="input-label">終了時刻</label>
      <input type="time" class="input" id="edit-session-end" value="${tEndStr}">
    </div>
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">キャンセル</button>
      <button class="btn btn-primary" onclick="saveSessionTimes(${sessionId})" style="flex:1">保存</button>
    </div>
  `);
}

async function saveSessionTimes(sessionId) {
  const session = await getSession(sessionId);
  const dStr = document.getElementById('edit-session-date').value;
  const tStartStr = document.getElementById('edit-session-start').value;
  const tEndStr = document.getElementById('edit-session-end').value;
  
  if (dStr && tStartStr) {
    const startObj = new Date(`${dStr}T${tStartStr}:00`);
    let updateData = { startTime: startObj.toISOString() };
    if (tEndStr) {
      const endObj = new Date(`${dStr}T${tEndStr}:00`);
      updateData.endTime = endObj.toISOString();
    } else {
      updateData.endTime = null;
    }
    await db.sessions.update(sessionId, updateData);
    showToast('セッション時間を更新しました', 'success');
  }
  closeModal();
  showSessionDetail(sessionId);
}

function showAddPastSession() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2,'0');
  const dStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const tStartStr = `${pad(now.getHours()-1)}:00`;
  const tEndStr = `${pad(now.getHours())}:00`;

  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">過去の記録を追加</div>
    <div class="input-group">
      <label class="input-label">日付</label>
      <input type="date" class="input" id="add-session-date" value="${dStr}">
    </div>
    <div class="input-group">
      <label class="input-label">開始時刻</label>
      <input type="time" class="input" id="add-session-start" value="${tStartStr}">
    </div>
    <div class="input-group">
      <label class="input-label">終了時刻</label>
      <input type="time" class="input" id="add-session-end" value="${tEndStr}">
    </div>
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">キャンセル</button>
      <button class="btn btn-primary" onclick="doAddPastSession()" style="flex:1">作成</button>
    </div>
  `);
}

async function doAddPastSession() {
  const dStr = document.getElementById('add-session-date').value;
  const tStartStr = document.getElementById('add-session-start').value;
  const tEndStr = document.getElementById('add-session-end').value;
  
  if (dStr && tStartStr) {
    const startObj = new Date(`${dStr}T${tStartStr}:00`);
    const endObj = tEndStr ? new Date(`${dStr}T${tEndStr}:00`) : null;
    const id = await db.sessions.add({
      facility: window.GymneryFacility?.name || 'トレーニング室',
      startTime: startObj.toISOString(),
      endTime: endObj ? endObj.toISOString() : null,
      note: '',
    });
    showToast('過去のセッションを作成しました', 'success');
    closeModal();
    showSessionDetail(id);
  }
}

// ========================================
// 履歴画面
// ========================================
let currentHistoryTab = 'sessions'; // 'sessions' or 'machines'

async function renderHistory(main) {
  // タブ切り替え用の共通レイアウト
  main.innerHTML = `
    <div class="page">
      <div class="flex gap-xs sticky-history-tabs">
        <button id="tab-sessions" class="btn btn-sm ${currentHistoryTab === 'sessions' ? 'btn-primary' : 'btn-ghost'}" onclick="switchHistoryTab('sessions')" style="flex:1; border-radius:var(--radius-sm); font-size:0.7rem; padding:6px 2px;">セッション履歴</button>
        <button id="tab-machines" class="btn btn-sm ${currentHistoryTab === 'machines' ? 'btn-primary' : 'btn-ghost'}" onclick="switchHistoryTab('machines')" style="flex:1; border-radius:var(--radius-sm); font-size:0.7rem; padding:6px 2px;">種目履歴</button>
        <button id="tab-trainer" class="btn btn-sm ${currentHistoryTab === 'trainer' ? 'btn-primary' : 'btn-ghost'}" onclick="switchHistoryTab('trainer')" style="flex:1; border-radius:var(--radius-sm); font-size:0.7rem; padding:6px 2px;">🤖 AIトレーナー</button>
      </div>
      <div id="history-tab-content"></div>
    </div>`;

  if (currentHistoryTab === 'sessions') {
    await renderSessionsTab(document.getElementById('history-tab-content'));
  } else if (currentHistoryTab === 'machines') {
    await renderMachinesTab(document.getElementById('history-tab-content'));
  } else if (currentHistoryTab === 'trainer') {
    await renderTrainerTab(document.getElementById('history-tab-content'));
  }
}

async function switchHistoryTab(tab) {
  currentHistoryTab = tab;
  const main = document.getElementById('main-content');
  if (main) {
    await renderHistory(main);
  }
}

let calendarCollapsed = localStorage.getItem('calendar_collapsed') === '1';
let isScrollingToAnchor = false;

async function renderSessionsTab(container) {
  const sessions = await getAllSessions();
  const initialDate = calendarDate || new Date();
  let calendarHtml = renderCalendar(initialDate, sessions);
  let listHtml = '';
  let currentMonthHeader = '';

  for (const s of sessions) {
    if (s.id === activeSessionId && !s.endTime) continue;
    const exs = await getExercisesBySession(s.id);
    const cats = [...new Set(exs.map(e => e.category))];
    const badges = cats.map(c => `<span class="badge badge-${c}">${getCategoryIcon(c)} ${getCategoryLabel(c)}</span>`).join('');
    const d = new Date(s.startTime);
    
    const yearMonthStr = `${d.getFullYear()}年${d.getMonth()+1}月`;
    const monthId = `history-month-${d.getFullYear()}-${d.getMonth()+1}`;
    
    if (currentMonthHeader !== yearMonthStr) {
      currentMonthHeader = yearMonthStr;
      listHtml += `<div id="${monthId}" data-year="${d.getFullYear()}" data-month="${d.getMonth()+1}" class="history-month-section-header section-title" style="margin-top: 20px; margin-bottom: 10px; padding-top: 8px; padding-bottom: 4px; border-bottom: 2px solid var(--accent-glow); display: flex; align-items: center; justify-content: space-between;">
        <div style="display:flex; align-items:center; gap:6px;"><span>🗓️</span> <span>${yearMonthStr}</span></div>
      </div>`;
    }

    listHtml += `
      <div class="history-item" id="session-card-${s.id}" onclick="showSessionDetail(${s.id})" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer;">
        <div class="history-date" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 50px; border-right: 1px solid var(--border-color); padding-right: 8px; margin-right: 12px;">
          <div class="history-day" style="font-size: 1.25rem; font-weight: bold;">${d.getDate()}</div>
          <div class="history-month" style="font-size: 0.7rem; color: var(--text-secondary);">${d.getMonth()+1}月</div>
          <div class="history-dow" style="font-size: 0.65rem; color: var(--text-muted);">${getDayOfWeek(s.startTime)}</div>
        </div>
        <div class="history-info" style="flex: 1;">
          <div class="history-title" style="font-weight: bold; font-size: 0.95rem;">${exs.length}種目${s.endTime ? ' · ' + getSessionDuration(s) : ''}</div>
          <div class="history-badges" style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">${badges}</div>
        </div>
        <div class="machine-arrow" style="color: var(--text-secondary); font-size: 1.2rem;">›</div>
      </div>`;
  }

  container.innerHTML = `
    <!-- 固定表示されるカレンダーラッパー -->
    <div id="sticky-calendar-container-wrapper" class="sticky-calendar-wrapper">
      <div id="calendar-fold-content" class="calendar-foldable-content ${calendarCollapsed ? 'collapsed' : ''}">
        <div id="calendar-container">${calendarHtml}</div>
      </div>
      <button class="calendar-toggle-btn" onclick="toggleCalendarFold()">
        <span id="calendar-toggle-icon">${calendarCollapsed ? '▼ カレンダーを開く' : '▲ カレンダーを閉じる'}</span>
      </button>
    </div>
    
    <div class="flex gap-sm mb-lg" style="margin-top: 16px;">
      <button class="btn btn-secondary btn-sm" onclick="exportAll()" style="flex:1">📥 全データエクスポート</button>
      <button class="btn btn-primary btn-sm" onclick="showAddPastSession()" style="flex:1">＋ 手動追加</button>
    </div>
    <div class="section-title" style="margin-top:10px; margin-bottom:8px;">全セッション</div>
    <div id="history-sessions-list-container">
      ${listHtml || '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">まだ履歴がありません</div></div>'}
    </div>`;

  setTimeout(() => {
    setupStickyCalendarShadow();
    setupHistoryIntersectionObserver();

    // 過去セッション詳細を見て戻ってきた場合、そのカードの位置へスクロール復帰
    if (lastViewedSessionId) {
      const targetId = lastViewedSessionId;
      const card = document.getElementById(`session-card-${targetId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.transition = 'box-shadow 0.3s ease';
        card.style.boxShadow = '0 0 14px var(--accent)';
        setTimeout(() => { if (card) card.style.boxShadow = ''; }, 1500);
      }
    }
  }, 150);
}

async function renderTrainerTab(container) {
  const apiKey = localStorage.getItem('gemini_api_key') || '';
  if (!apiKey) {
    container.innerHTML = `
      <div class="card text-center animate-fade-in" style="padding: 24px;">
        <div style="font-size: 3rem; margin-bottom: 12px;">🤖</div>
        <div class="text-md font-bold mb-sm">AI専属トレーナー</div>
        <p class="text-xs text-muted mb-lg" style="line-height: 1.6;">
          これまでの全トレーニング履歴と最新の体組成データを分析し、あなた専用のトレーニング評価やアドバイスを提供します。<br>
          ご利用には <b>Gemini APIキー</b> の設定が必要です。
        </p>
        <button class="btn btn-primary btn-block" onclick="navigateTo('settings')">⚙️ 設定画面でAPIキーを登録する</button>
      </div>`;
    return;
  }

  const cachedAdvice = localStorage.getItem('gemini_last_advice');
  const cachedTime = localStorage.getItem('gemini_last_advice_time');
  let adviceHtml = '';
  if (cachedAdvice) {
    const timeStr = cachedTime ? new Date(Number(cachedTime)).toLocaleString() : '不明';
    adviceHtml = `
      <div class="card mt-md" style="line-height: 1.7; padding: 20px; border-left: 4px solid var(--accent);">
        <div class="flex justify-between items-center mb-md pb-xs" style="border-bottom: 1px solid var(--border-color);">
          <span class="text-xs font-bold text-accent">📋 前回のトレーナーアドバイス</span>
          <span class="text-xs text-muted" style="font-size:0.65rem;">取得日: ${timeStr}</span>
        </div>
        <div class="markdown-body text-xs text-primary" style="word-break: break-all;">
          ${parseSimpleMarkdown(cachedAdvice)}
        </div>
      </div>`;
  }

  const userGoal = localStorage.getItem('gemini_trainer_goal') || '';

  container.innerHTML = `
    <div class="card animate-fade-in" style="padding: 20px;">
      <div class="flex items-center gap-sm mb-md">
        <span style="font-size: 1.8rem;">💪</span>
        <div style="flex:1;">
          <div class="text-sm font-bold">AI専属トレーナーに相談</div>
          <p class="text-xs text-muted" style="font-size: 0.65rem;">これまでの全トレーニング履歴と前回の指導内容を基にアドバイスを生成します</p>
        </div>
      </div>
      
      <div class="input-group mb-md">
        <label class="input-label" style="font-size: 0.7rem; font-weight:bold;">🎯 あなたの目標・トレーナーへの要望（任意）</label>
        <textarea class="input text-xs" id="trainer-user-goal" 
          placeholder="例：3ヶ月で体脂肪率を3%落としたい / 胸と背中を大きくしたい / 運動不足や肩こりを解消したい" 
          onchange="localStorage.setItem('gemini_trainer_goal', this.value)"
          style="height: 60px; resize: none; font-size: 0.75rem; border-color: var(--border-color);">${userGoal}</textarea>
      </div>
      
      <div id="trainer-actions">
        <button class="btn btn-primary btn-block btn-sm" onclick="generateTrainerAdvice()">🔥 アドバイスを生成する (無料)</button>
      </div>
      
      <div id="trainer-loading" style="display:none; text-align:center; padding: 24px 0;">
        <div class="spinner mb-sm" style="margin: 0 auto; width:32px; height:32px; border:3px solid var(--border-color); border-top-color:var(--accent); border-radius:50%; animation: spin 1s linear infinite;"></div>
        <div class="text-xs text-accent font-bold" id="trainer-loading-status">トレーニング履歴を解析中...</div>
      </div>
    </div>
    <div id="trainer-result-container">${adviceHtml}</div>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
      .markdown-body h3 { font-size: 0.9rem; font-weight: 800; color: var(--accent); margin: 16px 0 8px 0; border-bottom: 1px dashed var(--border-color); padding-bottom: 4px; }
      .markdown-body h3:first-child { margin-top: 0; }
      .markdown-body p { margin-bottom: 8px; line-height: 1.6; }
      .markdown-body ul { margin-left: 16px; margin-bottom: 8px; list-style-type: disc; }
      .markdown-body li { margin-bottom: 4px; }
      .markdown-body strong { color: var(--text-accent); font-weight: bold; }
    </style>`;
}

function parseSimpleMarkdown(markdown) {
  if (!markdown) return '';
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^###\s+(.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>')
    .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');

  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  html = html.split('\n\n').map(p => {
    if (p.trim().startsWith('<h3>') || p.trim().startsWith('<ul>') || p.trim().startsWith('<li>')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

async function generateTrainerAdvice() {
  const apiKey = localStorage.getItem('gemini_api_key') || '';
  if (!apiKey) return;

  const btnContainer = document.getElementById('trainer-actions');
  const loadingContainer = document.getElementById('trainer-loading');
  const loadingStatus = document.getElementById('trainer-loading-status');
  const resultContainer = document.getElementById('trainer-result-container');

  if (btnContainer && loadingContainer) {
    btnContainer.style.display = 'none';
    loadingContainer.style.display = 'block';
  }

  try {
    loadingStatus.textContent = '全トレーニング履歴を収集中... 📊';
    const allSessions = await getAllSessions();
    
    // 完了している全セッションを取得（過去30日制限を撤廃して全期間）
    const targetSessions = allSessions.filter(s => {
      if (s.id === activeSessionId && !s.endTime) return false;
      return true;
    });

    // 日時昇順（古い順）に並べて成長軌跡をAIが分析できるようにする
    targetSessions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    if (targetSessions.length === 0) {
      throw new Error('完了したトレーニング履歴が見つかりません。まずはトレーニングを記録してください。');
    }

    loadingStatus.textContent = '詳細データを解析中... 🔍';
    let sessionsPromptText = '';
    for (const s of targetSessions) {
      const exs = await getExercisesBySession(s.id);
      const dateStr = new Date(s.startTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
      sessionsPromptText += `■ セッション日時: ${dateStr}\n`;
      sessionsPromptText += `施設: ${s.facility || window.GymneryFacility?.name || 'トレーニング室'}\n`;
      if (s.note) sessionsPromptText += `セッション全体の感想・メモ: ${s.note}\n`;
      sessionsPromptText += `実施した種目:\n`;
      
      for (const ex of exs) {
        const machine = getMachineById(ex.machineId);
        const categoryLabel = getCategoryLabel(ex.category);
        if (machine?.type === 'strength' && Array.isArray(ex.data)) {
          const setsStr = ex.data.map((set, idx) => {
            const exName = set.exercise ? ` (${set.exercise})` : '';
            return `  - ${idx + 1}セット目: ${set.weight || 0}kg x ${set.reps || 0}回${exName}`;
          }).join('\n');
          sessionsPromptText += `- [${categoryLabel}] ${ex.machineName || (machine ? machine.name : ex.machineId)}:\n${setsStr}\n`;
        } else if (machine?.type === 'cardio') {
          // マシンごとのフィールド構成に合わせて動的にテキスト化
          const fieldsText = machine.fields ? machine.fields.map(f => {
            const val = ex.data[f.key] !== undefined ? ex.data[f.key] : '0';
            return `${f.label}: ${val}${f.unit || ''}`;
          }).join(', ') : '';
          sessionsPromptText += `- [${categoryLabel}] ${ex.machineName || (machine ? machine.name : ex.machineId)}: ${fieldsText}\n`;
        }
        // マシンの調整用メモ (ex.note) は除外
      }
      sessionsPromptText += '\n';
    }

    loadingStatus.textContent = '体組成データを取得中... ⚖️';
    const bodyCompList = await getAllBodyComposition();
    let bodyCompPromptText = 'なし';
    if (bodyCompList && bodyCompList.length > 0) {
      const latest = bodyCompList[0];
      bodyCompPromptText = `測定日: ${latest.date}, 体重: ${latest.weight || '未登録'}kg, 体脂肪率: ${latest.bodyFat || '未登録'}%, 筋肉量: ${latest.muscleMass || '未登録'}kg, BMI: ${latest.bmi || '未登録'}, 内臓脂肪レベル: ${latest.visceralFat || '未登録'}`;
    }

    loadingStatus.textContent = 'トレーナーが評価を作成中... 🧠';

    const userGoal = localStorage.getItem('gemini_trainer_goal') || '健康維持・ボディメイク（未設定）';

    const systemPrompt = `あなたは優秀なフィットネスの専属パーソナルトレーナーです。ユーザーのトレーニング履歴と最新の体組成データを分析し、専門的でありながら親しみやすく、モチベーションを高める評価と具体的なアドバイスを日本語で提供してください。
回答時の重要なルール：
1. 「〇〇さん」や「[ユーザー名]」などのダミーの三人称やプレースホルダー表現は、回答内で絶対に記述しないでください。
2. ユーザーに対しては、名前を呼ばずに二人称（あなた）または親しみやすい専属トレーナーとしての語り口調（例：「お疲れ様です！今日のトレーニングは〜」）で直接語りかけるように回答を作成してください。`;
    
    const cachedPreviousAdvice = localStorage.getItem('gemini_last_advice');
    let previousAdviceSection = '';
    if (cachedPreviousAdvice) {
      previousAdviceSection = `\n【前回のAIトレーナーからのアドバイス】\n${cachedPreviousAdvice}\n`;
    }

    const userPrompt = `以下のデータを分析し、専属トレーナーとして継続的で具体的なアドバイスを作成してください。

【ユーザーの目的・目標・要望】
${userGoal}

【最新の体組成データ】
${bodyCompPromptText}
${previousAdviceSection}
【これまでの全トレーニング履歴 (全${targetSessions.length}セッション・時系列)】
${sessionsPromptText}

【回答フォーマット】
以下の見出し（###）を使って、Markdown形式で出力してください。見出し以外の行には余分なマークダウン記号（*など）を使わずシンプルに説明してください。
※前回の指導内容がある場合は、その後のトレーニングでの変化や成長、アドバイスが実践できているかにも触れてください。

### 📊 トレーニング履歴の総評と成長
これまでの通算セッション数・頻度（ペース）、これまでの重量やセット数の推移（成長の傾向）、実施部位のバランスについての総評。

### 💪 良かったポイント・成長した点
これまでの記録から見える特に優れている点や重量・回数の向上、継続できている良い点。

### 🎯 今後のアドバイス・次回のメニュー改善
ユーザーの目標を踏まえた、次回のメニュー構成や強度の上げ方（プログレッシブ・オーバーロード）、部位バランスの調整や有酸素・休息のアドバイス。

### 💬 トレーナーからのメッセージ
ユーザーのモチベーションを引き出す力強い励ましのひと言。`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt + '\n\n' + userPrompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${response.status}`);
    }

    const resData = await response.json();
    const adviceText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!adviceText) {
      throw new Error('Gemini APIからの応答が空でした。');
    }

    localStorage.setItem('gemini_last_advice', adviceText);
    localStorage.setItem('gemini_last_advice_time', String(Date.now()));

    if (resultContainer) {
      resultContainer.innerHTML = `
        <div class="card mt-md" style="line-height: 1.7; padding: 20px; border-left: 4px solid var(--accent); animation: fadeSlideIn 0.3s ease;">
          <div class="flex justify-between items-center mb-md pb-xs" style="border-bottom: 1px solid var(--border-color);">
            <span class="text-xs font-bold text-accent">📋 最新のトレーナーアドバイス</span>
            <span class="text-xs text-muted" style="font-size:0.65rem;">取得日: ${new Date().toLocaleString()}</span>
          </div>
          <div class="markdown-body text-xs text-primary" style="word-break: break-all;">
            ${parseSimpleMarkdown(adviceText)}
          </div>
        </div>`;
    }

    showToast('アドバイスを生成しました！🤖', 'success');

  } catch (err) {
    console.error('Trainer advice generate failed:', err);
    showToast(err.message, 'danger');
  } finally {
    if (btnContainer && loadingContainer) {
      btnContainer.style.display = 'block';
      loadingContainer.style.display = 'none';
    }
  }
}

async function renderMachinesTab(container) {
  const now = new Date();
  
  // すべてのエクササイズ履歴を取得
  const exercises = await getAllExercises();
  for (const e of exercises) {
    e._resolvedDate = await getExerciseDate(e);
  }
  
  // マシンIDごとの最終実施日をマッピング
  const lastExecutionMap = new Map();
  exercises.forEach(e => {
    const date = e._resolvedDate;
    if (!lastExecutionMap.has(e.machineId) || date > lastExecutionMap.get(e.machineId)) {
      lastExecutionMap.set(e.machineId, date);
    }
  });

  const allMachines = window.GymneryFacility?.machines || [];
  
  // 筋肉グループ定義（筋肉別フィルタリング用）
  const muscleGroups = [
    { id: 'pectoralis', name: '大胸筋', machines: ['chest_press','fly','assisted_dips'] },
    { id: 'deltoid', name: '三角筋', machines: ['shoulder_press','chest_press'] },
    { id: 'trapezius', name: '僧帽筋', machines: ['lat_pulldown','assisted_chinning'] },
    { id: 'latissimus', name: '広背筋', machines: ['lat_pulldown','assisted_chinning'] },
    { id: 'biceps', name: '上腕二頭筋', machines: ['arm_curl','lat_pulldown','assisted_chinning'] },
    { id: 'triceps', name: '上腕三頭筋', machines: ['arm_extension','chest_press','assisted_dips','shoulder_press'] },
    { id: 'rectus_abdominis', name: '腹直筋', machines: ['abdominal','knee_raise'] },
    { id: 'obliques', name: '腹斜筋', machines: ['rotary_torso'] },
    { id: 'erector_spinae', name: '脊柱起立筋', machines: ['back_extension'] },
    { id: 'quadriceps', name: '大腿四頭筋', machines: ['leg_extension','leg_press'] },
    { id: 'hamstrings', name: 'ハムストリングス', machines: ['leg_curl','leg_press'] },
    { id: 'glutes', name: '大臀筋', machines: ['glute','abduction','leg_press'] },
    { id: 'adductors', name: '内転筋群', machines: ['adduction'] },
    { id: 'calves', name: '下腿三頭筋', machines: ['calf_raise'] },
  ];

  let selectedMuscle = null;
  if (window.machineHistoryFilterMuscle) {
    selectedMuscle = muscleGroups.find(mg => mg.id === window.machineHistoryFilterMuscle);
  }

  // フィルタリング
  let filteredMachines = allMachines.filter(m => {
    if (selectedMuscle) {
      return selectedMuscle.machines.includes(m.id);
    }
    if (window.machineHistoryFilterCategory && window.machineHistoryFilterCategory !== 'all') {
      return m.category === window.machineHistoryFilterCategory;
    }
    return true;
  });

  // 実施履歴があるマシンと未実施マシンに分けて、実施済みは「直近・新しい順」にソート
  const machineListWithDates = filteredMachines.map(m => {
    return {
      machine: m,
      lastDate: lastExecutionMap.get(m.id) || null
    };
  });

  machineListWithDates.sort((a, b) => {
    if (a.lastDate && b.lastDate) return b.lastDate - a.lastDate; // 新しい順
    if (a.lastDate) return -1;
    if (b.lastDate) return 1;
    return 0;
  });

  // カテゴリフィルターバーHTML
  const cats = [
    { id: 'all', label: 'すべて', icon: '📋' },
    { id: 'upper', label: '上半身', icon: '💪' },
    { id: 'lower', label: '下半身', icon: '🦵' },
    { id: 'core', label: '体幹', icon: '🧘' },
    { id: 'arm', label: '腕', icon: '🤜' },
    { id: 'cardio', label: '有酸素', icon: '🏃' },
  ];

  const filterChipsHtml = cats.map(c => {
    const isActive = (!selectedMuscle && window.machineHistoryFilterCategory === c.id);
    return `<button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}" onclick="setMachineHistoryCategoryFilter('${c.id}')" style="padding: 4px 10px; font-size: 0.72rem; border-radius: 16px; white-space: nowrap;">${c.icon} ${c.label}</button>`;
  }).join('');

  let activeFilterBadge = '';
  if (selectedMuscle) {
    activeFilterBadge = `
      <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-elevated); border:1px solid var(--accent); padding:6px 12px; border-radius:var(--radius-sm); margin-bottom:12px;">
        <span style="font-size:0.8rem; color:var(--accent); font-weight:bold;">🔍 筋肉絞り込み: ${selectedMuscle.name}</span>
        <button class="btn btn-ghost btn-sm" onclick="clearMachineHistoryMuscleFilter()" style="padding:2px 6px; font-size:0.75rem; color:var(--text-muted);">✕ 解除</button>
      </div>
    `;
  }

  let listHtml = '';
  for (const item of machineListWithDates) {
    const m = item.machine;
    let daysStr = '未実施';
    let badgeColor = 'var(--text-secondary)';
    let metaStr = 'まだ記録がありません';
    
    if (item.lastDate) {
      const diffDays = getDaysDiff(now, item.lastDate);
      if (diffDays === 0) daysStr = '今日';
      else if (diffDays === 1) daysStr = '昨日';
      else daysStr = `中 ${diffDays - 1} 日`;

      metaStr = `最終実施: ${item.lastDate.getMonth() + 1}月${item.lastDate.getDate()}日 (${getDayOfWeek(item.lastDate.toISOString())})`;

      if (m.category === 'upper' || m.category === 'arm') {
        badgeColor = diffDays < 2 ? '#ff6b6b' : (diffDays === 2 ? '#ffe66d' : '#4ecdc4');
      } else if (m.category === 'lower') {
        badgeColor = diffDays < 3 ? '#ff6b6b' : (diffDays === 3 ? '#ffe66d' : '#4ecdc4');
      } else if (m.category === 'core') {
        badgeColor = diffDays < 1 ? '#ff6b6b' : (diffDays === 1 ? '#ffe66d' : '#4ecdc4');
      } else {
        badgeColor = '#4ecdc4';
      }
    }

    const cameraBtn = m.image ? `<span onclick="event.stopPropagation(); showMachinePhoto('${m.id}')" style="cursor:pointer; font-size:1.0rem; padding: 4px; background:var(--bg-secondary); border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
    
    listHtml += `
      <div class="machine-card" onclick="showMachineHistoryModal('${m.id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer;">
        <div style="display: flex; align-items: center; gap: var(--space-sm); min-width:0; flex:1;">
          <div class="machine-icon" style="background:${getCategoryColor(m.category)}22; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; flex-shrink:0;">${getCategoryIcon(m.category)}</div>
          <div class="machine-info" style="min-width:0;">
            <div class="machine-name" style="font-weight: bold; font-size: 0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.name}</div>
            <div class="machine-meta" style="font-size: 0.72rem; color: var(--text-secondary); margin-top:2px;">${metaStr}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink:0; margin-left:8px;">
          ${cameraBtn}
          <span class="badge" style="color: ${badgeColor}; background: ${badgeColor}15; border: 1px solid ${badgeColor}33; font-size: 0.72rem; padding: 3px 8px; border-radius: 12px; font-weight: bold;">${daysStr}</span>
          <div class="machine-arrow" style="color: var(--text-secondary); font-size: 1.2rem;">›</div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; margin-bottom:10px;">
      ${filterChipsHtml}
    </div>
    ${activeFilterBadge}
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>種目履歴一覧 (最近実施した順)</span>
      <span class="text-xs text-muted">タップで全セット履歴表示</span>
    </div>
    <div style="margin-top:8px;">
      ${listHtml || '<div class="empty-state"><div class="empty-icon">🏋️</div><div class="empty-text">該当する種目がありません</div></div>'}
    </div>
  `;
}

let calendarDate = new Date();

function renderCalendar(date, sessions) {
  calendarDate = date;
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const sessionDates = new Map();
  sessions.forEach(s => {
    const d = new Date(s.startTime);
    if (d.getFullYear() === year && d.getMonth() === month) {
      sessionDates.set(d.getDate(), s.id);
    }
  });

  const labels = ['日','月','火','水','木','金','土'];
  let grid = labels.map(l => `<div class="calendar-day-label">${l}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    grid += `<div class="calendar-day other-month"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const sessionId = sessionDates.get(d);
    const hasSession = sessionId !== undefined;
    
    const clickAttr = hasSession ? ` onclick="showSessionDetail(${sessionId})"` : '';
    const cursorStyle = hasSession ? ' style="cursor: pointer;"' : '';
    
    grid += `<div class="calendar-day${isToday ? ' today' : ''}${hasSession ? ' has-session' : ''}"${clickAttr}${cursorStyle}>${d}</div>`;
  }

  return `
    <div class="calendar">
      <div class="calendar-header">
        <button class="btn btn-ghost btn-sm" onclick="changeCalendarMonth(-1)">‹</button>
        <span class="calendar-month">
          <span class="calendar-header-picker-trigger" onclick="showYearPicker()">${year}年</span>
          <span class="calendar-header-picker-trigger" onclick="showMonthPicker(${year})">${month + 1}月</span>
        </span>
        <button class="btn btn-ghost btn-sm" onclick="changeCalendarMonth(1)">›</button>
      </div>
      <div class="calendar-grid">${grid}</div>
    </div>`;
}

async function changeCalendarMonth(offset) {
  const newDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + offset, 1);
  const sessions = await getAllSessions();
  
  calendarDate = newDate;
  const container = document.getElementById('calendar-container');
  if (container) {
    container.innerHTML = renderCalendar(newDate, sessions);
  }
  
  // 逆連動ループを防ぐため、一時的にスクロール検知フラグをオンにする
  isScrollingToAnchor = true;
  
  const targetId = `history-month-${newDate.getFullYear()}-${newDate.getMonth() + 1}`;
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // スクロールアニメーションの完了（約400ms）を見計らってフラグをオフに戻す
    setTimeout(() => {
      isScrollingToAnchor = false;
    }, 500);
  } else {
    isScrollingToAnchor = false;
  }
}

async function exportAll() {
  const files = await exportAllDataToCSV();
  downloadMultipleCSV(files);
  showToast('全データをエクスポートしました', 'success');
}

// ========================================
// 統計画面
// ========================================
async function renderStats(main) {
  const sessions = await getAllSessions();
  const exercises = await getAllExercises();

  const totalSessions = sessions.filter(s => s.endTime).length;
  const thisMonth = sessions.filter(s => {
    const d = new Date(s.startTime);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.endTime;
  }).length;

  const uniqueMachines = new Set(exercises.map(e => e.machineId));
  const totalExercises = exercises.length;

  // Get machine usage stats
  const machineCount = {};
  exercises.forEach(e => {
    machineCount[e.machineId] = (machineCount[e.machineId] || 0) + 1;
  });
  const topMachines = Object.entries(machineCount)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5);

  // Weight machines for graph selection
  const strengthMachines = [...new Set(exercises.filter(e => e.type === 'strength').map(e => e.machineId))];

  let machineOptions = strengthMachines.map(id => {
    const m = getMachineById(id);
    return m ? `<option value="${id}">${m.name}</option>` : '';
  }).join('');

  main.innerHTML = `
    <div class="page">
      <!-- Muscle Recovery Map -->
      <div class="card mb-md">
        <div class="text-sm font-bold mb-md">🧍 筋肉リカバリーマップ</div>
        <div id="muscle-map-container" style="display:flex; justify-content:center; position:relative;">
          <!-- SVG is dynamically generated below -->
        </div>
        <div class="flex justify-center gap-md mt-xs text-xs" style="flex-wrap:wrap; gap:6px 10px;">
          <span style="display:flex; align-items:center; gap:3px;"><span style="display:inline-block; width:8px; height:8px; background:#ef4444; border-radius:50%;"></span>当日</span>
          <span style="display:flex; align-items:center; gap:3px;"><span style="display:inline-block; width:8px; height:8px; background:#f59e0b; border-radius:50%;"></span>回復中</span>
          <span style="display:flex; align-items:center; gap:3px;"><span style="display:inline-block; width:8px; height:8px; background:#10b981; border-radius:50%;"></span>回復済</span>
          <span style="display:flex; align-items:center; gap:3px;"><span style="display:inline-block; width:8px; height:8px; background:#374151; border-radius:50%;"></span>未実施</span>
        </div>
        <div id="muscle-detail-list" style="margin-top:6px;"></div>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalSessions}</div>
          <div class="stat-label">総セッション</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${thisMonth}</div>
          <div class="stat-label">今月</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${uniqueMachines.size}</div>
          <div class="stat-label">使用マシン種</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalExercises}</div>
          <div class="stat-label">総記録数</div>
        </div>
      </div>

      ${strengthMachines.length > 0 ? `
      <div class="section-title">重量推移 (複数選択可)</div>
      <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px; max-height: 150px; overflow-y: auto;">
        ${strengthMachines.map((id, idx) => {
          const m = getMachineById(id);
          if (!m) return '';
          // 最初の一つをデフォルトチェックする
          const checked = idx === 0 ? 'checked' : '';
          const cameraBtn = m.image ? `<span onclick="event.stopPropagation(); showMachinePhoto('${id}')" style="cursor:pointer; font-size:0.95rem; margin-left: 6px; padding: 2px;" title="写真を見る">📷</span>` : '';
          return `
            <label class="flex items-center gap-xs py-xs" style="cursor: pointer; user-select: none; font-size: 0.85rem;">
              <input type="checkbox" class="stats-machine-checkbox" value="${id}" ${checked} onchange="renderWeightChart()" style="width:16px; height:16px; accent-color: var(--accent);">
              <span style="color:${getCategoryColor(m.category)}">${getCategoryIcon(m.category)}</span>
              <span>${m.name}</span>
              ${cameraBtn}
            </label>
          `;
        }).join('')}
      </div>
      <div class="chart-container">
        <div class="chart-wrapper"><canvas id="weight-chart"></canvas></div>
      </div>` : ''}

      ${topMachines.length > 0 ? `
      <div class="section-title">よく使うマシン</div>
      <div class="chart-container">
        <div class="chart-wrapper"><canvas id="usage-chart"></canvas></div>
      </div>` : ''}
    </div>`;

  // Render charts
  renderMuscleMap();
  if (strengthMachines.length > 0) renderWeightChart();
  if (topMachines.length > 0) renderUsageChart(topMachines);
}

async function renderWeightChart() {
  const checkboxes = document.querySelectorAll('.stats-machine-checkbox:checked');
  const checkedMachineIds = Array.from(checkboxes).map(cb => cb.value);
  const ctx = document.getElementById('weight-chart');
  
  if (!ctx) return;

  if (checkedMachineIds.length === 0) {
    if (chartInstances['weight']) {
      chartInstances['weight'].destroy();
      delete chartInstances['weight'];
    }
    // 空の表示
    const canvasContext = ctx.getContext('2d');
    canvasContext.clearRect(0, 0, ctx.width, ctx.height);
    return;
  }

  // すべての選択されたマシンの記録データをロード
  const machineDataMap = new Map();
  const allDatesSet = new Set();

  for (const machineId of checkedMachineIds) {
    const exercises = await getExercisesByMachine(machineId);
    const sorted = [...exercises].reverse(); // 古い順（時系列）
    for (const e of sorted) { e._resolvedDate = await getExerciseDate(e); }
    machineDataMap.set(machineId, sorted);
    
    sorted.forEach(e => {
      const dateLabel = formatDate(e._resolvedDate).slice(5); // "MM/DD"
      allDatesSet.add(dateLabel);
    });
  }

  // 日付ラベルを時系列順にソート (MM/DD を昇順ソート)
  // 年またぎなどの処理を簡略化するため、作成日付（タイムスタンプ）で順序を決定します。
  const allExercises = [];
  for (const [id, list] of machineDataMap.entries()) {
    allExercises.push(...list);
  }
  allExercises.sort((a, b) => a._resolvedDate - b._resolvedDate);
  const uniqueDateLabels = [...new Set(allExercises.map(e => formatDate(e._resolvedDate).slice(5)))];

  // データセットを作成
  const datasets = checkedMachineIds.map((machineId, idx) => {
    const m = getMachineById(machineId);
    const sortedList = machineDataMap.get(machineId) || [];
    
    // 日付ごとの最大重量マップを作成
    const weightMapByDate = new Map();
    sortedList.forEach(e => {
      const dateLabel = formatDate(e._resolvedDate).slice(5);
      let maxWeight = 0;
      if (Array.isArray(e.data)) {
        maxWeight = Math.max(...e.data.map(s => s.weight || 0));
      }
      weightMapByDate.set(dateLabel, maxWeight);
    });

    // 共通の日付ラベル配列にマッピング（記録が無い日は null）
    const dataPoints = uniqueDateLabels.map(label => {
      return weightMapByDate.has(label) ? weightMapByDate.get(label) : null;
    });

    const color = m ? getCategoryColor(m.category) : '#00d4aa';

    return {
      label: m ? m.name : '重量 (kg)',
      data: dataPoints,
      borderColor: color,
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.4,
      spanGaps: true, // 記録が飛んでいる箇所を線でつなぐ
      pointBackgroundColor: color,
      pointBorderColor: '#0a0e17',
      pointBorderWidth: 1.5,
      pointRadius: 3,
    };
  });

  if (chartInstances['weight']) chartInstances['weight'].destroy();

  chartInstances['weight'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: uniqueDateLabels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#8892b0',
            boxWidth: 12,
            font: { size: 10 }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#5a6585', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#5a6585', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      }
    }
  });
}

function renderUsageChart(topMachines) {
  const labels = topMachines.map(([id]) => getMachineById(id)?.name || id);
  const data = topMachines.map(([,count]) => count);
  const colors = topMachines.map(([id]) => {
    const m = getMachineById(id);
    return m ? getCategoryColor(m.category) : '#888';
  });

  const ctx = document.getElementById('usage-chart');
  chartInstances['usage'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + '40'),
        borderColor: colors,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8892b0', font: { size: 11 }, padding: 12 }
        }
      }
    }
  });
}

// ========================================
// 体組成画面
// ========================================
async function renderBody(main) {
  const records = await getAllBodyComposition();

  let listHtml = '';
  for (const r of records) {
    listHtml += `
      <div class="body-comp-card" onclick="showBodyDetail(${r.id})">
        <div class="text-xs text-muted mb-sm">${formatDate(r.date)}</div>
        <div class="body-comp-grid">
          ${r.weight ? `<div><div class="body-comp-value">${r.weight}</div><div class="body-comp-label">体重 kg</div></div>` : '<div></div>'}
          ${r.bodyFat ? `<div><div class="body-comp-value">${r.bodyFat}</div><div class="body-comp-label">体脂肪率 %</div></div>` : '<div></div>'}
          ${r.muscleMass ? `<div><div class="body-comp-value">${r.muscleMass}</div><div class="body-comp-label">筋肉量 kg</div></div>` : '<div></div>'}
        </div>
      </div>`;
  }

  // Chart data
  const sorted = [...records].reverse();

  main.innerHTML = `
    <div class="page">
      <button class="btn btn-primary btn-block mb-lg" onclick="showBodyInput()">＋ 体組成を記録</button>
      ${sorted.length >= 2 ? `
      <div class="chart-container">
        <div class="chart-title">体重推移</div>
        <div class="chart-wrapper"><canvas id="body-weight-chart"></canvas></div>
      </div>
      <div class="chart-container">
        <div class="chart-title">体脂肪率推移</div>
        <div class="chart-wrapper"><canvas id="body-fat-chart"></canvas></div>
      </div>` : ''}
      <div class="section-title">記録一覧</div>
      ${listHtml || '<div class="empty-state"><div class="empty-icon">⚖️</div><div class="empty-text">まだ記録がありません</div></div>'}
    </div>`;

  if (sorted.length >= 2) {
    renderBodyCharts(sorted);
  }
}

function renderBodyCharts(sorted) {
  const labels = sorted.map(r => formatDate(r.date).slice(5));
  const weights = sorted.map(r => r.weight);
  const fats = sorted.map(r => r.bodyFat);

  const ctx1 = document.getElementById('body-weight-chart');
  if (ctx1) {
    chartInstances['bodyWeight'] = new Chart(ctx1, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '体重 (kg)', data: weights,
          borderColor: '#4ecdc4', backgroundColor: 'rgba(78,205,196,0.1)',
          fill: true, tension: 0.4, pointRadius: 4,
          pointBackgroundColor: '#4ecdc4', pointBorderColor: '#0a0e17', pointBorderWidth: 2,
        }]
      },
      options: chartOptions()
    });
  }

  const ctx2 = document.getElementById('body-fat-chart');
  if (ctx2) {
    chartInstances['bodyFat'] = new Chart(ctx2, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '体脂肪率 (%)', data: fats,
          borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.1)',
          fill: true, tension: 0.4, pointRadius: 4,
          pointBackgroundColor: '#ff6b6b', pointBorderColor: '#0a0e17', pointBorderWidth: 2,
        }]
      },
      options: chartOptions()
    });
  }
}

function chartOptions() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#5a6585', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#5a6585', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    }
  };
}

async function showBodyInput(existing = null) {
  const today = new Date().toISOString().split('T')[0];
  let defaults = existing;
  if (!defaults) {
    defaults = await getLatestBodyComposition() || {};
  }
  
  const stepBtn = (id) => `
    <div class="stepper-controls">
      <button type="button" class="btn-stepper" onclick="document.getElementById('${id}').stepDown()">-</button>
      <button type="button" class="btn-stepper" onclick="document.getElementById('${id}').stepUp()">+</button>
    </div>
  `;

  showModal(`
    <div class="modal-handle"></div>
    <div class="flex items-center justify-between mb-md">
      <div class="modal-title" style="margin-bottom:0">${existing ? '体組成を編集' : '体組成を記録'}</div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:4px 12px;font-size:14px;color:var(--text-secondary)">✕ 閉じる</button>
    </div>

    <!-- スマートインポートエリア -->
    <div id="body-smart-paste-area" style="border: 2px dashed var(--border-color); border-radius: var(--radius-md); padding: 16px; text-align: center; background: var(--bg-secondary); cursor: pointer; margin-bottom: var(--space-md); transition: 0.2s;" 
         onpaste="handleBodySmartPaste(event)" onclick="document.getElementById('body-smart-file-input').click()">
      <div id="body-paste-placeholder">
        <span style="font-size: 1.5rem; display: block; margin-bottom: 4px;">📥</span>
        <span style="font-size: 0.8rem; font-weight: bold; color: var(--text-primary); display: block;">Yolanda CSVテキスト・画像をペースト</span>
        <span style="font-size: 0.7rem; color: var(--text-muted);">またはタップして画像ファイルを選択</span>
      </div>
      <div id="body-paste-spinner" style="display:none; flex-direction:column; align-items:center; gap: 8px;">
        <div class="spinner" style="width: 24px; height: 24px; border: 3px solid var(--accent-glow); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span style="font-size: 0.75rem; color: var(--accent);">画像をAI解析中...</span>
      </div>
      <input type="file" id="body-smart-file-input" accept="image/*" style="display:none" onchange="handleBodySmartFileInput(event)">
    </div>

    <div class="input-group">
      <label class="input-label">日付</label>
      <input class="input" type="date" id="body-date" value="${existing?.date || today}">
    </div>
    <div class="input-group">
      <label class="input-label">体重</label>
      <div class="input-with-unit">
        <input class="input" type="number" id="body-weight" step="0.1" value="${defaults.weight || ''}" placeholder="0.0" inputmode="decimal">
        <span class="input-unit">kg</span>
        ${stepBtn('body-weight')}
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">体脂肪率</label>
      <div class="input-with-unit">
        <input class="input" type="number" id="body-fat" step="0.1" value="${defaults.bodyFat || ''}" placeholder="0.0" inputmode="decimal">
        <span class="input-unit">%</span>
        ${stepBtn('body-fat')}
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">筋肉量</label>
      <div class="input-with-unit">
        <input class="input" type="number" id="body-muscle" step="0.1" value="${defaults.muscleMass || ''}" placeholder="0.0" inputmode="decimal">
        <span class="input-unit">kg</span>
        ${stepBtn('body-muscle')}
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">BMI</label>
      <div class="input-with-unit">
        <input class="input" type="number" id="body-bmi" step="0.1" value="${defaults.bmi || ''}" placeholder="0.0" inputmode="decimal">
        ${stepBtn('body-bmi')}
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">内臓脂肪レベル</label>
      <div class="input-with-unit">
        <input class="input" type="number" id="body-visceral" step="0.5" value="${defaults.visceralFat || ''}" placeholder="0" inputmode="decimal">
        ${stepBtn('body-visceral')}
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">メモ</label>
      <textarea class="input" id="body-note" placeholder="メモ">${existing?.note || ''}</textarea>
    </div>
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">キャンセル</button>
      <button class="btn btn-primary" onclick="saveBodyComp(${existing?.id || 'null'})" style="flex:1">保存</button>
    </div>
  `);

  // ドラッグ＆ドロップでの画像ファイル受け入れ対応
  const dropZone = document.getElementById('body-smart-paste-area');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--accent)';
      dropZone.style.background = 'var(--bg-card-hover)';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'var(--border-color)';
      dropZone.style.background = 'var(--bg-secondary)';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
      dropZone.style.background = 'var(--bg-secondary)';
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        processBodySmartImage(files[0]);
      }
    });
  }
}

async function saveBodyComp(existingId) {
  const data = {
    date: document.getElementById('body-date').value,
    weight: parseFloat(document.getElementById('body-weight').value) || null,
    bodyFat: parseFloat(document.getElementById('body-fat').value) || null,
    muscleMass: parseFloat(document.getElementById('body-muscle').value) || null,
    bmi: parseFloat(document.getElementById('body-bmi').value) || null,
    visceralFat: parseFloat(document.getElementById('body-visceral').value) || null,
    note: document.getElementById('body-note').value,
  };

  if (existingId) {
    await updateBodyComposition(existingId, data);
  } else {
    await addBodyComposition(data);
  }
  closeModal();
  showToast('体組成を記録しました ✅', 'success');
  navigateTo('body');
}

// ========================================
// 体組成スマートインポート ハンドラ
// ========================================
function handleBodySmartPaste(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const clipboardData = event.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  // 1. 画像のペーストチェック
  for (const item of clipboardData.items) {
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile();
      processBodySmartImage(file);
      return;
    }
  }

  // 2. テキストのペーストチェック
  const text = clipboardData.getData('text');
  if (text) {
    parseBodySmartText(text);
  }
}

function handleBodySmartFileInput(event) {
  const files = event.target.files;
  if (files && files.length > 0) {
    processBodySmartImage(files[0]);
  }
}

// CSVテキスト等のパース
async function parseBodySmartText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return;

  const parseVal = (str) => {
    if (!str) return null;
    const clean = str.replace(/[Kk]g|%|kcal/g, '').trim();
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  };

  const parsedRecords = [];

  for (const line of lines) {
    // 最初の列が日付形式っぽいか確認
    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(line)) {
      const columns = line.split(/[\t,]/).map(c => c.trim());
      if (columns.length >= 3) {
        const rawDate = columns[0].split(' ')[0]; // 日付部分のみ
        const formattedDate = rawDate.replace(/\//g, '-');
        
        const weight = parseVal(columns[1]);
        const bmi = parseVal(columns[2]);
        const fat = parseVal(columns[3]);
        const visceral = parseVal(columns[5]);
        const muscle = parseVal(columns[8]);

        parsedRecords.push({
          date: formattedDate,
          weight,
          bodyFat: fat,
          muscleMass: muscle,
          bmi,
          visceralFat: visceral,
          note: 'CSVインポート'
        });
      }
    }
  }

  if (parsedRecords.length === 0) {
    showToast('貼り付けられたテキストから有効なデータ行が見つかりませんでした。', 'warning');
    return;
  }

  if (parsedRecords.length === 1) {
    // 1行のみの場合は入力フォームに入力値をセット
    const data = parsedRecords[0];
    if (document.getElementById('body-date')) document.getElementById('body-date').value = data.date;
    if (document.getElementById('body-weight')) document.getElementById('body-weight').value = data.weight || '';
    if (document.getElementById('body-fat')) document.getElementById('body-fat').value = data.bodyFat || '';
    if (document.getElementById('body-muscle')) document.getElementById('body-muscle').value = data.muscleMass || '';
    if (document.getElementById('body-bmi')) document.getElementById('body-bmi').value = data.bmi || '';
    if (document.getElementById('body-visceral')) document.getElementById('body-visceral').value = data.visceralFat || '';

    showToast('テキストからデータをパースして入力しました 📋', 'success');
  } else {
    // 複数行の場合は一括保存
    try {
      for (const rec of parsedRecords) {
        await addBodyComposition(rec);
      }
      closeModal();
      showToast(`${parsedRecords.length}件の体組成データを一括インポートしました 📋`, 'success');
      navigateTo('body');
    } catch (e) {
      console.error(e);
      showToast('一括インポート中にエラーが発生しました', 'danger');
    }
  }
}

// Yolanda画像OCRパース (Tesseract.js による完全ブラウザ側ローカルOCR)
async function processBodySmartImage(file) {
  const placeholder = document.getElementById('body-paste-placeholder');
  const spinner = document.getElementById('body-paste-spinner');
  
  if (placeholder && spinner) {
    placeholder.style.display = 'none';
    spinner.style.display = 'flex';
  }

  try {
    // 1. Tesseract.js の動的ロード
    if (typeof Tesseract === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/tesseract.js@5.1.0/dist/tesseract.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Tesseract.js のロードに失敗しました。インターネット接続を確認してください。'));
        document.head.appendChild(script);
      });
    }

    // 2. ローカルでのOCR実行
    const result = await Tesseract.recognize(file, 'eng+jpn', {
      logger: m => console.log('OCR Progress:', m.status, Math.round(m.progress * 100) + '%')
    });

    const text = result.data.text || '';
    console.log('OCR Parsed Text:\n', text);

    // 3. 基本的な正規表現パターンによる抽出（日本語・英語ラベル両対応）
    const extractNum = (patterns) => {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const val = parseFloat(match[1]);
          if (!isNaN(val)) return val;
        }
      }
      return null;
    };

    // Yolandaの表示ラベルに基づいた正規表現パターン（日本語の誤認識ブレにも対応）
    let weight = extractNum([/(?:体重|Weight|Weigh)\s*[:：\s]*([\d\.]+)/i, /([\d\.]+)kg/i]);
    const bmi = extractNum([/(?:BMI)\s*[:：\s]*([\d\.]+)/i]);
    let fat = extractNum([/(?:体脂肪率|体脂肪|Body\s*Fat|Fat)\s*[:：\s]*([\d\.]+)/i, /([\d\.]+)%/]);
    let muscle = extractNum([/(?:筋肉量|筋肉|筋内|肌内|筋量|Muscle)\s*[:：\s]*([\d\.]+)/i]);
    let visceral = extractNum([
      /(?:内臓脂肪|内臓|内職|内騰|内蔵|内|Visceral|Fat)[^\d\n]*(\d{1,2})/i
    ]);
    
    // --- 4. 鉄板フォールバックロジック (ラベルが読めなかった場合の順番に基づく抽出) ---
    
    // 4-1. [kg] 単位が付く数値の出現順
    // Yolanda: 体重 (1つ目のkg) ➡️ 筋肉量 (2つ目のkg) ➡️ 骨量 (3つ目のkg)
    const kgMatches = [];
    const kgRegex = /([\d\.]+)\s*(?:kg|Kg|KG|kKg)/g;
    let match;
    while ((match = kgRegex.exec(text)) !== null) {
      const val = parseFloat(match[1]);
      if (!isNaN(val)) kgMatches.push(val);
    }
    
    if (weight === null && kgMatches.length > 0) {
      weight = kgMatches[0];
    }
    if (muscle === null && kgMatches.length > 1) {
      muscle = kgMatches[1];
    }

    // 4-2. [%] 単位が付く数値の出現順
    // Yolanda: 体脂肪率 (1つ目の%) ➡️ 皮下脂肪 (2つ目の%) ➡️ 体水分率 (3つ目の%)
    const pctMatches = [];
    const pctRegex = /([\d\.]+)\s*%/g;
    while ((match = pctRegex.exec(text)) !== null) {
      const val = parseFloat(match[1]);
      if (!isNaN(val)) pctMatches.push(val);
    }
    
    if (fat === null && pctMatches.length > 0) {
      fat = pctMatches[0];
    }

    // 4-3. [内臓脂肪] レベルの抽出フォールバック
    // 内臓脂肪は単一の整数で、「皮下脂肪 (2つ目の数値)」と「体水分率 (3つ目の数値)」の間の行などに出現します。
    // 単体の小さな数値（1桁から2桁）を探索
    if (visceral === null) {
      const singleNumMatches = [];
      const numLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (const line of numLines) {
        // ラベルなしで数字だけが書かれている行を探す
        const singleMatch = line.match(/^(\d{1,2})$/);
        if (singleMatch) {
          singleNumMatches.push(parseInt(singleMatch[1]));
        }
      }
      // Yolandaの並び順で、最初または途中の単独整数をピックアップ
      if (singleNumMatches.length > 0) {
        visceral = singleNumMatches[0];
      }
    }

    // 日付の抽出 (例: 2026/07/07)
    let date = new Date().toISOString().split('T')[0];
    const dateMatch = text.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }

    // 5. 各フォームへのマッピング
    if (document.getElementById('body-date')) document.getElementById('body-date').value = date;
    if (weight !== null && document.getElementById('body-weight')) document.getElementById('body-weight').value = weight;
    if (fat !== null && document.getElementById('body-fat')) document.getElementById('body-fat').value = fat;
    if (muscle !== null && document.getElementById('body-muscle')) document.getElementById('body-muscle').value = muscle;
    if (bmi !== null && document.getElementById('body-bmi')) document.getElementById('body-bmi').value = bmi;
    if (visceral !== null && document.getElementById('body-visceral')) document.getElementById('body-visceral').value = visceral;

    // メモ欄に自動でインポート元テキストを挿入
    if (document.getElementById('body-note')) {
      document.getElementById('body-note').value = 'Yolandaから入力';
    }

    showToast('画像を解析し、体組成データを入力しました 📸', 'success');

  } catch (e) {
    console.error('Local OCR parsing failed:', e);
    showToast(`画像解析に失敗しました: ${e.message}`, 'danger');
  } finally {
    if (placeholder && spinner) {
      placeholder.style.display = 'block';
      spinner.style.display = 'none';
    }
    // file input を初期化
    const fileInput = document.getElementById('body-smart-file-input');
    if (fileInput) fileInput.value = '';
  }
}

async function showBodyDetail(id) {
  const record = await db.bodyComposition.get(id);
  if (!record) return;
  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">${formatDate(record.date)}</div>
    <div class="body-comp-grid mb-lg">
      ${record.weight ? `<div><div class="body-comp-value">${record.weight}</div><div class="body-comp-label">体重 kg</div></div>` : '<div></div>'}
      ${record.bodyFat ? `<div><div class="body-comp-value">${record.bodyFat}</div><div class="body-comp-label">体脂肪率 %</div></div>` : '<div></div>'}
      ${record.muscleMass ? `<div><div class="body-comp-value">${record.muscleMass}</div><div class="body-comp-label">筋肉量 kg</div></div>` : '<div></div>'}
    </div>
    <div class="body-comp-grid mb-lg">
      ${record.bmi ? `<div><div class="body-comp-value">${record.bmi}</div><div class="body-comp-label">BMI</div></div>` : '<div></div>'}
      ${record.visceralFat ? `<div><div class="body-comp-value">${record.visceralFat}</div><div class="body-comp-label">内臓脂肪</div></div>` : '<div></div>'}
      <div></div>
    </div>
    ${record.note ? `<div class="text-sm text-muted">📝 ${record.note}</div>` : ''}
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal();showBodyInput(${JSON.stringify(record).replace(/"/g, '&quot;')})" style="flex:1">編集</button>
      <button class="btn btn-danger" onclick="confirmDeleteBody(${id})" style="flex:1">削除</button>
    </div>
  `);
}

function confirmDeleteBody(id) {
  closeModal();
  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">この記録を削除しますか？</div>
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">キャンセル</button>
      <button class="btn btn-danger" onclick="doDeleteBody(${id})" style="flex:1">削除</button>
    </div>`);
}

async function doDeleteBody(id) {
  await deleteBodyComposition(id);
  closeModal();
  showToast('記録を削除しました', 'success');
  navigateTo('body');
}

// ========================================
// 設定画面
// ========================================
function renderSettings(main) {
  const FACILITY = window.GymneryFacility || {};
  main.innerHTML = `
    <div class="page">
      <div class="card mb-md" style="line-height: 1.6;">
        <div class="text-sm font-bold mb-xs flex justify-between items-center">
          <span>📍 施設情報・プリセット切替</span>
          <div class="flex gap-xs">
            <button class="btn btn-primary btn-sm" onclick="openFacilityShareModal()" style="padding: 2px 8px; font-size: 0.72rem;">📤 共有</button>
            <button class="btn btn-ghost btn-sm" onclick="editFacilityInfo()" style="padding: 2px 6px;">✏️ 編集</button>
          </div>
        </div>
        <div class="mb-sm">
          <label class="text-xs text-muted">プリセット施設切替:</label>
          <select class="input text-xs mt-xs" onchange="switchFacilityPreset(this.value)" style="width:100%;">
            <option value="asahicho" ${(!localStorage.getItem('selected_facility_preset') || localStorage.getItem('selected_facility_preset') === 'asahicho') ? 'selected' : ''}>🏛️ 旭町南地区区民館 (デフォルト)</option>
            <option value="hikarigaoka" ${localStorage.getItem('selected_facility_preset') === 'hikarigaoka' ? 'selected' : ''}>🏢 光が丘体育館</option>
            <option value="nerima_sougou" ${localStorage.getItem('selected_facility_preset') === 'nerima_sougou' ? 'selected' : ''}>🏟️ 練馬区立総合体育館</option>
            <option value="heiwadai" ${localStorage.getItem('selected_facility_preset') === 'heiwadai' ? 'selected' : ''}>🏢 平和台体育館</option>
            <option value="kamishakujii" ${localStorage.getItem('selected_facility_preset') === 'kamishakujii' ? 'selected' : ''}>🏢 上石神井体育館</option>
          </select>
        </div>
        <div class="text-sm font-bold">${FACILITY.name}</div>
        <div class="text-xs text-muted mb-sm">${FACILITY.address} (☎ ${FACILITY.phone})</div>
        
        <div class="mb-sm" style="border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
          <div class="text-xs font-bold text-primary">🏛️ 区民館 全般</div>
          <div class="text-xs text-muted">🕒 開館時間: ${FACILITY.openHours}</div>
          <div class="text-xs text-muted">✉️ 受付時間: ${FACILITY.receptionHours}</div>
          <div class="text-xs text-muted">📅 休館日: ${FACILITY.closedDays}</div>
        </div>

        <div>
          <div class="text-xs font-bold text-primary">🏃 地下トレーニング室 (個人利用)</div>
          <div class="text-xs text-muted">👥 対象: ${FACILITY.gymTarget}</div>
          <div class="text-xs text-muted">🕒 利用時間 (入替制):</div>
          <ul style="margin: 2px 0 6px 14px; padding: 0; list-style-type: circle; font-size: var(--font-size-xs); color: var(--text-muted);">
            ${FACILITY.gymHours.map(h => `<li>${h}</li>`).join('')}
          </ul>
          <div class="text-xs text-muted">💰 使用料:</div>
          <ul style="margin: 2px 0 6px 14px; padding: 0; list-style-type: circle; font-size: var(--font-size-xs); color: var(--text-muted);">
            ${FACILITY.gymFee.map(f => `<li>${f}</li>`).join('')}
          </ul>
          <div class="text-xs text-muted">🎒 持ち物: ${FACILITY.gymBelongings}</div>
          <div class="text-xs text-muted">📝 手続き: ${FACILITY.gymProcedure}</div>
          <div class="text-xs text-muted">⚠️ 注意事項:</div>
          <ul style="margin: 2px 0 0 14px; padding: 0; list-style-type: square; font-size: var(--font-size-xs); color: var(--text-muted);">
            ${FACILITY.gymNotes.map(n => `<li>${n}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="card mb-md" style="cursor: pointer;" onclick="showMachineManagementList()">
        <div class="text-sm font-bold mb-xs flex justify-between items-center">
          <span>🏋️ 設置マシン一覧・設定</span>
          <span class="btn btn-ghost btn-sm" style="padding: 2px 6px; color:var(--accent);">一覧を見る ›</span>
        </div>
        <p class="text-xs text-muted mb-xs">設置されているマシンの名前、重量設定、説明、動画URLなどを確認・編集できます。</p>
        <div class="flex gap-xs mt-sm" style="flex-wrap: wrap;">
          <span class="badge" style="background:var(--bg-elevated); color:var(--text-secondary); font-size:0.7rem; padding:2px 6px;">全 ${window.GymneryFacility?.machines?.length || 0} 台</span>
          <span class="badge" style="background:#4ecdc422; color:#4ecdc4; font-size:0.7rem; padding:2px 6px;">上半身 ${window.GymneryFacility?.machines?.filter(m => m.category==='upper').length || 0}</span>
          <span class="badge" style="background:#ff6b6b22; color:#ff6b6b; font-size:0.7rem; padding:2px 6px;">下半身 ${window.GymneryFacility?.machines?.filter(m => m.category==='lower').length || 0}</span>
          <span class="badge" style="background:#ffe66d22; color:#ffe66d; font-size:0.7rem; padding:2px 6px;">体幹 ${window.GymneryFacility?.machines?.filter(m => m.category==='core').length || 0}</span>
          <span class="badge" style="background:#a855f722; color:#a855f7; font-size:0.7rem; padding:2px 6px;">腕 ${window.GymneryFacility?.machines?.filter(m => m.category==='arm').length || 0}</span>
          <span class="badge" style="background:#38bdf822; color:#38bdf8; font-size:0.7rem; padding:2px 6px;">有酸素 ${window.GymneryFacility?.machines?.filter(m => m.category==='cardio').length || 0}</span>
        </div>
      </div>

      <div class="card mb-md">
        <div class="text-sm font-bold mb-sm">🪪 利用番号・記号設定</div>
        <p class="text-xs text-muted mb-md">受付用の利用番号・記号（利用証番号等）を登録します。</p>
        <div class="flex gap-sm">
          <input type="text" class="input text-xs" id="setting-member-id" value="${localStorage.getItem('member_id') || ''}" placeholder="例: C-41、1234 等" style="flex:2;">
          <button class="btn btn-primary btn-sm" onclick="saveSettingMemberId()" style="flex:1;">保存</button>
        </div>
      </div>

      <div class="card mb-md">
        <div class="text-sm font-bold mb-sm">⚙️ マシン初期値設定</div>
        <p class="text-xs text-muted mb-md">各マシンのデフォルト重量や回数を設定します。</p>
        <button class="btn btn-secondary btn-sm btn-block" onclick="showMachineDefaults()">初期値を設定</button>
      </div>

      <div class="card mb-md">
        <div class="text-sm font-bold mb-sm">📥 データ入出力</div>
        <p class="text-xs text-muted mb-md">全データのCSVエクスポートとインポートができます。</p>
        <div class="flex gap-sm">
          <button class="btn btn-secondary btn-sm" onclick="exportAll()" style="flex:1">エクスポート</button>
          <input type="file" id="import-csv-input" multiple accept=".csv" style="display:none" onchange="handleImportCSV(event)">
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('import-csv-input').click()" style="flex:1">インポート</button>
        </div>
      </div>

      <div class="card mb-md">
        <div class="text-sm font-bold mb-sm">🔔 バックグラウンド通知</div>
        <p class="text-xs text-muted mb-md">インターバル終了時、アプリがバックグラウンドでもロック画面に通知します。</p>
        ${localStorage.getItem('push_enabled') === '1'
          ? `<button class="btn btn-secondary btn-sm btn-block" disabled style="background:#2b3a4a; color:#8ab4f8; border-color:#2b3a4a;">✅ 通知は有効です</button>`
          : `<button class="btn btn-primary btn-sm btn-block" onclick="pushSubscribe()" id="push-enable-btn">通知を有効にする</button>`
        }
      </div>
      
      <div class="card mb-md">
        <div class="text-sm font-bold mb-sm">🤖 Gemini APIキー設定</div>
        <p class="text-xs text-muted mb-md">AI専属トレーナーによるアドバイス機能を使用するための Gemini API キーを登録します。キーはブラウザにのみ保存されます。</p>
        <div class="flex gap-sm">
          <input type="password" class="input text-xs" id="setting-gemini-key" value="${localStorage.getItem('gemini_api_key') || ''}" placeholder="AIzaSy..." style="flex:2;">
          <button class="btn btn-primary btn-sm" onclick="saveSettingGeminiKey()" style="flex:1;">保存</button>
        </div>
        <p class="text-xs text-muted mt-sm" style="font-size:0.65rem">※ APIキーは <a href="https://aistudio.google.com/" target="_blank" style="color:var(--accent); text-decoration: underline;">Google AI Studio</a> から無料で取得できます（無料枠モデル: gemini-2.5-flash）</p>
      </div>

      <div class="card mb-md">
        <div class="text-sm font-bold mb-sm">🗑 データ管理</div>
        <p class="text-xs text-muted mb-md">すべてのデータを削除します（元に戻せません）</p>
        <button class="btn btn-danger btn-sm btn-block" onclick="confirmClearAll()">全データ削除</button>
      </div>

      <div class="text-center mt-lg">
        <div class="text-xs text-muted">トレーニング記録アプリ v2.0 (v96)</div>
        <div class="text-xs text-muted mt-sm">データはこのデバイスにのみ保存されます</div>
        <div style="margin-top:16px;">
          <button class="btn btn-ghost btn-sm" onclick="forceUpdateApp()" style="font-size:0.65rem; color:var(--text-muted); border:1px solid var(--border-color); padding:4px 8px; border-radius:var(--radius-sm); width: 80%; max-width: 250px;">🔄 アプリの更新を強制反映する</button>
        </div>
      </div>
    </div>`;

  if (window.GymneryGSheets && window.GymneryGSheets.settingsHtml) {
    const dataCard = main.querySelector('.page .card:nth-child(4)'); // 元の4に戻す
    if (dataCard) {
      dataCard.insertAdjacentHTML('beforebegin', window.GymneryGSheets.settingsHtml());
    }
  }
}

function saveSettingGeminiKey() {
  const input = document.getElementById('setting-gemini-key');
  if (input) {
    const val = input.value.trim();
    localStorage.setItem('gemini_api_key', val);
    showToast('Gemini APIキーを保存しました 🔑', 'success');
    navigateTo('settings');
  }
}

async function forceUpdateApp() {
  if (confirm('アプリの最新アップデートを強制的に取得し、再読み込みします。よろしいですか？\n(記録されたデータは削除されません)')) {
    showToast('キャッシュを消去中... ⏳', '');
    
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      } catch (e) {
        console.warn('SW unregister failed:', e);
      }
    }

    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      } catch (e) {
        console.warn('Cache clear failed:', e);
      }
    }

    showToast('再読み込みします 🔄', 'success');
    setTimeout(() => {
      window.location.reload(true);
    }, 1000);
  }
}

function saveSettingMemberId() {
  const input = document.getElementById('setting-member-id');
  if (input) {
    const val = input.value.trim();
    if (val) {
      localStorage.setItem('member_id', val);
      showToast('会員番号を保存しました', 'success');
      navigateTo('settings');
    }
  }
}

async function handleImportCSV(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  try {
    const text = await files[0].text();
    const cleanText = text.replace(/^\uFEFF/, '');
    const firstLine = cleanText.split('\n')[0] || '';
    
    // スプレッドシート形式かどうか判定
    if ((firstLine.includes('チェストプレス') || firstLine.includes('ラットプルダウン') || firstLine.includes('レッグプレス')) && !firstLine.includes('sessionId')) {
      const res = await importGoogleSheetsCSV(cleanText);
      showToast(`過去データをインポート完了！\n${res.importedSessions}セッション、${res.importedExercises}種目を追加しました ✅`, 'success');
    } else {
      await importDataFromCSV(files);
      showToast('バックアップデータをインポートしました ✅', 'success');
    }
    setTimeout(() => location.reload(), 2000);
  } catch (e) {
    console.error('Import error full stack:', e);
    showToast(`インポートに失敗しました: ${e.message}\n${e.stack ? e.stack.split('\n')[0] : ''}`, 'danger');
  }
}

async function showMachineDefaults() {
  const allSettings = await getAllMachineSettings();
  const settingsMap = {};
  allSettings.forEach(s => settingsMap[s.machineId] = s.data);

  const cats = Object.keys(window.GymneryFacility?.categories || {});
  let html = `
    <div class="modal-handle"></div>
    <div class="flex items-center justify-between mb-md">
      <div class="modal-title" style="margin-bottom:0">マシン初期値設定</div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:4px 12px;font-size:14px;color:var(--text-secondary)">✕ 閉じる</button>
    </div>
    <div class="settings-list" style="max-height:60vh; overflow-y:auto; padding-right:8px;">
  `;

  for (const cat of cats) {
    const machines = getMachinesByCategory(cat);
    html += `<div class="text-sm font-bold mb-sm mt-md" style="color:${getCategoryColor(cat)}">${getCategoryLabel(cat)}</div>`;
    for (const m of machines) {
      const def = settingsMap[m.id];
      let valStr = '未設定';
      if (def) {
        if (m.type === 'strength' && Array.isArray(def) && def.length > 0) {
          valStr = `${def[0].weight || 0}kg × ${def[0].reps || 0}回`;
        } else if (def.duration) {
          valStr = `${def.duration}分`;
        }
      }
      html += `
        <div class="flex items-center justify-between py-sm border-bottom" style="border-bottom:1px solid var(--border-color)">
          <div class="text-sm">${m.name}</div>
          <div class="flex items-center gap-sm">
            <span class="text-xs text-muted">${valStr}</span>
            <button class="btn btn-ghost btn-sm" onclick="editMachineDefault('${m.id}')" style="padding:4px">✏️</button>
          </div>
        </div>
      `;
    }
  }
  html += `</div>`;
  showModal(html);
}

async function editMachineDefault(machineId) {
  const machine = getMachineById(machineId);
  const setting = await getMachineSetting(machineId);
  let defaultData = setting ? setting.data : null;
  
  if (!defaultData && machine.type === 'strength') {
    defaultData = [{}];
  }

  let inputsHtml = '';
  if (machine.type === 'strength') {
    const s = Array.isArray(defaultData) ? defaultData[0] : {};
    machine.fields.forEach(f => {
      let val = s[f.key] !== undefined ? s[f.key] : '';
      if (val === '' && f.key === 'reps') val = 10;
      inputsHtml += `
        <div class="input-group">
          <label class="input-label">${f.label}${f.unit ? ' ('+f.unit+')' : ''}</label>
          <input type="${f.type}" class="input" id="def-${f.key}" value="${val}" step="${f.step||1}" min="${f.min||0}">
        </div>
      `;
    });
  } else {
    machine.fields.forEach(f => {
      let val = defaultData ? defaultData[f.key] : '';
      inputsHtml += `
        <div class="input-group">
          <label class="input-label">${f.label}${f.unit ? ' ('+f.unit+')' : ''}</label>
          <input type="${f.type}" class="input" id="def-${f.key}" value="${val}" step="${f.step||1}" min="${f.min||0}">
        </div>
      `;
    });
  }

  const defaultNote = setting ? (setting.note || '') : '';
  inputsHtml += `
    <div class="input-group">
      <label class="input-label">ポジション・メモ</label>
      <input type="text" class="input" id="def-note" value="${defaultNote}" placeholder="シート位置など">
    </div>
  `;

  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">${machine.name} の初期値</div>
    ${inputsHtml}
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="showMachineDefaults()" style="flex:1">戻る</button>
      <button class="btn btn-primary" onclick="saveMachineDefaultBtn('${machineId}')" style="flex:1">保存</button>
    </div>
  `);
}

async function saveMachineDefaultBtn(machineId) {
  const machine = getMachineById(machineId);
  let data;
  if (machine.type === 'strength') {
    const set = {};
    machine.fields.forEach(f => {
      const val = document.getElementById(`def-${f.key}`).value;
      set[f.key] = parseFloat(val) || 0;
    });
    data = [set];
  } else {
    data = {};
    machine.fields.forEach(f => {
      const val = document.getElementById(`def-${f.key}`).value;
      data[f.key] = parseFloat(val) || 0;
    });
  }
  const note = document.getElementById('def-note').value;
  await saveMachineSetting(machineId, { data, note });
  showToast('初期値を保存しました', 'success');
  showMachineDefaults();
}

function confirmClearAll() {
  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">⚠️ 全データ削除</div>
    <p class="text-sm text-muted">すべてのセッション、記録、体組成データが削除されます。この操作は元に戻せません。</p>
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">キャンセル</button>
      <button class="btn btn-danger" onclick="doClearAll()" style="flex:1">全削除</button>
    </div>`);
}

async function doClearAll() {
  await db.sessions.clear();
  await db.exercises.clear();
  await db.bodyComposition.clear();
  activeSessionId = null;
  localStorage.removeItem('activeSessionId');
  closeModal();
  showToast('全データを削除しました', 'success');
  navigateTo('home');
}

// ========================================
// Service Worker登録
// ========================================
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      if (reg) {
        reg.update();
      }
    } catch (e) {
      console.log('SW registration failed:', e);
    }
  }
}

// ========================================
// 持ち物チェックリスト ヘルパー
// ========================================
function toggleChecklistAccordion() {
  const body = document.getElementById('checklist-body');
  const arrow = document.getElementById('checklist-arrow');
  if (!body || !arrow) return;

  const isOpen = body.style.display === 'block';
  if (isOpen) {
    body.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
    localStorage.setItem('checklist_open', '0');
  } else {
    body.style.display = 'block';
    arrow.style.transform = 'rotate(90deg)';
    localStorage.setItem('checklist_open', '1');
  }
}

function toggleChecklistItem(checkbox) {
  const item = checkbox.dataset.item;
  let checkedItems = [];
  try {
    checkedItems = JSON.parse(localStorage.getItem('checklist_states') || '[]');
  } catch (e) {
    checkedItems = [];
  }

  if (checkbox.checked) {
    if (!checkedItems.includes(item)) {
      checkedItems.push(item);
    }
    checkbox.nextElementSibling.style.color = 'var(--text-muted)';
    checkbox.nextElementSibling.style.textDecoration = 'line-through';
  } else {
    checkedItems = checkedItems.filter(i => i !== item);
    checkbox.nextElementSibling.style.color = 'var(--text-primary)';
    checkbox.nextElementSibling.style.textDecoration = 'none';
  }

  localStorage.setItem('checklist_states', JSON.stringify(checkedItems));

  // バッジの進捗表示を更新
  const badge = document.getElementById('checklist-progress-badge');
  if (badge) {
    const total = 16; // 16 items
    badge.textContent = `${checkedItems.length}/${total}`;
  }
}

// ========================================
// マシン写真プレビューモーダル
// ========================================
function showMachinePhoto(machineId, returnTarget = 'close') {
  const machine = getMachineById(machineId);
  if (!machine || !machine.image) return;

  closeModal();
  
  // 戻りアクションのハンドラ
  const getReturnAction = () => {
    if (returnTarget === 'select') {
      return 'showMachineSelect();';
    } else if (returnTarget === 'management') {
      return 'showMachineManagementList();';
    } else if (returnTarget.startsWith('detail:')) {
      const sid = returnTarget.split(':')[1];
      return `showSessionDetail(${sid});`;
    } else {
      return ''; // closeModal() だけで済む
    }
  };

  const returnJs = getReturnAction();

  // モーダルが閉じた後、一瞬時間を置いて新しい写真モーダルを開く
  setTimeout(() => {
    showModal(`
      <div class="modal-handle"></div>
      <div class="flex items-center justify-between mb-md">
        <div class="modal-title" style="margin-bottom:0">${machine.name}</div>
        <button class="btn btn-ghost btn-sm" onclick="closeModal(); ${returnJs}" style="padding:4px 12px;font-size:14px;color:var(--text-secondary)">✕ 戻る</button>
      </div>
      
      <div style="width: 100%; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-secondary); border: 1px solid var(--border-color); margin-bottom: var(--space-md); display: flex; align-items: center; justify-content: center; min-height: 200px;">
        <img src="${machine.image}" alt="${machine.name}" style="width: 100%; height: auto; max-height: 300px; object-fit: contain;" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <div style="display: none; padding: 32px 16px; text-align: center; color: var(--text-secondary);">
          <span style="font-size: 2rem; display: block; margin-bottom: 8px;">📷</span>
          <span style="font-size: 0.85rem;">画像が見つかりません<br>(images フォルダをご確認ください)</span>
        </div>
      </div>
      
      <div class="card" style="padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border-color); margin-bottom: var(--space-md);">
        <div class="text-xs text-muted mb-xs">💡 マシンの特徴・解説</div>
        <div class="text-sm" style="line-height: 1.5; color: var(--text-primary); white-space: pre-wrap;">${machine.description || '調整箇所等を確認してトレーニングを行ってください。'}</div>
      </div>
      
      ${machine.videoUrl ? `
        <a href="${machine.videoUrl}" target="_blank" class="btn btn-primary btn-block mb-sm" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; font-weight: bold; background: #ff0000; border-color: #ff0000;">
          <span>🎬</span> 使い方動画を再生 (YouTube)
        </a>
      ` : ''}
      
      <button class="btn btn-secondary btn-block" onclick="closeModal(); ${returnJs}">閉じる</button>
    `);
  }, 250);
}

// ========================================
// カレンダー関連ヘルパー (開閉、影、スクロール連動、ピッカー)
// ========================================

function toggleCalendarFold() {
  const content = document.getElementById('calendar-fold-content');
  const icon = document.getElementById('calendar-toggle-icon');
  if (!content || !icon) return;

  calendarCollapsed = !calendarCollapsed;
  localStorage.setItem('calendar_collapsed', calendarCollapsed ? '1' : '0');

  if (calendarCollapsed) {
    content.classList.add('collapsed');
    icon.textContent = '▼ カレンダーを開く';
  } else {
    content.classList.remove('collapsed');
    icon.textContent = '▲ カレンダーを閉じる';
  }
}

function setupStickyCalendarShadow() {
  const wrapper = document.getElementById('sticky-calendar-container-wrapper');
  if (!wrapper) return;

  const handleScroll = () => {
    // 画面の一番上からのスクロール量を監視
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 10) {
      wrapper.classList.add('is-stuck');
    } else {
      wrapper.classList.remove('is-stuck');
    }
  };

  window.removeEventListener('scroll', handleScroll);
  window.addEventListener('scroll', handleScroll);
  handleScroll(); // 初期読み込み時反映
}

function setupHistoryIntersectionObserver() {
  if (typeof IntersectionObserver === 'undefined') return;

  const headers = document.querySelectorAll('.history-month-section-header');
  if (headers.length === 0) return;

  if (window.historyObserver) {
    window.historyObserver.disconnect();
  }

  const observerOptions = {
    root: null,
    rootMargin: '-120px 0px -80% 0px', // カレンダーの固定ヘッダー(高さを考慮)が上部に来た時に連動
    threshold: 0
  };

  window.historyObserver = new IntersectionObserver((entries) => {
    if (isScrollingToAnchor) return;

    entries.forEach(async (entry) => {
      if (entry.isIntersecting) {
        const year = parseInt(entry.target.dataset.year, 10);
        const month = parseInt(entry.target.dataset.month, 10) - 1; // 0-indexed
        
        if (calendarDate.getFullYear() !== year || calendarDate.getMonth() !== month) {
          const sessions = await getAllSessions();
          calendarDate = new Date(year, month, 1);
          const container = document.getElementById('calendar-container');
          if (container) {
            container.innerHTML = renderCalendar(calendarDate, sessions);
          }
        }
      }
    });
  }, observerOptions);

  headers.forEach(header => window.historyObserver.observe(header));
}

async function showYearPicker() {
  const sessions = await getAllSessions();
  
  // データが存在するすべての「年」をスキャン
  const yearsWithData = new Set();
  sessions.forEach(s => {
    const d = new Date(s.startTime);
    yearsWithData.add(d.getFullYear());
  });

  // 今の年も選択肢に含める
  const currentYear = new Date().getFullYear();
  yearsWithData.add(currentYear);
  yearsWithData.add(currentYear - 1);
  yearsWithData.add(currentYear - 2);

  const sortedYears = Array.from(yearsWithData).sort((a, b) => b - a); // 降順

  let listHtml = sortedYears.map(yr => {
    const isActive = yr === calendarDate.getFullYear();
    return `<div class="year-picker-item ${isActive ? 'active' : ''}" onclick="selectPickerYear(${yr})">${yr}年</div>`;
  }).join('');

  showModal(`
    <div class="modal-handle"></div>
    <div class="flex items-center justify-between mb-md">
      <div class="modal-title" style="margin-bottom:0">年を選択</div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:4px 12px;font-size:14px;color:var(--text-secondary)">✕</button>
    </div>
    <div class="year-picker-list">${listHtml}</div>
  `);
}

async function showMonthPicker(targetYear) {
  const sessions = await getAllSessions();
  
  // 対象の年においてデータが存在する「月」をスキャン
  const monthsWithData = new Set();
  sessions.forEach(s => {
    const d = new Date(s.startTime);
    if (d.getFullYear() === targetYear) {
      monthsWithData.add(d.getMonth() + 1); // 1〜12月
    }
  });

  let gridHtml = '';
  for (let m = 1; m <= 12; m++) {
    const isActive = targetYear === calendarDate.getFullYear() && (m - 1) === calendarDate.getMonth();
    const hasData = monthsWithData.has(m);
    
    // データがある月には中黒(●)フラグを設置
    const dotFlag = hasData ? '<span class="dot"></span>' : '';
    
    gridHtml += `
      <div class="picker-item ${isActive ? 'active' : ''}" onclick="selectPickerMonth(${targetYear}, ${m})">
        <div>${m}月</div>
        ${dotFlag}
      </div>`;
  }

  showModal(`
    <div class="modal-handle"></div>
    <div class="flex items-center justify-between mb-sm">
      <div class="modal-title" style="margin-bottom:0">${targetYear}年 月を選択</div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:4px 12px;font-size:14px;color:var(--text-secondary)">✕</button>
    </div>
    <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:12px; display:flex; align-items:center; gap:4px;">
      <span style="display:inline-block; width:6px; height:6px; background-color:var(--accent); border-radius:50%;"></span>
      <span>印のある月にはトレーニングデータがあります。</span>
    </div>
    <div class="picker-grid">${gridHtml}</div>
  `);
}

async function selectPickerYear(year) {
  closeModal();
  // 選択された年の今と同じ月に切り替える
  const targetDate = new Date(year, calendarDate.getMonth(), 1);
  const sessions = await getAllSessions();
  
  calendarDate = targetDate;
  const container = document.getElementById('calendar-container');
  if (container) {
    container.innerHTML = renderCalendar(targetDate, sessions);
  }
  
  // スクロールを発火
  triggerMonthScroll(year, calendarDate.getMonth() + 1);
}

async function selectPickerMonth(year, month) {
  closeModal();
  const targetDate = new Date(year, month - 1, 1);
  const sessions = await getAllSessions();
  
  calendarDate = targetDate;
  const container = document.getElementById('calendar-container');
  if (container) {
    container.innerHTML = renderCalendar(targetDate, sessions);
  }
  
  // スクロールを発火
  triggerMonthScroll(year, month);
}

function triggerMonthScroll(year, month) {
  isScrollingToAnchor = true;
  
  const targetId = `history-month-${year}-${month}`;
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      isScrollingToAnchor = false;
    }, 500);
  } else {
    isScrollingToAnchor = false;
  }
}

// ========================================
// 初回起動ウィザード (Onboarding Wizard)
// ========================================
async function checkOnboardingWizard() {
  let completed = localStorage.getItem('gs_wizard_completed') === '1';
  if (!completed) {
    try {
      const dbCompleted = await getAppSetting('gs_wizard_completed');
      if (dbCompleted === '1') {
        completed = true;
        localStorage.setItem('gs_wizard_completed', '1');
      }
    } catch (e) {
      console.warn('Failed to fetch wizard status from IndexedDB:', e);
    }
  }

  if (!completed) {
    showOnboardingWizard();
  }
}

function showOnboardingWizard() {
  // すでにUIが存在する場合は消す
  const existing = document.getElementById('wizard-overlay');
  if (existing) existing.remove();

  const currentPreset = localStorage.getItem('selected_facility_preset') || 'asahicho';
  const currentMemberId = localStorage.getItem('member_id') || '';

  const wizardHtml = `
    <div id="wizard-overlay" class="wizard-overlay">
      <div class="wizard-container" style="max-height: 90vh; overflow-y: auto;">
        <button class="wizard-skip-btn" onclick="skipWizard()">スキップ ✕</button>
        
        <!-- Step 1: 施設選択 & データ協力のお願い -->
        <div id="wizard-step-1" class="wizard-step active">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🏋️‍♂️</div>
          <h2 class="text-base font-bold mb-xs" style="margin-top:0">Gymny へようこそ！</h2>
          <p class="text-xs text-muted mb-sm">ご利用になるトレーニング施設を選択してください。</p>

          <div class="mb-sm text-left">
            <label class="text-xs font-bold text-muted mb-xs" style="display:block;">📍 ご利用の施設を選択:</label>
            <select id="wizard-facility-select" class="input text-xs" style="width:100%; padding:8px 10px; font-weight:bold; background:var(--bg-elevated);" onchange="handleWizardFacilityChange(this.value)">
              <option value="asahicho" ${currentPreset === 'asahicho' ? 'selected' : ''}>🏛️ 旭町南地区区民館 (実機マシン・重量登録済 ✅)</option>
              <option value="hikarigaoka" ${currentPreset === 'hikarigaoka' ? 'selected' : ''}>🏢 光が丘体育館 (施設情報のみ・マシン初期設定要 ⚠️)</option>
              <option value="nerima_sougou" ${currentPreset === 'nerima_sougou' ? 'selected' : ''}>🏟️ 練馬区立総合体育館 (施設情報のみ・マシン初期設定要 ⚠️)</option>
              <option value="heiwadai" ${currentPreset === 'heiwadai' ? 'selected' : ''}>🏢 平和台体育館 (施設情報のみ・マシン初期設定要 ⚠️)</option>
              <option value="kamishakujii" ${currentPreset === 'kamishakujii' ? 'selected' : ''}>🏢 上石神井体育館 (施設情報のみ・マシン初期設定要 ⚠️)</option>
            </select>
          </div>

          <div id="wizard-facility-notice" class="card mb-md text-left" style="background:var(--bg-secondary); border:1px solid var(--border-color); padding:10px 12px; font-size:0.75rem; line-height:1.5;">
            <div id="wizard-notice-title" style="font-weight:bold; color:var(--accent); margin-bottom:4px;">💡 マシン登録状況について</div>
            <div id="wizard-notice-text" class="text-muted">
              現在、写真・全17台の実機ウエイト刻みが完全登録されているのは<strong>「旭町南地区区民館」</strong>のみです。<br>
              そのまま快適にご利用いただけます。
            </div>
          </div>

          <div class="mb-md text-left">
            <label class="text-xs font-bold text-muted mb-xs" style="display:block;">🪪 利用番号・記号 (任意):</label>
            <input type="text" id="wizard-member-id" class="input text-xs" value="${currentMemberId}" placeholder="例: C-41、1234 等 (後からでも設定可能)" style="width:100%;">
          </div>

          <button class="btn btn-primary" onclick="proceedFromWizardStep1()" style="width:100%">初期設定を始める ›</button>
        </div>

        <!-- Step 2 -->
        <div id="wizard-step-2" class="wizard-step">
          <div style="font-size: 2.2rem; margin-bottom: 12px;">📊</div>
          <h2 class="text-base font-bold mb-md" style="margin-top:0">Google スプレッドシート連携</h2>
          <p class="text-xs text-muted mb-lg" style="line-height: 1.6; text-align: left;">
            Googleアカウントと連携すると、トレーニングの記録が自動的にお手持ちのスプレッドシートにバックアップ・同期されます。
          </p>
          <button class="btn btn-primary mb-sm" onclick="gsheetsSignInAndUpdateWizard()" style="width:100%">Googleでログインして連携</button>
          <button class="btn btn-ghost text-xs" onclick="nextWizardStep(3)" style="width:100%; border:1px solid var(--border-color)">連携せずに次へ（後でも設定できます）</button>
        </div>

        <!-- Step 3 -->
        <div id="wizard-step-3" class="wizard-step">
          <div style="font-size: 2.2rem; margin-bottom: 12px;">⏱</div>
          <h2 class="text-base font-bold mb-md" style="margin-top:0">インターバル通知設定</h2>
          <p class="text-xs text-muted mb-lg" style="line-height: 1.6; text-align: left;">
            セット間のインターバルタイマーの終了を、スマホのバックグラウンド通知でお知らせします。
          </p>
          <button class="btn btn-primary mb-sm" onclick="pushSubscribeWizard()" style="width:100%">通知を有効にする</button>
          <button class="btn btn-ghost text-xs" onclick="nextWizardStep(4)" style="width:100%; border:1px solid var(--border-color)">通知なしで次へ</button>
        </div>

        <!-- Step 4 -->
        <div id="wizard-step-4" class="wizard-step">
          <div style="font-size: 2.2rem; margin-bottom: 12px;">💪</div>
          <h2 class="text-base font-bold mb-md" style="margin-top:0">準備完了！</h2>
          <p class="text-xs text-muted mb-lg" style="line-height: 1.6; text-align: left;">
            お疲れ様でした。これで基本設定は完了です。<br><br>
            トレーニング室の受付では、会員証の提示や持ち物チェックリストを活用してスマートに入場しましょう！
          </p>
          <button class="btn btn-primary" onclick="completeWizard()" style="width:100%">トレーニングを開始する！</button>
        </div>

        <!-- Indicator Dots -->
        <div class="wizard-dots">
          <span class="wizard-dot active" id="wizard-dot-1"></span>
          <span class="wizard-dot" id="wizard-dot-2"></span>
          <span class="wizard-dot" id="wizard-dot-3"></span>
          <span class="wizard-dot" id="wizard-dot-4"></span>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', wizardHtml);
  setTimeout(() => {
    document.getElementById('wizard-overlay')?.classList.add('active');
  }, 100);
}


window.handleWizardFacilityChange = function(facilityId) {
  const titleEl = document.getElementById('wizard-notice-title');
  const noticeEl = document.getElementById('wizard-notice-text');
  if (!noticeEl) return;
  if (facilityId === 'asahicho') {
    if (titleEl) { titleEl.textContent = '✅ 実機マシン登録済み施設'; titleEl.style.color = '#4ecdc4'; }
    noticeEl.innerHTML = '写真・全17台の正確なウエイト刻みが完全に登録されています。<br>そのまま即座に正確なトレーニング記録にご利用いただけます。';
  } else {
    const names = {
      'hikarigaoka': '光が丘体育館',
      'nerima_sougou': '練馬区立総合体育館',
      'heiwadai': '平和台体育館',
      'kamishakujii': '上石神井体育館'
    };
    const name = names[facilityId] || '選択した施設';
    if (titleEl) { titleEl.textContent = '⚠️ マシン設定についてのご注意'; titleEl.style.color = '#ff9800'; }
    noticeEl.innerHTML = `<strong>「${name}」</strong>は開館時間・料金等の施設情報のみ登録済みです。<br><span style="color:#ff9800;">※ マシン一覧と重り刻みは仮の初期テンプレート（未確認）です。</span><br>実際のトレーニング前に、設定画面（設置マシン一覧）から現場の重り刻みに合わせて設定してください。`;
  }
};

window.proceedFromWizardStep1 = async function() {
  const select = document.getElementById('wizard-facility-select');
  const memberInp = document.getElementById('wizard-member-id');
  
  if (select) {
    const selectedFacility = select.value;
    const prevFacility = localStorage.getItem('selected_facility_preset') || 'asahicho';
    localStorage.setItem('selected_facility_preset', selectedFacility);
    
    if (selectedFacility !== prevFacility) {
      localStorage.removeItem('custom_facility_info');
      localStorage.removeItem('custom_machines');
      // 施設設定を再読み込み
      await loadFacilityConfig();
    }
  }

  if (memberInp) {
    const memberIdVal = memberInp.value.trim();
    if (memberIdVal) {
      localStorage.setItem('member_id', memberIdVal);
    }
  }

  // ホーム画面を最新の設定・番号で即時再描画
  const main = document.getElementById('main-content');
  if (main && currentPage === 'home') {
    renderHome(main);
  }

  nextWizardStep(2);
};

window.nextWizardStep = function(stepNum) {
  // 全ステップ非表示
  document.querySelectorAll('.wizard-step').forEach(step => {
    step.classList.remove('active');
  });
  // 該当ステップ表示
  const targetStep = document.getElementById(`wizard-step-${stepNum}`);
  if (targetStep) targetStep.classList.add('active');

  // インジケータードット更新
  document.querySelectorAll('.wizard-dot').forEach(dot => {
    dot.classList.remove('active');
  });
  const targetDot = document.getElementById(`wizard-dot-${stepNum}`);
  if (targetDot) targetDot.classList.add('active');
};

window.skipWizard = async function() {
  await finishWizard();
  showToast('ウィザードをスキップしました', 'info');
};

window.completeWizard = async function() {
  await finishWizard();
  showToast('ウィザードを完了しました！トレーニングを始めましょう💪', 'success');
};

async function finishWizard() {
  // ウィザード Step 1 の利用番号入力を吸い上げて保存
  const memberInp = document.getElementById('wizard-member-id');
  if (memberInp) {
    const memberIdVal = memberInp.value.trim();
    if (memberIdVal) {
      localStorage.setItem('member_id', memberIdVal);
    }
  }

  localStorage.setItem('gs_wizard_completed', '1');
  try {
    await saveAppSetting('gs_wizard_completed', '1');
  } catch (e) {
    console.warn('Failed to save wizard status to IndexedDB:', e);
  }
  
  const overlay = document.getElementById('wizard-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 400);
  }

  // ホーム画面およびヘッダーを最新の設定・会員番号で即座に再描画
  const main = document.getElementById('main-content');
  if (main && currentPage === 'home') {
    renderHome(main);
  }
}

window.resetOnboardingWizard = async function() {
  localStorage.removeItem('gs_wizard_completed');
  try {
    await deleteAppSetting('gs_wizard_completed');
  } catch (e) {
    console.warn(e);
  }
  showOnboardingWizard();
};

window.gsheetsSignInAndUpdateWizard = async function() {
  const authed = localStorage.getItem('gs_authed') === '1';
  if (authed) {
    window.nextWizardStep(3);
    return;
  }
  try {
    await GymneryGSheets.gsheetsSignIn('select_account');
    await GymneryGSheets.gsheetsFindOrCreateSpreadsheet();
    showToast('Googleアカウントと連携しました ✅', 'success');
    window.nextWizardStep(3);
  } catch (e) {
    showToast(`連携エラー: ${e.message}`, 'danger');
  }
};

window.pushSubscribeWizard = async function() {
  if (localStorage.getItem('push_enabled') === '1') {
    window.nextWizardStep(4);
    return;
  }
  try {
    await pushSubscribe();
    window.nextWizardStep(4);
  } catch (e) {
    console.warn(e);
    // 失敗しても次へ進めるようにする
    window.nextWizardStep(4);
  }
};

// ========================================
// 共有 & ヘルプ用ヘルパー関数
// ========================================
window.copyShareUrl = function() {
  const url = location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('共有URLをコピーしました！ 📋', 'success');
  }).catch(err => {
    showToast('コピーに失敗しました', 'danger');
  });
};

window.toggleHelpAccordion = function(btn) {
  btn.classList.toggle('active');
  const triggerIcon = btn.querySelector('.trigger-icon');
  if (triggerIcon) {
    triggerIcon.textContent = btn.classList.contains('active') ? '▼' : '▶';
  }
};

// ========================================
// iOS等におけるキーボード出現時のボトムナビ浮きバグ回避
// ========================================
(function() {
  let initialHeight = window.innerHeight;
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const bottomNav = document.getElementById('bottom-nav');
      if (!bottomNav) return;
      // 高さが初期値から20%以上縮んだらキーボードが出たとみなす
      if (window.innerHeight < initialHeight * 0.8) {
        bottomNav.classList.add('keyboard-open');
      } else {
        bottomNav.classList.remove('keyboard-open');
      }
      // 強制再描画（浮きバグ回避）
      bottomNav.style.display = 'none';
      bottomNav.offsetHeight; // reflow
      bottomNav.style.display = '';
    }, 100);
  });
  
  // input/textarea フォーカス連動
  document.addEventListener('focusin', (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      document.getElementById('bottom-nav')?.classList.add('keyboard-open');
    }
  });
  
  document.addEventListener('focusout', (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      setTimeout(() => {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea' && activeTag !== 'select') {
          const bottomNav = document.getElementById('bottom-nav');
          if (bottomNav) {
            bottomNav.classList.remove('keyboard-open');
            // 強制再描画
            bottomNav.style.display = 'none';
            bottomNav.offsetHeight; // reflow
            bottomNav.style.display = '';
          }
        }
      }, 100);
    }
  });
})();


window.editMemberId = function() {
  const current = localStorage.getItem('member_id') || '';
  const res = prompt('利用番号・記号を入力してください (例: C-41、1234 等):', current);
  if (res !== null) {
    localStorage.setItem('member_id', res);
    const main = document.getElementById('main-content');
    if (main) renderHome(main);
  }
};

window.editChecklist = function() {
  const currentItems = JSON.parse(localStorage.getItem('custom_checklist') || '[]');
  const text = currentItems.join('\n');
  const modalHtml = `
    <div class="modal-overlay active" id="checklist-edit-modal" onclick="closeModalCustom('checklist-edit-modal')">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-handle"></div>
        <h3 class="mb-sm">持ち物チェックリストの編集</h3>
        <p class="text-xs text-muted mb-sm">1行に1つの持ち物を入力してください。</p>
        <textarea id="checklist-edit-text" class="input mb-md" style="width:100%; height: 200px; resize:none;">${text}</textarea>
        <div class="flex gap-sm">
          <button class="btn btn-secondary" style="flex:1" onclick="closeModalCustom('checklist-edit-modal')">キャンセル</button>
          <button class="btn btn-primary" style="flex:1" onclick="saveChecklist()">保存</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.saveChecklist = function() {
  const val = document.getElementById('checklist-edit-text').value;
  const newItems = val.split('\n').map(s => s.trim()).filter(s => s);
  localStorage.setItem('custom_checklist', JSON.stringify(newItems));
  closeModalCustom('checklist-edit-modal');
  showToast('チェックリストを保存しました', 'success');
  const main = document.getElementById('main-content');
  if (main) renderHome(main);
};

window.closeModalCustom = function(id) {
  const m = document.getElementById(id);
  if (m) m.remove();
};


window.editFacilityInfo = function() {
  const fac = window.GymneryFacility || {};
  const arrayToStr = (arr) => Array.isArray(arr) ? arr.join('\n') : (arr || '');
  
  const modalHtml = `
    <div class="modal-overlay active" id="facility-edit-modal" onclick="closeModalCustom('facility-edit-modal')">
      <div class="modal-content" onclick="event.stopPropagation()" style="max-height:90vh; overflow-y:auto; padding-bottom: 30px;">
        <div class="modal-handle"></div>
        <h3 class="mb-sm">施設情報の編集</h3>
        <p class="text-xs text-muted mb-md">※ローカルに保存され、設定画面の表示を上書きします。</p>
        
        <label class="text-xs font-bold">施設名</label>
        <input type="text" id="fac-name" class="input mb-sm text-sm" value="${fac.name || ''}" style="width:100%">
        
        <label class="text-xs font-bold">住所</label>
        <input type="text" id="fac-address" class="input mb-sm text-sm" value="${fac.address || ''}" style="width:100%">
        
        <label class="text-xs font-bold">電話番号</label>
        <input type="text" id="fac-phone" class="input mb-sm text-sm" value="${fac.phone || ''}" style="width:100%">
        
        <label class="text-xs font-bold text-primary mt-sm block">🏛️ 区民館 全般</label>
        
        <label class="text-xs font-bold">開館時間</label>
        <input type="text" id="fac-openHours" class="input mb-sm text-sm" value="${fac.openHours || ''}" style="width:100%">
        
        <label class="text-xs font-bold">受付時間</label>
        <input type="text" id="fac-receptionHours" class="input mb-sm text-sm" value="${fac.receptionHours || ''}" style="width:100%">
        
        <label class="text-xs font-bold">休館日</label>
        <input type="text" id="fac-closedDays" class="input mb-sm text-sm" value="${fac.closedDays || ''}" style="width:100%">
        
        <label class="text-xs font-bold text-primary mt-sm block">🏃 トレーニング室 (個人利用)</label>
        
        <label class="text-xs font-bold">対象</label>
        <input type="text" id="fac-gymTarget" class="input mb-sm text-sm" value="${fac.gymTarget || ''}" style="width:100%">
        
        <label class="text-xs font-bold">利用時間 (入替制) ※改行でリスト化</label>
        <textarea id="fac-gymHours" class="input mb-sm text-sm" style="width:100%; height:80px; resize:none;">${arrayToStr(fac.gymHours)}</textarea>
        
        <label class="text-xs font-bold">使用料 ※改行でリスト化</label>
        <textarea id="fac-gymFee" class="input mb-sm text-sm" style="width:100%; height:80px; resize:none;">${arrayToStr(fac.gymFee)}</textarea>
        
        <label class="text-xs font-bold">持ち物</label>
        <input type="text" id="fac-gymBelongings" class="input mb-sm text-sm" value="${fac.gymBelongings || ''}" style="width:100%">
        
        <label class="text-xs font-bold">手続き</label>
        <input type="text" id="fac-gymProcedure" class="input mb-sm text-sm" value="${fac.gymProcedure || ''}" style="width:100%">
        
        <label class="text-xs font-bold">注意事項 ※改行でリスト化</label>
        <textarea id="fac-gymNotes" class="input mb-md text-sm" style="width:100%; height:100px; resize:none;">${arrayToStr(fac.gymNotes)}</textarea>
        
        <div class="flex gap-sm mt-md">
          <button class="btn btn-secondary" style="flex:1" onclick="closeModalCustom('facility-edit-modal')">キャンセル</button>
          <button class="btn btn-primary" style="flex:1" onclick="saveFacilityInfo()">保存</button>
        </div>
        <div class="mt-md text-center">
          <button class="btn btn-ghost text-xs" style="color:var(--danger)" onclick="resetFacilityInfo()">デフォルトに戻す</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.saveFacilityInfo = function() {
  const fac = window.GymneryFacility || {};
  const strToArray = (str) => str.split('\n').map(s => s.trim()).filter(s => s);
  
  const custom = {
    name: document.getElementById('fac-name').value,
    address: document.getElementById('fac-address').value,
    phone: document.getElementById('fac-phone').value,
    openHours: document.getElementById('fac-openHours').value,
    receptionHours: document.getElementById('fac-receptionHours').value,
    closedDays: document.getElementById('fac-closedDays').value,
    gymTarget: document.getElementById('fac-gymTarget').value,
    gymHours: strToArray(document.getElementById('fac-gymHours').value),
    gymFee: strToArray(document.getElementById('fac-gymFee').value),
    gymBelongings: document.getElementById('fac-gymBelongings').value,
    gymProcedure: document.getElementById('fac-gymProcedure').value,
    gymNotes: strToArray(document.getElementById('fac-gymNotes').value)
  };
  Object.assign(fac, custom);
  localStorage.setItem('custom_facility_info', JSON.stringify(custom));
  closeModalCustom('facility-edit-modal');
  showToast('施設情報を保存しました', 'success');
  const main = document.getElementById('main-content');
  if (main) renderSettings(main);
};

window.resetFacilityInfo = function() {
  if (confirm('施設情報をデフォルトに戻しますか？')) {
    localStorage.removeItem('custom_facility_info');
    location.reload();
  }
};


async function renderMuscleMap() {
  const container = document.getElementById('muscle-map-container');
  const detailList = document.getElementById('muscle-detail-list');
  if (!container) return;

  let exercises = [];
  try {
    exercises = await getAllExercises();
  } catch (e) {
    console.error(e);
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Muscle groups with machine mappings and recovery periods (days)
  const muscleGroups = [
    { id: 'pectoralis', name: '大胸筋', machines: ['chest_press','fly','assisted_dips'], side: 'front', category: 'upper', recoveryDays: 2 },
    { id: 'deltoid', name: '三角筋', machines: ['shoulder_press','chest_press'], side: 'both', category: 'upper', recoveryDays: 2 },
    { id: 'trapezius', name: '僧帽筋', machines: ['lat_pulldown','assisted_chinning'], side: 'both', category: 'upper', recoveryDays: 2 },
    { id: 'latissimus', name: '広背筋', machines: ['lat_pulldown','assisted_chinning'], side: 'back', category: 'upper', recoveryDays: 3 },
    { id: 'biceps', name: '上腕二頭筋', machines: ['arm_curl','lat_pulldown','assisted_chinning'], side: 'front', category: 'arm', recoveryDays: 1 },
    { id: 'triceps', name: '上腕三頭筋', machines: ['arm_extension','chest_press','assisted_dips','shoulder_press'], side: 'back', category: 'arm', recoveryDays: 1 },
    { id: 'rectus_abdominis', name: '腹直筋', machines: ['abdominal','knee_raise'], side: 'front', category: 'core', recoveryDays: 1 },
    { id: 'obliques', name: '腹斜筋', machines: ['rotary_torso'], side: 'front', category: 'core', recoveryDays: 1 },
    { id: 'erector_spinae', name: '脊柱起立筋', machines: ['back_extension'], side: 'back', category: 'core', recoveryDays: 3 },
    { id: 'quadriceps', name: '大腿四頭筋', machines: ['leg_extension','leg_press'], side: 'front', category: 'lower', recoveryDays: 3 },
    { id: 'hamstrings', name: 'ハムストリングス', machines: ['leg_curl','leg_press'], side: 'back', category: 'lower', recoveryDays: 3 },
    { id: 'glutes', name: '大臀筋', machines: ['glute','abduction','leg_press'], side: 'back', category: 'lower', recoveryDays: 3 },
    { id: 'adductors', name: '内転筋群', machines: ['adduction'], side: 'front', category: 'lower', recoveryDays: 2 },
    { id: 'calves', name: '下腿三頭筋', machines: ['calf_raise'], side: 'back', category: 'lower', recoveryDays: 2 },
  ];

  // Calculate recovery days for each muscle group
  const muscleRecovery = {};
  for (const mg of muscleGroups) {
    const machineIds = new Set(mg.machines);
    const mgExercises = exercises.filter(e => machineIds.has(e.machineId));
    let diffDays = -1; // -1 means never trained

    if (mgExercises.length > 0) {
      let maxTime = 0;
      for (const e of mgExercises) {
        const t = typeof e.createdAt === 'string' ? new Date(e.createdAt).getTime() : e.createdAt;
        if (t > maxTime) maxTime = t;
      }
      const lastDate = new Date(maxTime);
      const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
      diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 3600 * 24));
    }

    const rd = mg.recoveryDays || 2; // recovery period for this muscle
    let color = '#374151'; // never trained - dark gray
    let status = '未実施';
    if (diffDays >= 0) {
      if (diffDays === 0) { color = '#ef4444'; status = '当日'; }
      else if (diffDays <= rd) { 
        color = '#f59e0b'; 
        status = (diffDays === 1) ? '昨日' : (diffDays === 2) ? '中1日' : `${diffDays}日前`; 
      }
      else { 
        color = '#10b981'; 
        status = (diffDays === 2) ? '中1日' : (diffDays === 3) ? '中2日' : `${diffDays}日前`; 
      }
    }

    muscleRecovery[mg.id] = { color, diffDays, status, name: mg.name, machines: mg.machines, category: mg.category, side: mg.side, recoveryDays: rd };
  }

  const gc = (id) => muscleRecovery[id] ? muscleRecovery[id].color : '#374151';

  // =============================================
  // Detailed SVG front + back view
  // viewBox: front body 0-200, back body 220-420
  // =============================================
  const svgHtml = `
    <svg viewBox="0 0 440 310" width="100%" style="max-width:380px;" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .muscle-path { stroke: #1f293766; stroke-width: 0.8; cursor: pointer; transition: opacity 0.2s; }
          .muscle-path:hover { opacity: 0.75; stroke: #fff; stroke-width: 1.5; }
          .body-outline { fill: none; stroke: #4b5563; stroke-width: 1; }
          .label-text { font-size: 7.5px; fill: #d1d5db; font-family: sans-serif; }
          .side-label { font-size: 10px; fill: #9ca3af; font-family: sans-serif; font-weight: bold; text-anchor: middle; }
        </style>
      </defs>

      <!-- Side labels -->
      <text x="100" y="16" class="side-label">前面</text>
      <text x="320" y="16" class="side-label">背面</text>

      <!-- ==================== FRONT VIEW ==================== -->
      <g transform="translate(10, 25)">
        <!-- Head -->
        <ellipse cx="90" cy="18" rx="18" ry="22" fill="#2d3748" stroke="#4b5563" stroke-width="0.8"/>

        <!-- Neck / 胸鎖乳突筋 -->
        <rect x="82" y="38" width="16" height="18" rx="4" fill="#2d3748" stroke="#4b5563" stroke-width="0.5"/>

        <!-- Trapezius front / 僧帽筋 -->
        <path d="M 72 42 Q 66 46 56 52 L 62 58 Q 72 52 78 48 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('trapezius')" fill="${gc('trapezius')}" style="cursor:pointer;" />
        <path d="M 108 42 Q 114 46 124 52 L 118 58 Q 108 52 102 48 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('trapezius')" fill="${gc('trapezius')}" style="cursor:pointer;" />

        <!-- Deltoid front / 三角筋 -->
        <path d="M 56 52 Q 42 58 38 72 L 48 76 Q 50 64 62 58 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('deltoid')" fill="${gc('deltoid')}" style="cursor:pointer;" />
        <path d="M 124 52 Q 138 58 142 72 L 132 76 Q 130 64 118 58 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('deltoid')" fill="${gc('deltoid')}" style="cursor:pointer;" />

        <!-- Pectoralis / 大胸筋 -->
        <path d="M 62 58 Q 78 54 90 58 L 90 88 Q 78 92 68 86 L 62 74 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('pectoralis')" fill="${gc('pectoralis')}" style="cursor:pointer;" />
        <path d="M 118 58 Q 102 54 90 58 L 90 88 Q 102 92 112 86 L 118 74 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('pectoralis')" fill="${gc('pectoralis')}" style="cursor:pointer;" />

        <!-- Biceps / 上腕二頭筋 -->
        <path d="M 48 76 Q 42 88 36 112 L 46 116 Q 50 94 52 82 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('biceps')" fill="${gc('biceps')}" style="cursor:pointer;" />
        <path d="M 132 76 Q 138 88 144 112 L 134 116 Q 130 94 128 82 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('biceps')" fill="${gc('biceps')}" style="cursor:pointer;" />

        <!-- Forearm -->
        <path d="M 36 112 Q 30 134 26 156 L 36 158 Q 38 136 46 116 Z" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />
        <path d="M 144 112 Q 150 134 154 156 L 144 158 Q 142 136 134 116 Z" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />

        <!-- Rectus Abdominis / 腹直筋 -->
        <path d="M 78 88 L 78 96 L 90 98 L 90 88 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('rectus_abdominis')" fill="${gc('rectus_abdominis')}" style="cursor:pointer;" />
        <path d="M 90 88 L 90 98 L 102 96 L 102 88 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('rectus_abdominis')" fill="${gc('rectus_abdominis')}" style="cursor:pointer;" />
        <path d="M 78 96 L 78 106 L 90 108 L 90 98 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('rectus_abdominis')" fill="${gc('rectus_abdominis')}" style="cursor:pointer;" />
        <path d="M 90 98 L 90 108 L 102 106 L 102 96 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('rectus_abdominis')" fill="${gc('rectus_abdominis')}" style="cursor:pointer;" />
        <path d="M 78 106 L 78 116 L 90 118 L 90 108 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('rectus_abdominis')" fill="${gc('rectus_abdominis')}" style="cursor:pointer;" />
        <path d="M 90 108 L 90 118 L 102 116 L 102 106 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('rectus_abdominis')" fill="${gc('rectus_abdominis')}" style="cursor:pointer;" />

        <!-- Obliques / 腹斜筋 -->
        <path d="M 68 86 Q 72 98 74 118 L 78 118 L 78 88 Q 74 90 68 86 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('obliques')" fill="${gc('obliques')}" style="cursor:pointer;" />
        <path d="M 112 86 Q 108 98 106 118 L 102 118 L 102 88 Q 106 90 112 86 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('obliques')" fill="${gc('obliques')}" style="cursor:pointer;" />

        <!-- Adductors / 内転筋群 -->
        <path d="M 82 122 Q 84 158 86 186 L 90 186 L 90 122 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('adductors')" fill="${gc('adductors')}" style="cursor:pointer;" />
        <path d="M 98 122 Q 96 158 94 186 L 90 186 L 90 122 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('adductors')" fill="${gc('adductors')}" style="cursor:pointer;" />

        <!-- Quadriceps / 大腿四頭筋 -->
        <path d="M 74 118 Q 68 152 62 194 L 78 194 Q 82 158 82 122 L 78 118 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('quadriceps')" fill="${gc('quadriceps')}" style="cursor:pointer;" />
        <path d="M 106 118 Q 112 152 118 194 L 102 194 Q 98 158 98 122 L 102 118 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('quadriceps')" fill="${gc('quadriceps')}" style="cursor:pointer;" />

        <!-- Tibialis / shin -->
        <path d="M 62 194 Q 58 230 56 270 L 68 270 Q 70 234 74 200 L 78 194 Z" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />
        <path d="M 118 194 Q 122 230 124 270 L 112 270 Q 110 234 106 200 L 102 194 Z" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />

        <!-- Knees -->
        <ellipse cx="70" cy="198" rx="10" ry="6" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />
        <ellipse cx="110" cy="198" rx="10" ry="6" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />

        <!-- Feet -->
        <ellipse cx="62" cy="275" rx="10" ry="5" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />
        <ellipse cx="118" cy="275" rx="10" ry="5" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />

        <!-- Front labels -->
        <text x="16" y="60" class="label-text" text-anchor="end" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('deltoid')">三角筋</text>
        <line x1="18" y1="58" x2="44" y2="64" stroke="#6b7280" stroke-width="0.5"/>
        <text x="16" y="74" class="label-text" text-anchor="end" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('pectoralis')">大胸筋</text>
        <line x1="18" y1="72" x2="64" y2="72" stroke="#6b7280" stroke-width="0.5"/>
        <text x="16" y="100" class="label-text" text-anchor="end" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('biceps')">上腕二頭筋</text>
        <line x1="18" y1="98" x2="42" y2="98" stroke="#6b7280" stroke-width="0.5"/>
        <text x="16" y="115" class="label-text" text-anchor="end" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('obliques')">腹斜筋</text>
        <line x1="18" y1="113" x2="70" y2="105" stroke="#6b7280" stroke-width="0.5"/>
        <text x="164" y="100" class="label-text" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('rectus_abdominis')">腹直筋</text>
        <line x1="162" y1="98" x2="102" y2="102" stroke="#6b7280" stroke-width="0.5"/>
        <text x="164" y="48" class="label-text" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('trapezius')">僧帽筋</text>
        <line x1="162" y1="46" x2="118" y2="46" stroke="#6b7280" stroke-width="0.5"/>
        <text x="16" y="152" class="label-text" text-anchor="end" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('adductors')">内転筋群</text>
        <line x1="18" y1="150" x2="84" y2="148" stroke="#6b7280" stroke-width="0.5"/>
        <text x="164" y="160" class="label-text" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('quadriceps')">大腿四頭筋</text>
        <line x1="162" y1="158" x2="114" y2="160" stroke="#6b7280" stroke-width="0.5"/>
      </g>

      <!-- ==================== BACK VIEW ==================== -->
      <g transform="translate(230, 25)">
        <!-- Head -->
        <ellipse cx="90" cy="18" rx="18" ry="22" fill="#2d3748" stroke="#4b5563" stroke-width="0.8"/>

        <!-- Neck -->
        <rect x="82" y="38" width="16" height="18" rx="4" fill="#2d3748" stroke="#4b5563" stroke-width="0.5"/>

        <!-- Trapezius back / 僧帽筋 -->
        <path d="M 78 42 Q 84 50 90 60 Q 96 50 102 42 L 90 36 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('trapezius')" fill="${gc('trapezius')}" style="cursor:pointer;" />
        <path d="M 72 42 Q 66 46 56 52 L 62 58 L 78 48 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('trapezius')" fill="${gc('trapezius')}" style="cursor:pointer;" />
        <path d="M 108 42 Q 114 46 124 52 L 118 58 L 102 48 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('trapezius')" fill="${gc('trapezius')}" style="cursor:pointer;" />

        <!-- Deltoid back / 三角筋 -->
        <path d="M 56 52 Q 42 58 38 72 L 48 76 Q 50 64 62 58 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('deltoid')" fill="${gc('deltoid')}" style="cursor:pointer;" />
        <path d="M 124 52 Q 138 58 142 72 L 132 76 Q 130 64 118 58 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('deltoid')" fill="${gc('deltoid')}" style="cursor:pointer;" />

        <!-- Latissimus Dorsi / 広背筋 -->
        <path d="M 62 58 Q 72 56 80 60 L 78 92 Q 70 96 64 88 L 60 72 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('latissimus')" fill="${gc('latissimus')}" style="cursor:pointer;" />
        <path d="M 118 58 Q 108 56 100 60 L 102 92 Q 110 96 116 88 L 120 72 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('latissimus')" fill="${gc('latissimus')}" style="cursor:pointer;" />

        <!-- Erector Spinae / 脊柱起立筋 -->
        <path d="M 84 60 L 84 118 L 90 120 L 90 60 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('erector_spinae')" fill="${gc('erector_spinae')}" style="cursor:pointer;" />
        <path d="M 96 60 L 96 118 L 90 120 L 90 60 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('erector_spinae')" fill="${gc('erector_spinae')}" style="cursor:pointer;" />

        <!-- Triceps / 上腕三頭筋 -->
        <path d="M 48 76 Q 42 88 36 112 L 46 116 Q 50 94 52 82 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('triceps')" fill="${gc('triceps')}" style="cursor:pointer;" />
        <path d="M 132 76 Q 138 88 144 112 L 134 116 Q 130 94 128 82 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('triceps')" fill="${gc('triceps')}" style="cursor:pointer;" />

        <!-- Forearm back -->
        <path d="M 36 112 Q 30 134 26 156 L 36 158 Q 38 136 46 116 Z" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />
        <path d="M 144 112 Q 150 134 154 156 L 144 158 Q 142 136 134 116 Z" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />

        <!-- Lower back side fill -->
        <path d="M 64 88 Q 68 102 74 118 L 78 118 L 78 92 Q 70 96 64 88 Z" fill="#2d3748" stroke="#4b5563" stroke-width="0.3" />
        <path d="M 116 88 Q 112 102 106 118 L 102 118 L 102 92 Q 110 96 116 88 Z" fill="#2d3748" stroke="#4b5563" stroke-width="0.3" />

        <!-- Glutes / 大臀筋 -->
        <path d="M 74 118 Q 72 128 72 140 Q 80 146 90 142 L 90 120 Q 84 122 78 120 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('glutes')" fill="${gc('glutes')}" style="cursor:pointer;" />
        <path d="M 106 118 Q 108 128 108 140 Q 100 146 90 142 L 90 120 Q 96 122 102 120 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('glutes')" fill="${gc('glutes')}" style="cursor:pointer;" />

        <!-- Hamstrings / ハムストリングス -->
        <path d="M 72 140 Q 66 170 62 200 L 78 200 Q 82 166 86 146 Q 80 146 72 140 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('hamstrings')" fill="${gc('hamstrings')}" style="cursor:pointer;" />
        <path d="M 108 140 Q 114 170 118 200 L 102 200 Q 98 166 94 146 Q 100 146 108 140 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('hamstrings')" fill="${gc('hamstrings')}" style="cursor:pointer;" />

        <!-- Calves / 下腿三頭筋 -->
        <path d="M 62 204 Q 58 224 56 240 Q 60 250 68 254 Q 74 240 76 224 L 78 204 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('calves')" fill="${gc('calves')}" style="cursor:pointer;" />
        <path d="M 118 204 Q 122 224 124 240 Q 120 250 112 254 Q 106 240 104 224 L 102 204 Z" class="muscle-path" onclick="navigateToMachineHistoryByMuscle('calves')" fill="${gc('calves')}" style="cursor:pointer;" />

        <!-- Lower legs -->
        <path d="M 56 240 Q 56 260 56 270 L 68 270 Q 68 260 68 254 Z" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />
        <path d="M 124 240 Q 124 260 124 270 L 112 270 Q 112 260 112 254 Z" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />

        <!-- Knees back -->
        <ellipse cx="70" cy="202" rx="10" ry="5" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />
        <ellipse cx="110" cy="202" rx="10" ry="5" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />

        <!-- Feet back -->
        <ellipse cx="62" cy="275" rx="10" ry="5" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />
        <ellipse cx="118" cy="275" rx="10" ry="5" fill="#2d3748" stroke="#4b5563" stroke-width="0.5" />

        <!-- Back labels -->
        <text x="164" y="48" class="label-text" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('trapezius')">僧帽筋</text>
        <line x1="162" y1="46" x2="108" y2="44" stroke="#6b7280" stroke-width="0.5"/>
        <text x="164" y="64" class="label-text" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('deltoid')">三角筋</text>
        <line x1="162" y1="62" x2="132" y2="66" stroke="#6b7280" stroke-width="0.5"/>
        <text x="164" y="80" class="label-text" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('latissimus')">広背筋</text>
        <line x1="162" y1="78" x2="118" y2="76" stroke="#6b7280" stroke-width="0.5"/>
        <text x="164" y="96" class="label-text" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('triceps')">上腕三頭筋</text>
        <line x1="162" y1="94" x2="138" y2="98" stroke="#6b7280" stroke-width="0.5"/>
        <text x="16" y="80" class="label-text" text-anchor="end" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('erector_spinae')">脊柱起立筋</text>
        <line x1="18" y1="78" x2="84" y2="80" stroke="#6b7280" stroke-width="0.5"/>
        <text x="164" y="134" class="label-text" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('glutes')">大臀筋</text>
        <line x1="162" y1="132" x2="108" y2="134" stroke="#6b7280" stroke-width="0.5"/>
        <text x="164" y="170" class="label-text" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('hamstrings')">ハムストリングス</text>
        <line x1="162" y1="168" x2="116" y2="170" stroke="#6b7280" stroke-width="0.5"/>
        <text x="164" y="238" class="label-text" style="cursor:pointer;" onclick="navigateToMachineHistoryByMuscle('calves')">下腿三頭筋</text>
        <line x1="162" y1="236" x2="122" y2="236" stroke="#6b7280" stroke-width="0.5"/>
      </g>
    </svg>
  `;
  container.innerHTML = svgHtml;

  // === Build detail list ===
  if (!detailList) return;

  const categoryLabels = { upper: '上半身', lower: '下半身', core: '体幹', arm: '腕' };
  const categoryIcons = { upper: '💪', lower: '🦵', core: '🧘', arm: '🤜' };
  const grouped = {};
  for (const mg of muscleGroups) {
    if (!grouped[mg.category]) grouped[mg.category] = [];
    const r = muscleRecovery[mg.id];
    const machineNames = mg.machines.map(mid => {
      const m = getMachineById(mid);
      return m ? m.name : mid;
    }).filter(Boolean);
    grouped[mg.category].push({
      id: mg.id,
      name: mg.name,
      status: r.status,
      color: r.color,
      diffDays: r.diffDays,
      recoveryDays: r.recoveryDays,
      machineNames
    });
  }

  let listHtml = '';
  for (const cat of ['upper','core','arm','lower']) {
    if (!grouped[cat]) continue;
    listHtml += '<div style="margin-bottom:8px;">';
    listHtml += '<div style="font-size:0.75rem; font-weight:bold; color:var(--text-secondary); margin-bottom:2px;">' + (categoryIcons[cat]||'') + ' ' + (categoryLabels[cat]||cat) + '</div>';
    for (const item of grouped[cat]) {
      const dotStyle = 'display:inline-block; width:8px; height:8px; border-radius:50%; background:' + item.color + '; margin-right:5px; flex-shrink:0;';
      const statusStyle = 'font-size:0.65rem; padding:1px 5px; border-radius:8px; background:' + item.color + '22; color:' + item.color + '; font-weight:bold; white-space:nowrap;';
      const machinesStr = item.machineNames.join(', ');
      const rdLabel = '(' + item.recoveryDays + '日)';
      listHtml += '<div style="padding:4px 6px; margin-bottom:3px; border-radius:4px; cursor:pointer; transition:background 0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'" onclick="navigateToMachineHistoryByMuscle(\'' + item.id + '\')">';
      listHtml += '  <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">';
      listHtml += '    <div style="display:flex; align-items:center; gap:0;">';
      listHtml += '      <span style="' + dotStyle + '"></span>';
      listHtml += '      <span style="font-size:0.78rem; font-weight:600; white-space:nowrap; color:var(--text-primary);">' + item.name + ' <span style="font-size:0.65rem; color:var(--accent);">›</span></span>';
      listHtml += '      <span style="font-size:0.6rem; color:var(--text-muted); margin-left:2px; white-space:nowrap;" title="回復目安">' + rdLabel + '</span>';
      listHtml += '    </div>';
      listHtml += '    <span style="' + statusStyle + '">' + item.status + '</span>';
      listHtml += '  </div>';
      listHtml += '  <div style="font-size:0.6rem; color:var(--text-muted); padding-left:14px; line-height:1.3;">' + machinesStr + '</div>';
      listHtml += '</div>';
    }
    listHtml += '</div>';
  }
  detailList.innerHTML = listHtml;
}


// ========================================
// 設置マシン一覧 ＆ マシン設定エディタ
// ========================================

window.showMachineManagementList = function() {
  const machines = window.GymneryFacility?.machines || [];
  const cats = ['upper', 'lower', 'core', 'arm', 'cardio'];
  const catLabels = { upper: '上半身', lower: '下半身', core: '体幹', arm: '腕', cardio: '有酸素' };
  const catColors = { upper: '#4ecdc4', lower: '#ff6b6b', core: '#ffe66d', arm: '#a855f7', cardio: '#38bdf8' };
  const catIcons = { upper: '💪', lower: '🦵', core: '🧘', arm: '🤜', cardio: '🏃' };

  let listHtml = '';
  for (const cat of cats) {
    const catMachines = machines.filter(m => m.category === cat);
    if (catMachines.length === 0) continue;

    listHtml += `
      <div style="margin-top: 14px; margin-bottom: 6px; font-weight: bold; font-size: 0.85rem; color: ${catColors[cat]}; display: flex; align-items: center; gap: 4px;">
        <span>${catIcons[cat]}</span>
        <span>${catLabels[cat]} (${catMachines.length}台)</span>
      </div>
    `;

    for (const m of catMachines) {
      let weightInfo = '';
      if (m.type === 'strength' && m.weights && m.weights.length > 0) {
        weightInfo = `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">重量: ${m.weights[0]}kg 〜 ${m.weights[m.weights.length-1]}kg (${m.weights.length}段階)</div>`;
      } else if (m.type === 'cardio') {
        weightInfo = `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">有酸素マシン (距離/速度/時間)</div>`;
      }

      const cameraBtn = m.image ? `<span onclick="event.stopPropagation(); closeModalCustom('machine-management-modal'); showMachinePhoto('${m.id}', 'management')" style="cursor:pointer; font-size:1.0rem; padding: 2px 4px; border-radius: 4px; background: rgba(255,255,255,0.08);" title="写真・使い方を見る">📷</span>` : '';
      const videoBtn = m.videoUrl ? `<a href="${m.videoUrl}" target="_blank" onclick="event.stopPropagation();" style="cursor:pointer; font-size:1.0rem; padding: 2px 4px; border-radius: 4px; background: rgba(255,0,0,0.18); text-decoration: none;" title="YouTube解説動画を見る">🎬</a>` : '';

      const mediaBadges = (cameraBtn || videoBtn) ? `
        <span style="display: inline-flex; align-items: center; gap: 4px; margin-left: 6px;">
          ${cameraBtn}
          ${videoBtn}
        </span>
      ` : '';

      listHtml += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; margin-bottom: 6px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="min-width: 0; flex: 1;">
            <div style="font-weight: bold; font-size: 0.9rem; display: flex; align-items: center;">
              <span>${m.name}</span>
              ${mediaBadges}
            </div>
            ${weightInfo}
          </div>
          <button class="btn btn-secondary btn-sm" onclick="openMachineConfigModal('${m.id}')" style="padding: 4px 10px; font-size: 0.75rem; flex-shrink: 0; margin-left: 8px;">✏️ 編集</button>
        </div>
      `;
    }
  }

  const modalHtml = `
    <div class="modal-overlay" id="machine-management-modal">
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-handle"></div>
        <div class="flex items-center justify-between mb-md">
          <div class="modal-title" style="margin-bottom:0; font-size:1.1rem;">🏋️ 設置マシン一覧・設定</div>
          <button class="btn btn-ghost btn-sm" onclick="closeModalCustom('machine-management-modal')" style="color:var(--text-muted); font-size:14px;">✕ 閉じる</button>
        </div>
        
        <div class="flex justify-between items-center mb-sm">
          <p class="text-xs text-muted" style="margin:0;">全 ${machines.length} 台のマシンが登録されています。</p>
          <button class="btn btn-primary btn-sm" onclick="openMachineConfigModal(null)" style="padding: 4px 10px; font-size: 0.75rem;">＋ 新規マシン追加</button>
        </div>

        <div style="max-height: 55vh; overflow-y: auto; padding-right: 4px;">
          ${listHtml}
        </div>

        <div class="mt-md text-center" style="border-top: 1px solid var(--border-color); padding-top: 12px;">
          <button class="btn btn-primary btn-sm btn-block mb-sm" onclick="openFacilityShareModal()" style="font-weight:bold;">📤 この施設の設定・マシン情報をみんなに共有する</button>
          <button class="btn btn-ghost text-xs" style="color:var(--danger)" onclick="resetMachineConfigToDefault()">デフォルトのマシン設定に戻す</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.openMachineConfigModal = function(machineId) {
  const isNew = !machineId;
  let machine = null;
  if (!isNew) {
    machine = getMachineById(machineId);
  }

  const defaultMachine = {
    id: 'machine_' + Date.now(),
    name: '',
    category: 'upper',
    type: 'strength',
    weights: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
    description: '',
    videoUrl: '',
    hasSets: true
  };

  const m = machine || defaultMachine;
  const weightsStr = m.weights && Array.isArray(m.weights) ? m.weights.join(', ') : '';

  const modalHtml = `
    <div class="modal-overlay" id="machine-config-edit-modal" style="z-index: 250;">
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-handle"></div>
        <div class="flex items-center justify-between mb-md">
          <div class="modal-title" style="margin-bottom:0; font-size:1.05rem;">${isNew ? '＋ 新規マシンの追加' : '✏️ ' + m.name + ' の設定'}</div>
          <button class="btn btn-ghost btn-sm" onclick="closeModalCustom('machine-config-edit-modal')" style="color:var(--text-muted); font-size:14px;">✕</button>
        </div>

        <input type="hidden" id="edit-machine-id" value="${m.id}">
        <input type="hidden" id="edit-machine-is-new" value="${isNew ? '1' : '0'}">

        <div class="input-group">
          <label class="input-label">マシン名 <span style="color:var(--danger)">*</span></label>
          <input type="text" class="input" id="edit-machine-name" value="${m.name}" placeholder="例: チェストプレス">
        </div>

        <div class="flex gap-sm">
          <div class="input-group" style="flex:1;">
            <label class="input-label">部位カテゴリ</label>
            <select class="input" id="edit-machine-category">
              <option value="upper" ${m.category === 'upper' ? 'selected' : ''}>💪 上半身</option>
              <option value="lower" ${m.category === 'lower' ? 'selected' : ''}>🦵 下半身</option>
              <option value="core" ${m.category === 'core' ? 'selected' : ''}>🧘 体幹</option>
              <option value="arm" ${m.category === 'arm' ? 'selected' : ''}>🤜 腕</option>
              <option value="cardio" ${m.category === 'cardio' ? 'selected' : ''}>🏃 有酸素</option>
            </select>
          </div>
          <div class="input-group" style="flex:1;">
            <label class="input-label">種別タイプ</label>
            <select class="input" id="edit-machine-type" onchange="toggleWeightInputArea(this.value)">
              <option value="strength" ${m.type === 'strength' ? 'selected' : ''}>ウエイト (kg/回数)</option>
              <option value="cardio" ${m.type === 'cardio' ? 'selected' : ''}>有酸素 (距離/速度/時間)</option>
            </select>
          </div>
        </div>

        <!-- ウエイト設定エリア -->
        <div id="edit-machine-weight-area" style="display: ${m.type === 'cardio' ? 'none' : 'block'}; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px;">
          <div class="text-xs font-bold mb-xs" style="color: var(--accent);">⚖️ 重量スタック（利用可能な重量リスト）</div>
          
          <!-- 一括自動生成ツール -->
          <div style="background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 8px 10px; margin-bottom: 8px; font-size: 0.75rem;">
            <div class="font-bold mb-xs" style="color: var(--text-secondary);">⚡ 3つの数字から一括自動生成</div>
            <div class="flex gap-xs items-center">
              <input type="number" step="0.1" class="input text-xs" id="gen-min" placeholder="最小 (例: 5)" style="flex:1; padding:4px 6px;">
              <input type="number" step="0.1" class="input text-xs" id="gen-second" placeholder="2段目 (例: 10)" style="flex:1; padding:4px 6px;">
              <input type="number" step="0.1" class="input text-xs" id="gen-max" placeholder="最大 (例: 100)" style="flex:1; padding:4px 6px;">
              <button type="button" class="btn btn-primary btn-sm" onclick="generateWeightArray()" style="padding:4px 8px; font-size:0.75rem; white-space:nowrap;">生成</button>
            </div>
          </div>

          <label class="input-label" style="font-size:0.7rem;">重量リスト（カンマ区切りで直接編集も可能）</label>
          <textarea class="input text-xs" id="edit-machine-weights" rows="2" placeholder="例: 5, 10, 15, 20, 25, 30...">${weightsStr}</textarea>
        </div>

        <div class="input-group">
          <label class="input-label">説明・使い方メモ</label>
          <textarea class="input text-xs" id="edit-machine-desc" rows="2" placeholder="マシンの特徴や使い方のポイント">${m.description || ''}</textarea>
        </div>

        <div class="input-group">
          <label class="input-label">YouTube解説動画URL</label>
          <input type="url" class="input text-xs" id="edit-machine-video" value="${m.videoUrl || ''}" placeholder="https://www.youtube.com/watch?v=...">
        </div>

        <div class="flex gap-sm mt-lg">
          <button class="btn btn-secondary" style="flex:1" onclick="closeModalCustom('machine-config-edit-modal')">キャンセル</button>
          ${!isNew ? `<button class="btn btn-danger" style="flex:1" onclick="deleteMachineConfig('${m.id}')">削除</button>` : ''}
          <button class="btn btn-primary" style="flex:2" onclick="saveMachineConfig()">保存</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.toggleWeightInputArea = function(type) {
  const area = document.getElementById('edit-machine-weight-area');
  if (area) {
    area.style.display = type === 'cardio' ? 'none' : 'block';
  }
};

window.generateWeightArray = function() {
  const min = parseFloat(document.getElementById('gen-min').value);
  const second = parseFloat(document.getElementById('gen-second').value);
  const max = parseFloat(document.getElementById('gen-max').value);

  if (isNaN(min) || isNaN(second) || isNaN(max)) {
    showToast('最小・2段目・最大をすべて入力してください', 'danger');
    return;
  }

  if (second <= min || max <= min) {
    showToast('2段目と最大値は最小値より大きい値を入力してください', 'danger');
    return;
  }

  const step = Math.round((second - min) * 100) / 100;
  if (step <= 0) {
    showToast('有効なステップ幅を計算できませんでした', 'danger');
    return;
  }

  const result = [];
  let curr = min;
  while (curr <= max + 0.001) {
    result.push(Math.round(curr * 10) / 10);
    curr += step;
  }

  document.getElementById('edit-machine-weights').value = result.join(', ');
  showToast(`全 ${result.length} 段階（${step}kg刻み）の重量リストを生成しました ⚡`, 'success');
};

window.saveMachineConfig = function() {
  const id = document.getElementById('edit-machine-id').value;
  const isNew = document.getElementById('edit-machine-is-new').value === '1';
  const name = document.getElementById('edit-machine-name').value.trim();
  const category = document.getElementById('edit-machine-category').value;
  const type = document.getElementById('edit-machine-type').value;
  const desc = document.getElementById('edit-machine-desc').value.trim();
  const videoUrl = document.getElementById('edit-machine-video').value.trim();

  if (!name) {
    showToast('マシン名を入力してください', 'danger');
    return;
  }

  let weights = [];
  if (type === 'strength') {
    const rawWeights = document.getElementById('edit-machine-weights').value;
    weights = rawWeights.split(',')
      .map(w => parseFloat(w.trim()))
      .filter(w => !isNaN(w) && w >= 0);
  }

  const fields = type === 'strength'
    ? [
        { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
        { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 }
      ]
    : [
        { key: 'distance', label: '距離', unit: 'km', type: 'number', step: 0.1, min: 0 },
        { key: 'speed', label: '速度', unit: 'km/h', type: 'number', step: 0.1, min: 0 },
        { key: 'duration', label: '時間', unit: '分', type: 'number', step: 1, min: 0 }
      ];

  const machines = [...(window.GymneryFacility?.machines || [])];
  
  if (isNew) {
    machines.push({
      id,
      name,
      category,
      type,
      fields,
      weights,
      hasSets: type === 'strength',
      description: desc,
      videoUrl: videoUrl || undefined
    });
  } else {
    const idx = machines.findIndex(m => m.id === id);
    if (idx !== -1) {
      machines[idx] = {
        ...machines[idx],
        name,
        category,
        type,
        fields,
        weights,
        hasSets: type === 'strength',
        description: desc,
        videoUrl: videoUrl || undefined
      };
    }
  }

  window.GymneryFacility.machines = machines;
  localStorage.setItem('custom_machines', JSON.stringify(machines));

  closeModalCustom('machine-config-edit-modal');
  closeModalCustom('machine-management-modal');
  showToast(`${name} を保存しました ✅`, 'success');
  
  // 設定画面のカード表示とモーダルを再更新
  const main = document.getElementById('main-content');
  if (main) renderSettings(main);
  showMachineManagementList();
};

window.deleteMachineConfig = function(id) {
  const machine = getMachineById(id);
  const name = machine ? machine.name : 'マシン';
  
  if (confirm(`「${name}」を削除しますか？\n(過去の記録データは消去されません)`)) {
    const machines = (window.GymneryFacility?.machines || []).filter(m => m.id !== id);
    window.GymneryFacility.machines = machines;
    localStorage.setItem('custom_machines', JSON.stringify(machines));

    closeModalCustom('machine-config-edit-modal');
    closeModalCustom('machine-management-modal');
    showToast(`${name} を削除しました`, 'info');

    const main = document.getElementById('main-content');
    if (main) renderSettings(main);
    showMachineManagementList();
  }
};

window.resetMachineConfigToDefault = function() {
  if (confirm('マシン設定をすべて初期状態に戻しますか？\n（カスタム追加したマシンや変更した重量設定が元に戻ります）')) {
    localStorage.removeItem('custom_machines');
    closeModalCustom('machine-management-modal');
    loadFacilityConfig().then(() => {
      showToast('マシン設定をデフォルトに戻しました 🔄', 'success');
      const main = document.getElementById('main-content');
      if (main) renderSettings(main);
    });
  }
};



// ========================================
// 種目ごとの詳細履歴モーダル (全セット・負荷一覧)
// ========================================
window.showMachineHistoryModal = async function(machineId) {
  const machine = getMachineById(machineId);
  if (!machine) return;

  const exercises = await getExercisesByMachine(machineId);
  for (const e of exercises) {
    e._resolvedDate = await getExerciseDate(e);
  }
  
  // 日付新しい順にソート
  exercises.sort((a, b) => b._resolvedDate - a._resolvedDate);

  let historyCardsHtml = '';
  if (exercises.length === 0) {
    historyCardsHtml = `<div class="empty-state" style="padding: 24px 0;"><div class="empty-icon">📝</div><div class="empty-text">この種目の記録はまだありません</div></div>`;
  } else {
    for (const ex of exercises) {
      const d = ex._resolvedDate;
      const dateStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 (${getDayOfWeek(d.toISOString())})`;
      const modeBadge = ex.saveMode ? `<span class="badge" style="background:var(--bg-elevated); color:var(--text-secondary); font-size:0.65rem; padding:2px 6px;">${ex.saveMode === 'ok' ? 'UP↑' : '維持→'}</span>` : '';
      const noteHtml = ex.note ? `<div class="text-xs text-muted mt-xs" style="background:var(--bg-secondary); padding:4px 8px; border-radius:4px;">💡 ${ex.note}</div>` : '';

      let setsContent = '';
      if (ex.type === 'strength' && Array.isArray(ex.data)) {
        let rows = '';
        ex.data.forEach((s, idx) => {
          rows += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.85rem;">
              <span style="color:var(--text-secondary); font-weight:bold; width:50px;">Set ${idx + 1}</span>
              <span style="font-weight:bold; color:var(--text-primary);">${s.weight || 0} kg</span>
              <span style="color:var(--accent); font-weight:bold;">${s.reps || 0} 回</span>
            </div>
          `;
        });
        setsContent = `<div style="margin-top:6px;">${rows}</div>`;
      } else if (ex.data) {
        let stats = [];
        if (ex.data.distance) stats.push(`距離: ${ex.data.distance} km`);
        if (ex.data.speed) stats.push(`速度: ${ex.data.speed} km/h`);
        if (ex.data.duration) stats.push(`時間: ${ex.data.duration} 分`);
        if (ex.data.resistance) stats.push(`負荷: レベル ${ex.data.resistance}`);
        setsContent = `<div style="font-size:0.85rem; color:var(--text-primary); font-weight:bold; margin-top:4px;">${stats.join(' · ')}</div>`;
      }

      historyCardsHtml += `
        <div class="card mb-sm" style="background:var(--bg-card); border:1px solid var(--border-color); padding:10px 14px;">
          <div class="flex items-center justify-between" style="border-bottom:1px solid var(--border-color); padding-bottom:6px;">
            <div class="text-xs font-bold" style="color:var(--text-primary);">${dateStr}</div>
            ${modeBadge}
          </div>
          ${setsContent}
          ${noteHtml}
        </div>
      `;
    }
  }

  const cameraBtn = machine.image ? `<span onclick="showMachinePhoto('${machine.id}')" style="cursor:pointer; font-size:1.0rem; padding: 2px 6px; background:var(--bg-secondary); border-radius:4px; margin-left:6px;" title="写真を見る">📷</span>` : '';
  const videoBtn = machine.videoUrl ? `<a href="${machine.videoUrl}" target="_blank" style="cursor:pointer; font-size:1.0rem; padding: 2px 6px; background:var(--bg-secondary); border-radius:4px; margin-left:4px; text-decoration:none;" title="動画を見る">🎬</a>` : '';

  const modalHtml = `
    <div class="modal-overlay" id="machine-history-modal">
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-handle"></div>
        <div class="flex items-center justify-between mb-md">
          <div class="modal-title" style="margin-bottom:0; font-size:1.05rem; display:flex; align-items:center;">
            <span style="color:${getCategoryColor(machine.category)}; margin-right:6px;">${getCategoryIcon(machine.category)}</span>
            <span>${machine.name} の履歴</span>
            ${cameraBtn}
            ${videoBtn}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="closeModalCustom('machine-history-modal')" style="color:var(--text-muted); font-size:14px;">✕ 閉じる</button>
        </div>

        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:12px;">過去 ${exercises.length} 回の実施ログ（各セットの負荷・回数）</div>

        <div style="max-height: 55vh; overflow-y: auto; padding-right: 2px;">
          ${historyCardsHtml}
        </div>

        <div class="flex gap-sm mt-md" style="border-top:1px solid var(--border-color); padding-top:10px;">
          <button class="btn btn-secondary" style="flex:1" onclick="closeModalCustom('machine-history-modal')">閉じる</button>
          <button class="btn btn-primary" style="flex:1" onclick="closeModalCustom('machine-history-modal'); openExerciseInput('${machine.id}')">＋ この種目を記録</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};
