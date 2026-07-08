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

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
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

  // Initialize default member ID C-41 if not present
  if (!localStorage.getItem('member_id')) {
    localStorage.setItem('member_id', 'C-41');
  }

  // Handle body composition URL parameters (Shortcut integration)
  await handleUrlParamsImport();

  // Setup navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  navigateTo('home');
  registerSW();
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
  headerSubtitle.textContent = '旭町南地区区民館';

  clearTimer();
  destroyCharts();
  renderPage(page);
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
}

function startTimer(startTime, timerContainer) {
  clearTimer();
  alertedMinutes.clear();
  const SESSION_DURATION = 60 * 60 * 1000; // 1時間

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
  Object.values(chartInstances).forEach(c => c.destroy());
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
        <div class="flex gap-sm mt-md">
          <button class="btn btn-primary btn-sm" onclick="showMachineSelect()" style="flex:1">＋ マシン記録</button>
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
  const todayStr = new Date().toISOString().split('T')[0];
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

  const checklistItems = [
    '靴', 'スマホ', 'スマホ充電', 'ワイヤレスイヤホン', 'タオル',
    '替靴下', '替下着', '替シャツ', '替ズボン', '洗面用具類',
    'スマートウォッチ', '小銭', 'ドリンクボトル', 'ビニール袋',
    'プロテイン飲む', 'ティッシュ / ウェットティッシュ'
  ];

  const memberId = localStorage.getItem('member_id') || 'C-41';

  // 会員証カードHTML
  const memberCardHtml = `
    <div class="card mb-md" style="background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-card-hover) 100%); border: 1px solid var(--accent-glow); padding: 16px; display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-md);">
      <div>
        <div class="text-xs text-muted" style="letter-spacing: 1px;">MEMBERSHIP CARD</div>
        <div class="text-md font-bold mt-xs" style="color: var(--text-primary); font-size: 1.1rem;">練馬区利用証</div>
      </div>
      <div class="text-right">
        <div class="text-xs text-muted">会員番号</div>
        <div class="text-lg font-bold" style="color: var(--accent); font-family: monospace; letter-spacing: 1px; font-size: 1.4rem;">${memberId}</div>
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
        <span class="text-sm font-bold flex items-center gap-xs">🎒 持ち物チェックリスト <span id="checklist-progress-badge" class="badge" style="background: var(--accent-glow); color: var(--accent); font-size: 0.7rem; padding: 2px 6px;">${checkedItems.length}/${checklistItems.length}</span></span>
        <span id="checklist-arrow" style="transform: ${isChecklistOpen ? 'rotate(90deg)' : 'rotate(0)'}; transition: transform 0.2s;">▶</span>
      </div>
      <div id="checklist-body" style="display: ${isChecklistOpen ? 'block' : 'none'}; padding: 12px 16px; background: var(--bg-card); max-height: 280px; overflow-y: auto;">
        ${checklistRowsHtml}
      </div>
    </div>
  `;

  main.innerHTML = `<div class="page">${memberCardHtml}${checklistHtml}${activeHtml}${recentHtml}${bodyHtml}</div>`;

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
  const note = document.getElementById('session-note')?.value || '';
  await endSession(activeSessionId, note);
  const sid = activeSessionId;
  activeSessionId = null;
  localStorage.removeItem('activeSessionId');
  clearTimer();
  closeModal();
  showToast('お疲れさまでした！🎉', 'success');
  showSessionDetail(sid);
  // Google Sheets 自動同期（設定がONの場合のみ）
  if (typeof gsheetsMaybeAutoSync === 'function') {
    gsheetsMaybeAutoSync().catch(e => console.warn('Sheets auto-sync:', e.message));
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
  
  // 今日のセッションで実施済みのマシンIDを取得
  const activeExs = activeSessionId ? await getExercisesBySession(activeSessionId) : [];
  const completedMachineIds = new Set(activeExs.map(e => e.machineId));

  const now = new Date();

  // モーダルの基本構造を出力
  let html = `
    <div class="modal-handle"></div>
    <div class="flex items-center justify-between mb-md">
      <div class="modal-title" style="margin-bottom:0">マシン選択</div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:4px 12px;font-size:14px;color:var(--text-secondary)">✕ 閉じる</button>
    </div>
    
    <!-- タブ切り替えバー -->
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

    for (const m of MACHINES) {
      // 実施済みのものは除外
      if (completedMachineIds.has(m.id)) {
        const past = await getExercisesByMachine(m.id);
        const lastDate = past && past.length > 0 ? new Date(past[0].createdAt) : null;
        const badgesHtml = await getPastThreeGrowthBadgesHtml(m.id);
        
        let daysStr = '今日';
        const cameraBtn = m.image ? `<span onclick="event.stopPropagation(); showMachinePhoto('${m.id}', 'select')" style="cursor:pointer; font-size:1.0rem; padding: 4px; background:var(--bg-secondary); border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
        const cardHtml = `
          <div class="machine-card" onclick="openExerciseInput('${m.id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer; transition: 0.2s; opacity: 0.5; filter: grayscale(50%);">
            <div style="display: flex; align-items: center; gap: var(--space-sm);">
              <div class="machine-icon" style="background:${getCategoryColor(m.category)}22; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${getCategoryIcon(m.category)}</div>
              <div class="machine-info">
                <div class="machine-name" style="font-weight: bold; font-size: 0.95rem;">${m.name}</div>
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

      const lastDate = new Date(past[0].createdAt);
      const diffTime = now - lastDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

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
        const daysStr = item.diffDays === 0 ? '今日' : (item.diffDays === 1 ? '昨日' : `中 ${item.diffDays} 日`);
        const badgesHtml = await getPastThreeGrowthBadgesHtml(m.id);

        const cameraBtn = m.image ? `<span onclick="event.stopPropagation(); showMachinePhoto('${m.id}', 'select')" style="cursor:pointer; font-size:1.0rem; padding: 4px; background:var(--bg-secondary); border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
        html += `
          <div class="machine-card" onclick="openExerciseInput('${m.id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer; transition: 0.2s;">
            <div style="display: flex; align-items: center; gap: var(--space-sm);">
              <div class="machine-icon" style="background:${getCategoryColor(m.category)}22; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${getCategoryIcon(m.category)}</div>
              <div class="machine-info">
                <div class="machine-name" style="font-weight: bold; font-size: 0.95rem;">${m.name}</div>
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
          const lastDate = new Date(past[0].createdAt);
          const diffTime = now - lastDate;
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          daysStr = diffDays === 0 ? '今日' : (diffDays === 1 ? '昨日' : `中 ${diffDays} 日`);

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
                <div class="machine-name" style="font-weight: bold; font-size: 0.95rem;">${m.name}</div>
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
async function openExerciseInput(machineId, editExerciseId = null, targetSessionId = null) {
  const machine = getMachineById(machineId);
  closeModal();
  await new Promise(r => setTimeout(r, 300));

  let lastData = null;
  let lastNote = '';
  let resolvedSessionId = targetSessionId;

  if (editExerciseId) {
    const db = new Dexie('TrainingRoomApp');
    db.version(1).stores({ exercises: '++id, sessionId, machineId, category, type, createdAt' });
    const ex = await db.exercises.get(editExerciseId);
    if (ex) {
      lastData = ex.data;
      lastNote = ex.note || '';
      resolvedSessionId = ex.sessionId; // 編集時はレコードの sessionId を使用
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
  // 進行中のアクティブセッションかつ、今回の編集/追加セッションと一致する場合のみタイマーを表示
  if (activeSessionId && activeSessionId === resolvedSessionId) {
    timerHeaderHtml = `
      <div id="modal-timer-header" class="text-center" style="color:var(--accent); background:var(--bg-elevated); border-radius:var(--radius-sm); padding:12px; margin-bottom:12px; font-size:1.3rem; font-weight:800; border: 2px solid var(--accent-glow);">
        終了まで: <span id="modal-timer-display" style="font-variant-numeric: tabular-nums;">--:--</span>
      </div>`;
  }

  let html = `<div class="modal-handle"></div>
    ${timerHeaderHtml}
    <div class="modal-title">${getCategoryIcon(machine.category)} ${machine.name}</div>`;

  if (machine.type === 'strength' && machine.hasSets) {
    let defaultSets = lastData && Array.isArray(lastData) ? lastData : [{}];
    // 新規作成時（editExerciseId が無い場合）は1セットのみ表示にする
    if (!editExerciseId && defaultSets.length > 0) {
      defaultSets = [defaultSets[0]];
    }
    html += `<div id="sets-container">`;
    defaultSets.forEach((s, i) => {
      html += renderSetRow(machine, i, s);
    });
    html += `</div>
      <div class="flex items-center gap-md mt-sm w-full">
        <button class="btn btn-secondary flex items-center justify-center" onclick="addSetRow('${machineId}')" style="width:40px; height:40px; border-radius:50%; padding:0; font-size:1.5rem; flex-shrink:0;">＋</button>
        <button class="btn btn-secondary flex items-center justify-center" onclick="startIntervalTimer('${machineId}')" style="border-radius:20px; padding:0 20px; height:40px; font-weight:bold; flex-grow:1;">＋ インターバル</button>
      </div>
      <div id="interval-timer-container" class="card mt-md" style="display:none; align-items:center; justify-content:space-between; padding:12px 20px;">
        <div id="interval-display" class="timer-safe" style="font-size:2.2rem; font-weight:800; font-variant-numeric: tabular-nums; line-height:1;">01:00</div>
        <button class="btn btn-secondary btn-sm" onclick="addOneMinuteToInterval()" style="padding:6px 12px; border-radius:var(--radius-sm); font-weight:bold;">＋1分</button>
      </div>`;
  } else {
    // Cardio
    html += `<div id="cardio-inputs">`;
    for (const f of machine.fields) {
      const val = lastData ? (lastData[f.key] || '') : '';
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
        <button class="btn btn-secondary" onclick="closeModal();showSessionDetail(${resolvedSessionId})" style="flex:1">戻る</button>
        <button class="btn btn-primary" onclick="saveExercise('${machineId}', ${editExerciseId}, 'update')" style="flex:1">更新</button>
      </div>`;
  } else if (targetSessionId) {
    // 過去セッションへの新規追加モード
    html += `
      <div class="flex gap-sm mt-lg">
        <button class="btn btn-secondary" onclick="showPastSessionMachineSelect(${targetSessionId})" style="flex:1">戻る</button>
        <button class="btn btn-primary" onclick="saveExercise('${machineId}', null, 'ok', ${targetSessionId})" style="flex:1">保存</button>
      </div>`;
  } else {
    // 通常の進行中セッション追加モード
    html += `
      <div class="flex gap-sm mt-lg flex-wrap">
        <button class="btn btn-secondary" onclick="closeModal();showMachineSelect()" style="flex:1; min-width: 80px;">戻る</button>
        <button class="btn btn-secondary" onclick="saveExercise('${machineId}', null, 'again')" style="flex:1; min-width: 80px; background:var(--bg-card-hover);">再度(維持)</button>
        <button class="btn btn-primary" onclick="saveExercise('${machineId}', null, 'ok')" style="flex:1; min-width: 80px;">OK(次回UP)</button>
      </div>`;
  }

  showModal(html);
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
        await saveMachineSetting(machineId, { data: [defaultData[0]], note: machineNote });
      } else {
        await saveMachineSetting(machineId, { data: defaultData, note: machineNote });
      }
    }
  }

  if (intervalTimerId) { clearInterval(intervalTimerId); intervalTimerId = null; }
  closeModal();

  if (editExerciseId || targetSessionId) {
    // 過去セッションの編集・追加時は詳細画面に戻る
    showSessionDetail(resolvedSessionId);
  } else {
    navigateTo('home');
  }
}

