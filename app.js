// ========================================
// app.js - メインアプリケーション
// ========================================

let currentPage = 'home';
let activeSessionId = null;
let timerInterval = null;
let alertedMinutes = new Set();
let chartInstances = {};

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

  // Setup navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  navigateTo('home');
  registerSW();
});

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
      }
      exListHtml += `
        <div class="exercise-item" style="border-left:3px solid ${catColor}; cursor:pointer" onclick="openExerciseInput('${ex.machineId}', ${ex.id})">
          <div class="exercise-header">
            <span class="exercise-name">${getCategoryIcon(ex.category)} ${ex.machineName}</span>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); confirmDeleteExercise(${ex.id},${activeSessionId})" style="color:var(--danger);padding:4px">✕</button>
          </div>
          <div class="exercise-sets">${setsHtml}</div>
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

  main.innerHTML = `<div class="page">${activeHtml}${recentHtml}${bodyHtml}</div>`;

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
}

// ========================================
// マシン選択
// ========================================
function showMachineSelect() {
  const cats = Object.keys(CATEGORIES);
  let html = `
    <div class="modal-handle"></div>
    <div class="flex items-center justify-between mb-md">
      <div class="modal-title" style="margin-bottom:0">マシン選択</div>
      <button class="btn btn-ghost btn-sm" onclick="closeModal()" style="padding:4px 12px;font-size:14px;color:var(--text-secondary)">✕ 閉じる</button>
    </div>
  `;
  for (const cat of cats) {
    const machines = getMachinesByCategory(cat);
    html += `<div class="category-section">
      <div class="category-header">
        <span class="category-icon">${getCategoryIcon(cat)}</span>
        <span class="category-label" style="color:${getCategoryColor(cat)}">${getCategoryLabel(cat)}</span>
      </div>`;
    for (const m of machines) {
      html += `
        <div class="machine-card" onclick="openExerciseInput('${m.id}')">
          <div class="machine-icon" style="background:${getCategoryColor(cat)}22">${getCategoryIcon(cat)}</div>
          <div class="machine-info">
            <div class="machine-name">${m.name}</div>
            ${m.altName ? `<div class="machine-meta">${m.altName}</div>` : ''}
          </div>
          <div class="machine-arrow">›</div>
        </div>`;
    }
    html += `</div>`;
  }
  showModal(html);
}

// ========================================
// エクササイズ入力
// ========================================
async function openExerciseInput(machineId, editExerciseId = null) {
  const machine = getMachineById(machineId);
  closeModal();
  await new Promise(r => setTimeout(r, 300));

  let lastData = null;
  if (editExerciseId) {
    const db = new Dexie('TrainingRoomApp');
    db.version(1).stores({ exercises: '++id, sessionId, machineId, category, type, createdAt' });
    const ex = await db.exercises.get(editExerciseId);
    if (ex) lastData = ex.data;
  } else {
    const pastExercises = await getExercisesByMachine(machineId);
    lastData = pastExercises.length > 0 ? pastExercises[0].data : null;
  }

  let html = `<div class="modal-handle"></div>
    <div class="modal-title">${getCategoryIcon(machine.category)} ${machine.name}</div>`;

  if (machine.type === 'strength' && machine.hasSets) {
    const defaultSets = lastData && Array.isArray(lastData) ? lastData : [{}];
    html += `<div id="sets-container">`;
    defaultSets.forEach((s, i) => {
      html += renderSetRow(machine, i, s);
    });
    html += `</div>
      <button class="btn btn-ghost btn-sm w-full mt-sm" onclick="addSetRow('${machineId}')">＋ セット追加</button>`;
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
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal();showMachineSelect()" style="flex:1">戻る</button>
      <button class="btn btn-primary" onclick="saveExercise('${machineId}', ${editExerciseId || 'null'})" style="flex:1">${editExerciseId ? '更新' : '保存'}</button>
    </div>`;

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

