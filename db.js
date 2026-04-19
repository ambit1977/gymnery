// ========================================
// db.js - IndexedDB (Dexie.js) データベース層
// ========================================

const db = new Dexie('TrainingRoomApp');

db.version(1).stores({
  sessions: '++id, startTime, endTime',
  exercises: '++id, sessionId, machineId, category, type, createdAt',
  bodyComposition: '++id, date',
});

// ========================================
// セッション CRUD
// ========================================

async function createSession() {
  const id = await db.sessions.add({
    facility: FACILITY.name,
    startTime: new Date().toISOString(),
    endTime: null,
    note: '',
  });
  return id;
}

async function endSession(sessionId, note = '') {
  await db.sessions.update(sessionId, {
    endTime: new Date().toISOString(),
    note,
  });
}

async function getSession(id) {
  return db.sessions.get(id);
}

async function getAllSessions() {
  return db.sessions.orderBy('startTime').reverse().toArray();
}

async function deleteSession(sessionId) {
  await db.exercises.where('sessionId').equals(sessionId).delete();
  await db.sessions.delete(sessionId);
}

// ========================================
// エクササイズ CRUD
// ========================================

async function addExercise(sessionId, machineId, data) {
  const machine = getMachineById(machineId);
  const id = await db.exercises.add({
    sessionId,
    machineId,
    machineName: machine.name,
    category: machine.category,
    type: machine.type,
    data, // sets array for strength, or {duration, distance, ...} for cardio
    createdAt: new Date().toISOString(),
  });
  return id;
}

async function updateExercise(exerciseId, data) {
  await db.exercises.update(exerciseId, { data });
}

async function deleteExercise(exerciseId) {
  await db.exercises.delete(exerciseId);
}

async function getExercisesBySession(sessionId) {
  return db.exercises.where('sessionId').equals(sessionId).toArray();
}

async function getExercisesByMachine(machineId) {
  return db.exercises
    .where('machineId')
    .equals(machineId)
    .reverse()
    .sortBy('createdAt');
}

async function getAllExercises() {
  return db.exercises.orderBy('createdAt').reverse().toArray();
}

// ========================================
// 体組成 CRUD
// ========================================

async function addBodyComposition(data) {
  const id = await db.bodyComposition.add({
    date: data.date || new Date().toISOString().split('T')[0],
    weight: data.weight || null,
    bodyFat: data.bodyFat || null,
    muscleMass: data.muscleMass || null,
    bmi: data.bmi || null,
    visceralFat: data.visceralFat || null,
    note: data.note || '',
    createdAt: new Date().toISOString(),
  });
  return id;
}

async function updateBodyComposition(id, data) {
  await db.bodyComposition.update(id, data);
}

async function deleteBodyComposition(id) {
  await db.bodyComposition.delete(id);
}

async function getAllBodyComposition() {
  return db.bodyComposition.orderBy('date').reverse().toArray();
}

async function getLatestBodyComposition() {
  return db.bodyComposition.orderBy('date').last();
}

// ========================================
// エクスポート
// ========================================

async function exportAllDataToCSV() {
  const sessions = await getAllSessions();
  const exercises = await getAllExercises();
  const bodyComp = await getAllBodyComposition();

  const files = {};

  // セッション CSV
  let csv = 'ID,施設名,開始日時,終了日時,メモ\n';
  for (const s of sessions) {
    csv += `${s.id},"${s.facility}","${formatDateTime(s.startTime)}","${s.endTime ? formatDateTime(s.endTime) : ''}","${s.note || ''}"\n`;
  }
  files['sessions.csv'] = csv;

  // エクササイズ CSV
  csv = 'ID,セッションID,マシン,カテゴリ,タイプ,データ,記録日時\n';
  for (const e of exercises) {
    const dataStr = JSON.stringify(e.data).replace(/"/g, '""');
    csv += `${e.id},${e.sessionId},"${e.machineName}","${getCategoryLabel(e.category)}","${e.type}","${dataStr}","${formatDateTime(e.createdAt)}"\n`;
  }
  files['exercises.csv'] = csv;

  // 体組成 CSV
  csv = '日付,体重(kg),体脂肪率(%),筋肉量(kg),BMI,内臓脂肪レベル,メモ\n';
  for (const b of bodyComp) {
    csv += `"${b.date}",${b.weight || ''},${b.bodyFat || ''},${b.muscleMass || ''},${b.bmi || ''},${b.visceralFat || ''},"${b.note || ''}"\n`;
  }
  files['body_composition.csv'] = csv;

  return files;
}

async function exportSessionToCSV(sessionId) {
  const session = await getSession(sessionId);
  const exercises = await getExercisesBySession(sessionId);

  let csv = `セッション: ${formatDateTime(session.startTime)}\n`;
  csv += `施設: ${session.facility}\n\n`;
  csv += 'マシン,セット,重量/時間,回数/距離,その他\n';

  for (const ex of exercises) {
    const machine = getMachineById(ex.machineId);
    if (machine?.type === 'strength' && Array.isArray(ex.data)) {
      ex.data.forEach((set, i) => {
        const exerciseName = set.exercise ? `${machine.name}(${set.exercise})` : machine.name;
        csv += `"${exerciseName}",${i + 1},${set.weight || ''}kg,${set.reps || ''}回,\n`;
      });
    } else if (machine?.type === 'cardio') {
      csv += `"${machine.name}",,${ex.data.duration || ''}分,${ex.data.distance || ''}km,Lv${ex.data.level || ''}\n`;
    }
  }

  return csv;
}

function downloadCSV(filename, content) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadMultipleCSV(files) {
  for (const [filename, content] of Object.entries(files)) {
    downloadCSV(filename, content);
  }
}

// ========================================
// ヘルパー
// ========================================

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getSessionDuration(session) {
  if (!session.startTime || !session.endTime) return null;
  const ms = new Date(session.endTime) - new Date(session.startTime);
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}分`;
  return `${Math.floor(min / 60)}時間${min % 60}分`;
}

function getDayOfWeek(isoStr) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[new Date(isoStr).getDay()];
}
