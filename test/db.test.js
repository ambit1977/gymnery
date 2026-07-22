import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

let sandbox;

beforeAll(() => {
  // db.jsが依存するDexieの最低限の振る舞いモック
  sandbox = {
    Dexie: class {
      constructor() {
        this.sessions = {
          add: async (obj) => {
            // ここでオブジェクトのプロパティ評価時にReferenceErrorが起きないかチェックできる
            return 1;
          },
          update: async (id, obj) => {
            return 1;
          },
          get: async (id) => {
            return { id, startTime: new Date().toISOString() };
          },
          filter: () => ({
            first: async () => null
          })
        };
        this.exercises = {
          put: async (obj) => 1,
          where: () => ({
            equals: () => ({
              count: async () => 1
            }),
            first: async () => null
          })
        };
        this.bodyComposition = {
          add: async (obj) => 1
        };
      }
      version() {
        return {
          stores: () => {}
        };
      }
    },
    window: {},
    console,
    // v54/v55で導入された動的設定オブジェクト
    GymneryFacility: {
      name: 'テスト施設',
      machines: [
        { id: 'treadmill', name: 'トレッドミル', category: 'cardio', type: 'cardio', sheetCol: 'T' }
      ],
      categories: {
        cardio: { label: '有酸素', icon: '🏃', color: '#38bdf8' }
      }
    }
  };

  sandbox.window = sandbox;
  const code = fs.readFileSync(path.resolve(__dirname, '../db.js'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
});

describe('Database Operations (db.js)', () => {
  it('should create session without throwing ReferenceError', async () => {
    // startNewSession()の内部で呼ばれるcreateSession()がエラーを出さずに完了するかテスト
    await expect(sandbox.createSession()).resolves.toBe(1);
  });

  it('should end session without errors', async () => {
    await expect(sandbox.endSession(1, 'メモ')).resolves.toBeUndefined();
  });
});
