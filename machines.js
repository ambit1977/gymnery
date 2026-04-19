// ========================================
// machines.js - マシン・施設データ定義
// 旭町南地区区民館トレーニング室の実際の設備に基づく
// ========================================

const FACILITY = {
  name: '旭町南地区区民館',
  address: '練馬区旭町1-16-1',
  phone: '03-3904-5191',
  fee: '1時間 100円',
};

// マシンカテゴリ定義
const CATEGORIES = {
  upper: { label: '上半身', icon: '💪', color: '#4ecdc4' },
  lower: { label: '下半身', icon: '🦵', color: '#ff6b6b' },
  core: { label: '体幹', icon: '🧘', color: '#ffe66d' },
  arm: { label: '腕', icon: '🤜', color: '#a855f7' },
};

// マシン定義 — スプレッドシートの列順序に対応
// スプレッドシート: 日付, 時刻, チェストプレス〜アームエクステンション
const MACHINES = [
  // === 上半身 ===
  {
    id: 'chest_press',
    name: 'チェストプレス',
    category: 'upper',
    type: 'strength',
    sheetCol: 'C',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'fly',
    name: 'フライ',
    category: 'upper',
    type: 'strength',
    sheetCol: 'D',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'lat_pulldown',
    name: 'ラットプルダウン',
    category: 'upper',
    type: 'strength',
    sheetCol: 'E',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'shoulder_press',
    name: 'ショルダープレス',
    category: 'upper',
    type: 'strength',
    sheetCol: 'Q',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },

  // === 下半身 ===
  {
    id: 'leg_curl',
    name: 'レッグカール',
    category: 'lower',
    type: 'strength',
    sheetCol: 'F',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'leg_extension',
    name: 'レッグエクステンション',
    category: 'lower',
    type: 'strength',
    sheetCol: 'G',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'leg_press',
    name: 'レッグプレス',
    category: 'lower',
    type: 'strength',
    sheetCol: 'H',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'calf_raise',
    name: 'カーフレイズ',
    category: 'lower',
    type: 'strength',
    sheetCol: 'I',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'adduction',
    name: 'アダクション',
    category: 'lower',
    type: 'strength',
    sheetCol: 'J',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'abduction',
    name: 'アブダクション',
    category: 'lower',
    type: 'strength',
    sheetCol: 'K',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'glute',
    name: 'グルート',
    category: 'lower',
    type: 'strength',
    sheetCol: 'L',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },

  // === 体幹 ===
  {
    id: 'knee_raise',
    name: 'ニーレイズ',
    category: 'core',
    type: 'strength',
    sheetCol: 'M',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'rotary_torso',
    name: 'ロータリートーソ',
    category: 'core',
    type: 'strength',
    sheetCol: 'N',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.1, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'abdominal',
    name: 'アブドミナル',
    category: 'core',
    type: 'strength',
    sheetCol: 'O',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'back_extension',
    name: 'バック',
    altName: 'バックエクステンション',
    category: 'core',
    type: 'strength',
    sheetCol: 'P',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },

  // === 腕 ===
  {
    id: 'arm_curl',
    name: 'アームカール',
    category: 'arm',
    type: 'strength',
    sheetCol: 'R',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.1, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
  {
    id: 'arm_extension',
    name: 'アームエクステンション',
    category: 'arm',
    type: 'strength',
    sheetCol: 'S',
    fields: [
      { key: 'weight', label: '重量', unit: 'kg', type: 'number', step: 0.5, min: 0 },
      { key: 'reps', label: '回数', unit: '回', type: 'number', step: 1, min: 0 },
    ],
    hasSets: true,
  },
];

// ヘルパー関数
function getMachineById(id) {
  return MACHINES.find(m => m.id === id);
}

function getMachinesByCategory(category) {
  return MACHINES.filter(m => m.category === category);
}

function getCategoryLabel(category) {
  return CATEGORIES[category]?.label || category;
}

function getCategoryIcon(category) {
  return CATEGORIES[category]?.icon || '🏋️';
}

function getCategoryColor(category) {
  return CATEGORIES[category]?.color || '#888';
}