function startIntervalTimer(machineId) {
  const container = document.getElementById('interval-timer-container');
  const display = document.getElementById('interval-display');
  
  if (!container || !display) return;
  
  container.style.display = 'flex';
  display.className = 'timer-safe';
  
  // デフォルト1分(60秒)で開始
  intervalTimerEndTime = Date.now() + 60 * 1000;
  if (intervalTimerId) clearInterval(intervalTimerId);
  
  let hasTriggeredEnd = false;
  
  const updateDisplay = () => {
    const remainMs = intervalTimerEndTime - Date.now();
    
    if (remainMs <= 0) {
      // タイムアップ時（最初の一度だけアラートと行追加を実行）
      if (!hasTriggeredEnd) {
        hasTriggeredEnd = true;
        if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
        addSetRow(machineId);
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
  if (intervalTimerId) {
    intervalTimerEndTime += 60 * 1000;
    showToast('インターバルを1分追加しました ⏲️', 'success');
  }
}

// ========================================
// モーダル管理
// ========================================
function showModal(contentHtml) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${contentHtml}</div>`;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

// ========================================
// セッション詳細
// ========================================
async function showSessionDetail(sessionId) {
  const session = await getSession(sessionId);
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
    const cat = CATEGORIES[catKey];
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
  showSessionDetail(sessionId);
}

function confirmDeleteSession(sessionId) {
  const isLinked = localStorage.getItem('gs_spreadsheet_id') && localStorage.getItem('gs_authed') === '1';
  let sheetsOptionHtml = '';
  
  if (isLinked) {
    sheetsOptionHtml = `
      <label class="flex items-center gap-xs mt-md mb-xs" style="cursor: pointer; user-select: none; font-size: 0.85rem;">
        <input type="checkbox" id="delete-from-sheets-checkbox" checked style="width: 16px; height: 16px; accent-color: var(--danger);">
        <span style="color: var(--text-secondary);">☁️ Googleスプレッドシートからも削除する</span>
      </label>
    `;
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

  // Google Sheetsの削除連携を実行
  if (deleteFromSheets && typeof gsheetsDeleteSessionAndExercises === 'function') {
    gsheetsDeleteSessionAndExercises(sessionId).catch(e => console.error('Delete sync failed:', e));
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
      facility: FACILITY.name,
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
      <div class="flex gap-xs mb-md" style="background:var(--bg-secondary); padding:4px; border-radius:var(--radius-md); border: 1px solid var(--border-color);">
        <button id="tab-sessions" class="btn btn-sm ${currentHistoryTab === 'sessions' ? 'btn-primary' : 'btn-ghost'}" onclick="switchHistoryTab('sessions')" style="flex:1; border-radius:var(--radius-sm);">セッション履歴</button>
        <button id="tab-machines" class="btn btn-sm ${currentHistoryTab === 'machines' ? 'btn-primary' : 'btn-ghost'}" onclick="switchHistoryTab('machines')" style="flex:1; border-radius:var(--radius-sm);">種目履歴 (2週間)</button>
      </div>
      <div id="history-tab-content"></div>
    </div>`;

  if (currentHistoryTab === 'sessions') {
    await renderSessionsTab(document.getElementById('history-tab-content'));
  } else {
    await renderMachinesTab(document.getElementById('history-tab-content'));
  }
}

async function switchHistoryTab(tab) {
  currentHistoryTab = tab;
  const main = document.getElementById('main-content');
  if (main) {
    await renderHistory(main);
  }
}

async function renderSessionsTab(container) {
  const sessions = await getAllSessions();
  let calendarHtml = renderCalendar(new Date(), sessions);
  let listHtml = '';

  for (const s of sessions) {
    if (s.id === activeSessionId && !s.endTime) continue;
    const exs = await getExercisesBySession(s.id);
    const cats = [...new Set(exs.map(e => e.category))];
    const badges = cats.map(c => `<span class="badge badge-${c}">${getCategoryIcon(c)} ${getCategoryLabel(c)}</span>`).join('');
    const d = new Date(s.startTime);
    listHtml += `
      <div class="history-item" onclick="showSessionDetail(${s.id})" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer;">
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
    <div id="calendar-container">${calendarHtml}</div>
    <div class="flex gap-sm mb-lg">
      <button class="btn btn-secondary btn-sm" onclick="exportAll()" style="flex:1">📥 全データエクスポート</button>
      <button class="btn btn-primary btn-sm" onclick="showAddPastSession()" style="flex:1">＋ 手動追加</button>
    </div>
    <div class="section-title">全セッション</div>
    ${listHtml || '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">まだ履歴がありません</div></div>'}`;
}

async function renderMachinesTab(container) {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  // すべてのエクササイズ履歴を取得
  const exercises = await getAllExercises();
  
  // マシンIDごとの最終実施日をマッピング
  const lastExecutionMap = new Map();
  exercises.forEach(e => {
    const date = new Date(e.createdAt);
    if (!lastExecutionMap.has(e.machineId) || date > lastExecutionMap.get(e.machineId)) {
      lastExecutionMap.set(e.machineId, date);
    }
  });

  // 過去2週間以内に実施されたマシンを抽出＆古い順にソート
  const machineHistory = [];
  lastExecutionMap.forEach((lastDate, machineId) => {
    if (lastDate >= twoWeeksAgo) {
      const machine = getMachineById(machineId);
      if (machine) {
        machineHistory.push({
          machine,
          lastDate,
        });
      }
    }
  });

  // 最終実施日が「古い順」にソート
  machineHistory.sort((a, b) => a.lastDate - b.lastDate);

  let listHtml = '';
  for (const item of machineHistory) {
    const m = item.machine;
    const diffTime = now - item.lastDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    let daysStr = '';
    let badgeColor = 'var(--text-secondary)';
    
    if (diffDays === 0) {
      daysStr = '今日';
    } else if (diffDays === 1) {
      daysStr = '昨日';
    } else {
      daysStr = `中 ${diffDays} 日`;
    }

    // 回復度の色の計算
    if (m.category === 'upper' || m.category === 'arm') {
      badgeColor = diffDays < 2 ? '#ff6b6b' : (diffDays === 2 ? '#ffe66d' : '#4ecdc4');
    } else if (m.category === 'lower') {
      badgeColor = diffDays < 3 ? '#ff6b6b' : (diffDays === 3 ? '#ffe66d' : '#4ecdc4');
    } else if (m.category === 'core') {
      badgeColor = diffDays < 1 ? '#ff6b6b' : (diffDays === 1 ? '#ffe66d' : '#4ecdc4');
    } else {
      badgeColor = '#4ecdc4';
    }

    const cameraBtn = m.image ? `<span onclick="event.stopPropagation(); showMachinePhoto('${m.id}')" style="cursor:pointer; font-size:1.0rem; padding: 4px; background:var(--bg-secondary); border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;" title="写真を見る">📷</span>` : '';
    listHtml += `
      <div class="machine-card" onclick="openExerciseInput('${m.id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer;">
        <div style="display: flex; align-items: center; gap: var(--space-sm);">
          <div class="machine-icon" style="background:${getCategoryColor(m.category)}22; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${getCategoryIcon(m.category)}</div>
          <div class="machine-info">
            <div class="machine-name" style="font-weight: bold; font-size: 0.95rem;">${m.name}</div>
            <div class="machine-meta" style="font-size: 0.75rem; color: var(--text-secondary);">
              最終実施: ${item.lastDate.getMonth() + 1}月${item.lastDate.getDate()}日 (${getDayOfWeek(item.lastDate.toISOString())})
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${cameraBtn}
          <span class="badge" style="color: ${badgeColor}; background: ${badgeColor}15; border: 1px solid ${badgeColor}33; font-size: 0.75rem; padding: 3px 8px; border-radius: 12px; font-weight: bold;">${daysStr}</span>
          <div class="machine-arrow" style="color: var(--text-secondary); font-size: 1.2rem;">›</div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="section-title">過去2週間の実施種目 (古い順)</div>
    <p class="text-xs text-muted mb-md">しばらく実施していない種目から並んでいます。</p>
    ${listHtml || '<div class="empty-state"><div class="empty-icon">🏋️</div><div class="empty-text">過去2週間に実施した種目がありません</div></div>'}`;
}

let calendarDate = new Date();

function renderCalendar(date, sessions) {
  calendarDate = date;
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const sessionDates = new Set();
  sessions.forEach(s => {
    const d = new Date(s.startTime);
    if (d.getFullYear() === year && d.getMonth() === month) {
      sessionDates.add(d.getDate());
    }
  });

  const labels = ['日','月','火','水','木','金','土'];
  let grid = labels.map(l => `<div class="calendar-day-label">${l}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    grid += `<div class="calendar-day other-month"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const hasSession = sessionDates.has(d);
    grid += `<div class="calendar-day${isToday ? ' today' : ''}${hasSession ? ' has-session' : ''}">${d}</div>`;
  }

  return `
    <div class="calendar">
      <div class="calendar-header">
        <button class="btn btn-ghost btn-sm" onclick="changeCalendarMonth(-1)">‹</button>
        <span class="calendar-month">${year}年${month + 1}月</span>
        <button class="btn btn-ghost btn-sm" onclick="changeCalendarMonth(1)">›</button>
      </div>
      <div class="calendar-grid">${grid}</div>
    </div>`;
}

async function changeCalendarMonth(offset) {
  const newDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + offset, 1);
  const sessions = await getAllSessions();
  document.getElementById('calendar-container').innerHTML = renderCalendar(newDate, sessions);
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
      chartInstances['weight'] = null;
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
    machineDataMap.set(machineId, sorted);
    
    sorted.forEach(e => {
      const dateLabel = formatDate(e.createdAt).slice(5); // "MM/DD"
      allDatesSet.add(dateLabel);
    });
  }

  // 日付ラベルを時系列順にソート (MM/DD を昇順ソート)
  // 年またぎなどの処理を簡略化するため、作成日付（タイムスタンプ）で順序を決定します。
  const allExercises = [];
  for (const [id, list] of machineDataMap.entries()) {
    allExercises.push(...list);
  }
  allExercises.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const uniqueDateLabels = [...new Set(allExercises.map(e => formatDate(e.createdAt).slice(5)))];

  // データセットを作成
  const datasets = checkedMachineIds.map((machineId, idx) => {
    const m = getMachineById(machineId);
    const sortedList = machineDataMap.get(machineId) || [];
    
    // 日付ごとの最大重量マップを作成
    const weightMapByDate = new Map();
    sortedList.forEach(e => {
      const dateLabel = formatDate(e.createdAt).slice(5);
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
  main.innerHTML = `
    <div class="page">
      <div class="card mb-md" style="line-height: 1.6;">
        <div class="text-sm font-bold mb-xs">📍 施設情報</div>
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

      <div class="card mb-md">
        <div class="text-sm font-bold mb-sm">🪪 会員番号設定</div>
        <p class="text-xs text-muted mb-md">受付用の会員番号（利用証番号）を登録します。</p>
        <div class="flex gap-sm">
          <input type="text" class="input text-xs" id="setting-member-id" value="${localStorage.getItem('member_id') || 'C-41'}" placeholder="C-41" style="flex:2;">
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
        <div class="text-sm font-bold mb-sm">🗑 データ管理</div>
        <p class="text-xs text-muted mb-md">すべてのデータを削除します（元に戻せません）</p>
        <button class="btn btn-danger btn-sm btn-block" onclick="confirmClearAll()">全データ削除</button>
      </div>

      <div class="text-center mt-lg">
        <div class="text-xs text-muted">トレーニング記録アプリ v2.0</div>
        <div class="text-xs text-muted mt-sm">データはこのデバイスにのみ保存されます</div>
      </div>
    </div>`;

  // Google Sheets カードをデータ入出力カードの直前に差し込む
  if (typeof gsheetsSettingsHtml === 'function') {
    const dataCard = main.querySelector('.page .card:nth-child(4)'); // 元の4に戻す
    const sheetsDiv = document.createElement('div');
    sheetsDiv.innerHTML = gsheetsSettingsHtml();
    if (dataCard) {
      dataCard.parentNode.insertBefore(sheetsDiv.firstElementChild, dataCard);
    }
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
    await importDataFromCSV(files);
    showToast('データのインポートが完了しました', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch (e) {
    console.error(e);
    showToast('インポートに失敗しました', 'danger');
  }
}

async function showMachineDefaults() {
  const allSettings = await getAllMachineSettings();
  const settingsMap = {};
  allSettings.forEach(s => settingsMap[s.machineId] = s.data);

  const cats = Object.keys(CATEGORIES);
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
      await navigator.serviceWorker.register('sw.js');
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
