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
    weights: [6.0, 11.0, 16.0, 21.0, 26.0, 31.0, 36.0, 41.0, 46.0, 51.0, 56.0, 61.0, 66.0, 71.0, 76.0, 81.0, 86.0, 91.0, 96.0, 101.0, 106.0],
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
    weights: [3.5, 6.0, 8.5, 11.0, 13.5, 16.0, 18.5, 21.0, 23.5, 28.5, 33.5, 38.5, 43.5, 48.5, 53.5, 58.5, 63.5, 68.5, 73.5, 78.5, 83.5],
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
    weights: [4.5, 7.0, 9.5, 12.0, 14.5, 17.0, 19.5, 22.0, 24.5, 29.5, 34.5, 39.5, 44.5, 49.5, 54.5, 59.5, 64.5, 69.5, 74.5, 79.5, 84.5],
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
    weights: [3.0, 5.0, 7.0, 9.0, 11.0, 13.0, 15.0, 17.0, 19.0, 23.0, 27.0, 31.0, 35.0, 39.0, 43.0, 47.0, 51.0, 55.0, 59.0, 63.0, 67.0],
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
    weights: [2.0, 3.5, 5.0, 6.5, 8.0, 9.5, 11.0, 12.5, 14.0, 17.0, 20.0, 23.0, 26.0, 29.0, 32.0, 35.0, 38.0, 41.0, 44.0, 47.0, 50.0],
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
    weights: [2.5, 4.0, 5.5, 7.0, 8.5, 10.0, 11.5, 13.0, 14.5, 17.5, 20.5, 23.5, 26.5, 29.5, 32.5, 35.5, 38.5, 41.5, 44.5, 47.5, 50.5],
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
    weights: [8.0, 18.0, 28.0, 38.0, 48.0, 58.0, 68.0, 78.0, 88.0, 98.0, 108.0, 118.0, 128.0, 138.0, 148.0, 158.0, 168.0, 178.0, 188.0, 198.0, 208.0],
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
    weights: [8.0, 18.0, 28.0, 38.0, 48.0, 58.0, 68.0, 78.0, 88.0, 98.0, 108.0, 118.0, 128.0, 138.0, 148.0, 158.0, 168.0, 178.0, 188.0, 198.0, 208.0],
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
    weights: [2.5, 4.0, 5.5, 7.0, 8.5, 10.0, 11.5, 13.0, 14.5, 16.0, 17.5, 19.0, 20.5, 23.5, 26.5, 29.5, 32.5, 35.5, 38.5, 41.5, 44.5],
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
    weights: [2.5, 4.0, 5.5, 7.0, 8.5, 10.0, 11.5, 13.0, 14.5, 16.0, 17.5, 19.0, 20.5, 23.5, 26.5, 29.5, 32.5, 35.5, 38.5, 41.5, 44.5],
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
    weights: [2.5, 4.0, 5.5, 7.0, 8.5, 10.0, 11.5, 13.0, 14.5, 16.0, 17.5, 19.0, 20.5, 23.5, 26.5, 29.5, 32.5, 35.5, 38.5, 41.5, 44.5],
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
    weights: [2.5, 4.0, 5.5, 7.0, 8.5, 10.0, 11.5, 13.0, 14.5, 16.0, 17.5, 19.0, 20.5, 23.5, 26.5, 29.5, 32.5, 35.5, 38.5, 41.5, 44.5],
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
    weights: [1.5, 2.8, 4.1, 5.4, 6.7, 8.0, 9.3, 10.6, 11.9, 14.5, 17.1, 19.7, 22.3, 24.9, 27.5, 30.1, 32.7, 35.3, 37.9, 40.5, 43.1],
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
    weights: [2.0, 3.5, 5.0, 6.5, 8.0, 9.5, 11.0, 12.5, 14.0, 17.0, 20.0, 23.0, 26.0, 29.0, 32.0, 35.0, 38.0, 41.0, 44.0, 47.0, 50.0],
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
    weights: [2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 22.0, 26.0, 30.0, 34.0, 38.0, 42.0, 46.0, 50.0, 54.0, 58.0, 62.0, 66.0],
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
    weights: [4.0, 5.5, 7.0, 8.5, 10.0, 11.5, 13.0, 14.5, 17.5, 20.5, 23.5, 26.5, 29.5, 32.5, 35.5, 38.5],
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
    weights: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 10.5, 12.5, 14.5, 16.5, 18.5, 20.5, 22.5, 24.5],
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
