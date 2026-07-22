import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

let sandbox;

beforeAll(() => {
  // app.jsが依存するブラウザ/グローバルAPIのダミーモックをサンドボックスに定義
  sandbox = {
    Dexie: class {
      constructor() {}
      version() { return { stores: () => {} }; }
    },
    navigator: {
      serviceWorker: {
        register: () => Promise.resolve()
      }
    },
    document: {
      addEventListener: () => {},
      getElementById: () => ({ addEventListener: () => {} }),
      querySelector: () => null,
      querySelectorAll: () => []
    },
    addEventListener: () => {},
    window: {},
    console,
    activeSessionId: null,
    MACHINES: [],
    localStorage: {
      getItem: () => null,
      setItem: () => null
    },
    setTimeout: () => {}
  };
  
  // sandboxをグローバル空間としてapp.jsを実行
  sandbox.window = sandbox;
  const code = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
});

describe('getDaysDiff (app.js)', () => {
  it('should return 0 for the same date irrespective of hours', () => {
    const d1 = new Date('2026-07-14T10:00:00+09:00');
    const d2 = new Date('2026-07-14T22:00:00+09:00');
    expect(sandbox.getDaysDiff(d1, d2)).toBe(0);
  });

  it('should return 1 for next day even if hour difference is less than 24h', () => {
    const d1 = new Date('2026-07-15T08:00:00+09:00');
    const d2 = new Date('2026-07-14T20:00:00+09:00');
    expect(sandbox.getDaysDiff(d1, d2)).toBe(1);
  });

  it('should return 2 for 2 calendar days difference', () => {
    const d1 = new Date('2026-07-16T08:00:00+09:00');
    const d2 = new Date('2026-07-14T20:00:00+09:00');
    expect(sandbox.getDaysDiff(d1, d2)).toBe(2);
  });

  it('should handle string inputs correctly by parsing them', () => {
    expect(sandbox.getDaysDiff('2026-07-15', '2026-07-14')).toBe(1);
  });

  it('should return 0 for null/undefined or invalid strings without throwing errors', () => {
    expect(sandbox.getDaysDiff(null, undefined)).toBe(0);
    expect(sandbox.getDaysDiff('invalid-date', new Date())).toBe(0);
  });
});

describe('UI Rendering (app.js)', () => {
  beforeAll(() => {
    // UI表示に必要なグローバル変数をモック
    sandbox.GymneryFacility = {
      name: 'テスト区民館',
      address: '練馬区テスト1-2-3',
      phone: '03-0000-0000',
      openHours: '9:00 - 21:00',
      receptionHours: '9:00 - 17:00',
      closedDays: '年末年始',
      gymTarget: '15歳以上',
      gymHours: ['9:00 - 12:00'],
      gymFee: ['100円'],
      gymBelongings: '室内シューズ',
      gymProcedure: '受付へどうぞ',
      gymNotes: ['定員あり'],
      categories: {
        cardio: { label: '有酸素', icon: '🏃', color: '#38bdf8' }
      },
      machines: [
        { id: 'treadmill', name: 'トレッドミル', category: 'cardio', type: 'cardio', sheetCol: 'T' }
      ]
    };

    // db.jsが読み込まれていないテスト環境を考慮して最低限の取得関数を定義
    sandbox.getAllSessions = async () => [];
    sandbox.getLatestBodyComposition = async () => null;
    sandbox.getCategoryIcon = (cat) => '🏃';
    sandbox.getCategoryLabel = (cat) => '有酸素';
    sandbox.getCategoryColor = (cat) => '#38bdf8';
    sandbox.getDayOfWeek = () => '月';
  });

  it('should render home screen with start button when no active session', async () => {
    const mockMain = { innerHTML: '' };
    sandbox.activeSessionId = null;

    await sandbox.renderHome(mockMain);

    expect(mockMain.innerHTML).toContain('💪 トレーニング開始');
    expect(mockMain.innerHTML).toContain('持ち物チェックリスト');
    expect(mockMain.innerHTML).toContain('利用証');
  });

  it('should render settings screen with facility details', () => {
    const mockMain = { innerHTML: '' };
    sandbox.renderSettings(mockMain);

    expect(mockMain.innerHTML).toContain('📍 施設情報');
    expect(mockMain.innerHTML).toContain('テスト区民館');
    expect(mockMain.innerHTML).toContain('会員番号設定');
  });
});
