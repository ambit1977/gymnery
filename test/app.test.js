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