async function saveExercise(machineId, editExerciseId = null) {
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

  if (editExerciseId) {
    await updateExercise(editExerciseId, data);
    showToast(`${machine.name} を更新しました ✅`, 'success');
  } else {
    await addExercise(activeSessionId, machineId, data);
    showToast(`${machine.name} を記録しました ✅`, 'success');
  }

  closeModal();
  navigateTo('home');
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
      exHtml += `
        <div class="exercise-item" style="border-left:3px solid ${catColor}">
          <div class="exercise-header">
            <span class="exercise-name">${getCategoryIcon(ex.category)} ${ex.machineName}</span>
            <button class="btn btn-ghost btn-sm" onclick="confirmDeleteExercise(${ex.id},${sessionId})" style="color:var(--danger);padding:4px">✕</button>
          </div>
          <div class="exercise-sets">${setsHtml}</div>
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
      }
      exHtml += `
        <div class="exercise-item" style="border-left:3px solid ${catColor}">
          <div class="exercise-header">
            <span class="exercise-name">${getCategoryIcon(ex.category)} ${ex.machineName}</span>
            <button class="btn btn-ghost btn-sm" onclick="confirmDeleteExercise(${ex.id},${sessionId})" style="color:var(--danger);padding:4px">✕</button>
          </div>
          <div class="exercise-cardio-stats">${statsHtml}</div>
        </div>`;
    }
  }

  const d = new Date(session.startTime);
  main.innerHTML = `
    <div class="page">
      <button class="header-back mb-md" onclick="navigateTo('${currentPage === 'home' ? 'home' : 'history'}')">← 戻る</button>
      <div class="card mb-lg">
        <div class="text-sm text-muted">${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 (${getDayOfWeek(session.startTime)})</div>
        <div class="flex items-center justify-between mt-sm">
          <div class="text-sm">${formatTime(session.startTime)}${session.endTime ? ' - ' + formatTime(session.endTime) : ' 〜'}</div>
          ${session.endTime ? `<div class="badge" style="background:var(--accent-glow);color:var(--accent)">${getSessionDuration(session)}</div>` : '<div class="badge" style="background:var(--accent-glow);color:var(--accent)">進行中</div>'}
        </div>
        ${session.note ? `<div class="text-sm text-muted mt-sm">📝 ${session.note}</div>` : ''}
      </div>
      <div class="section-title">${exercises.length}種目</div>
      ${exHtml || '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">記録がありません</div></div>'}
      <div class="flex gap-sm mt-lg">
        <button class="btn btn-secondary btn-sm" onclick="exportSession(${sessionId})" style="flex:1">📥 CSV出力</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteSession(${sessionId})" style="flex:1">🗑 削除</button>
      </div>
    </div>`;
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
  showModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">このセッションを削除しますか？</div>
    <p class="text-sm text-muted">関連するすべての記録も削除されます。</p>
    <div class="flex gap-sm mt-lg">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1">キャンセル</button>
      <button class="btn btn-danger" onclick="doDeleteSession(${sessionId})" style="flex:1">削除</button>
    </div>`);
}

async function doDeleteSession(sessionId) {
  if (sessionId === activeSessionId) {
    activeSessionId = null;
    localStorage.removeItem('activeSessionId');
    clearTimer();
  }
  await deleteSession(sessionId);
  closeModal();
  showToast('セッションを削除しました', 'success');
  navigateTo('history');
}

// ========================================
// 履歴画面
// ========================================
async function renderHistory(main) {
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

  main.innerHTML = `
    <div class="page">
      <div id="calendar-container">${calendarHtml}</div>
      <button class="btn btn-secondary btn-sm w-full mb-lg" onclick="exportAll()">📥 全データCSVエクスポート</button>
      <div class="section-title">全セッション</div>
      ${listHtml || '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">まだ履歴がありません</div></div>'}
    </div>`;
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
      <div class="section-title">重量推移</div>
      <div class="input-group">
        <select class="input input-sm" id="stats-machine-select" onchange="renderWeightChart()">
          ${machineOptions}
        </select>
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
  const select = document.getElementById('stats-machine-select');
  if (!select) return;
  const machineId = select.value;
  const exercises = await getExercisesByMachine(machineId);

  // Reverse to chronological
  const sorted = [...exercises].reverse();
  const labels = sorted.map(e => formatDate(e.createdAt).slice(5));
  const maxWeights = sorted.map(e => {
    if (Array.isArray(e.data)) return Math.max(...e.data.map(s => s.weight || 0));
    return 0;
  });

  if (chartInstances['weight']) chartInstances['weight'].destroy();

  const ctx = document.getElementById('weight-chart');
  chartInstances['weight'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '最大重量 (kg)',
        data: maxWeights,
        borderColor: '#00d4aa',
        backgroundColor: 'rgba(0,212,170,0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00d4aa',
        pointBorderColor: '#0a0e17',
        pointBorderWidth: 2,
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
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
      <div class="card mb-md">
        <div class="text-sm font-bold mb-sm">📍 施設情報</div>
        <div class="text-sm">${FACILITY.name}</div>
        <div class="text-xs text-muted">${FACILITY.address}</div>
        <div class="text-xs text-muted">☎ ${FACILITY.phone}</div>
        <div class="text-xs text-muted">💰 ${FACILITY.fee}</div>
      </div>

      <div class="card mb-md">
        <div class="text-sm font-bold mb-sm">📥 データエクスポート</div>
        <p class="text-xs text-muted mb-md">全データをCSVファイルでダウンロードします</p>
        <button class="btn btn-secondary btn-sm btn-block" onclick="exportAll()">CSVエクスポート</button>
      </div>

      <div class="card mb-md">
        <div class="text-sm font-bold mb-sm">🗑 データ管理</div>
        <p class="text-xs text-muted mb-md">すべてのデータを削除します（元に戻せません）</p>
        <button class="btn btn-danger btn-sm btn-block" onclick="confirmClearAll()">全データ削除</button>
      </div>

      <div class="text-center mt-lg">
        <div class="text-xs text-muted">トレーニング記録アプリ v1.0</div>
        <div class="text-xs text-muted mt-sm">データはこのデバイスにのみ保存されます</div>
      </div>
    </div>`;
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
