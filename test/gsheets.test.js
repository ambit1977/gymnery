import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

let sandbox;

beforeAll(() => {
  // gsheets.jsが依存するグローバル関数のモック
  const store = {};
  sandbox = {
    db: {
      sessions: { toArray: () => Promise.resolve([]) },
      exercises: { toArray: () => Promise.resolve([]) }
    },
    console,
    Date,
    parseInt,
    localStorage: {
      getItem: (key) => store[key] || null,
      setItem: (key, val) => { store[key] = String(val); },
      removeItem: (key) => { delete store[key]; }
    },
    window: {}
  };
  sandbox.window = sandbox;
  
  // gsheets.jsを読み込んで実行
  const code = fs.readFileSync(path.resolve(__dirname, '../gsheets.js'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
});

describe('formatLocalForSheets (gsheets.js)', () => {
  it('should format ISO string to local YYYY/MM/DD HH:mm:ss in JST timezone', () => {
    const isoStr = '2026-07-14T10:30:15.000Z'; // UTC 10:30 ➡️ JST 19:30
    const d = new Date(isoStr);
    const pad = (n) => String(n).padStart(2, '0');
    const systemLocalStr = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    expect(sandbox.GymneryGSheets.formatLocalForSheets(isoStr)).toBe(systemLocalStr);
  });

  it('should return empty string for empty input', () => {
    expect(sandbox.GymneryGSheets.formatLocalForSheets('')).toBe('');
    expect(sandbox.GymneryGSheets.formatLocalForSheets(null)).toBe('');
  });

  it('should return original string if input is not a parseable date', () => {
    expect(sandbox.GymneryGSheets.formatLocalForSheets('not-a-date')).toBe('not-a-date');
  });
});
