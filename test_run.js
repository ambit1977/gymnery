import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('/Users/ambit/GAI/個人開発/トレーニング室アプリ/index.html', 'utf-8');
const js = fs.readFileSync('/Users/ambit/GAI/個人開発/トレーニング室アプリ/app.js', 'utf-8');
const dbjs = fs.readFileSync('/Users/ambit/GAI/個人開発/トレーニング室アプリ/db.js', 'utf-8');

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "dangerously",
  resources: "usable"
});

// Mock some APIs
dom.window.localStorage = {
  store: {},
  getItem: function(k) { return this.store[k] || null; },
  setItem: function(k, v) { this.store[k] = String(v); },
  removeItem: function(k) { delete this.store[k]; }
};

dom.window.Dexie = class {
  constructor() {}
  version() { return { stores: () => {} }; }
};
dom.window.navigator.serviceWorker = { register: async () => {} };
dom.window.Chart = class { constructor() {} };
dom.window.GymneryFacility = {
  name: 'Test',
  machines: []
};

// Catch errors
dom.window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error("Browser Error:", msg, lineNo, error);
};

// Evaluate scripts
try {
  const scriptEl1 = dom.window.document.createElement('script');
  scriptEl1.textContent = dbjs;
  dom.window.document.body.appendChild(scriptEl1);

  const scriptEl2 = dom.window.document.createElement('script');
  scriptEl2.textContent = js;
  dom.window.document.body.appendChild(scriptEl2);
} catch (e) {
  console.error("Evaluation Error:", e);
}

setTimeout(() => {
  console.log("JSDOM execution finished.");
  process.exit(0);
}, 2000);
