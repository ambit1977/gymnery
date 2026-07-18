const http = require('http');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const PORT = process.env.PORT || 3300;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:ambit.akiyama@gmail.com';

const STATE_DIR = process.env.STATE_DIRECTORY || '/var/lib/gymnery-push';
const SUBS_FILE = path.join(STATE_DIR, 'subscriptions.json');

// VAPIDキーの設定
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.error('VAPID keys are missing! Web Push will not work.');
}

// 購読情報の永続化管理
let subscriptions = [];
function loadSubscriptions() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      subscriptions = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load subscriptions:', e);
  }
}
function saveSubscriptions() {
  try {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions), 'utf8');
  } catch (e) {
    console.error('Failed to save subscriptions:', e);
  }
}

loadSubscriptions();

// タイマー管理 (キー: subscription.endpoint + '_' + type, 値: { timer, fireAt })
const activeTimers = new Map();

function sendPushToAll(type = 'interval') {
  let title = 'インターバル終了 ⏱';
  let body = 'セットを再開しましょう';

  if (type === 'session_5min') {
    title = '残り時間わずか ⚠️';
    body = 'セッション終了5分前です';
  } else if (type === 'session_end') {
    title = '制限時間終了 🚨';
    body = '1時間が経過しました。セッションを終了してください';
  }

  const payload = JSON.stringify({ title, body });

  const promises = subscriptions.map(sub => {
    return webpush.sendNotification(sub, payload).catch(err => {
      // 404 or 410 (expired/unsubscribed)
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log('Subscription expired:', sub.endpoint);
        return sub.endpoint;
      }
      console.error('Error sending push:', err);
      return null;
    });
  });

  Promise.all(promises).then(results => {
    const expiredEndpoints = results.filter(endpoint => endpoint !== null);
    if (expiredEndpoints.length > 0) {
      subscriptions = subscriptions.filter(sub => !expiredEndpoints.includes(sub.endpoint));
      saveSubscriptions();

      // 切れたサブスクリプションに関連するタイマーをクリーンアップ
      for (const endpoint of expiredEndpoints) {
        for (const key of activeTimers.keys()) {
          if (key.startsWith(endpoint)) {
            const item = activeTimers.get(key);
            if (item && item.timer) clearTimeout(item.timer);
            activeTimers.delete(key);
          }
        }
      }
    }
  });
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://ambit1977.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check (No auth)
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Auth verification
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let json = {};
    try {
      if (body) json = JSON.parse(body);
    } catch (e) {}

    // subscribe
    if (req.method === 'POST' && req.url === '/subscribe') {
      const { subscription } = json;
      if (!subscription || !subscription.endpoint) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid subscription' }));
        return;
      }

      // 重複排除
      if (!subscriptions.some(s => s.endpoint === subscription.endpoint)) {
        subscriptions.push(subscription);
        saveSubscriptions();
        console.log('New subscription added:', subscription.endpoint);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // schedule
    if (req.method === 'POST' && req.url === '/schedule') {
      const { fireAt, type } = json;
      const t = type || 'interval';
      if (!fireAt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing fireAt' }));
        return;
      }

      const delay = fireAt - Date.now();
      console.log(`Scheduling push type=${t} in ${delay}ms (at ${new Date(fireAt).toLocaleString()})`);

      // 登録されている全購読に対してタイマーをセット
      subscriptions.forEach(sub => {
        const key = `${sub.endpoint}_${t}`;
        
        // 既存の同種別タイマーがあればキャンセル
        const existing = activeTimers.get(key);
        if (existing && existing.timer) {
          clearTimeout(existing.timer);
        }

        if (delay > 0) {
          const timer = setTimeout(() => {
            console.log(`Timer fired for type=${t}. Sending push notification...`);
            const payload = JSON.stringify({
              title: t === 'session_5min' ? '残り時間わずか ⚠️' : (t === 'session_end' ? '制限時間終了 🚨' : 'インターバル終了 ⏱'),
              body: t === 'session_5min' ? 'セッション終了5分前です' : (t === 'session_end' ? '1時間が経過しました。セッションを終了してください' : 'セットを再開しましょう')
            });
            webpush.sendNotification(sub, payload).catch(err => {
              if (err.statusCode === 404 || err.statusCode === 410) {
                console.log('Subscription expired during fire:', sub.endpoint);
                subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
                saveSubscriptions();
              }
            });
            activeTimers.delete(key);
          }, delay);

          activeTimers.set(key, { timer, fireAt });
        } else {
          // 即時送信
          const payload = JSON.stringify({
            title: t === 'session_5min' ? '残り時間わずか ⚠️' : (t === 'session_end' ? '制限時間終了 🚨' : 'インターバル終了 ⏱'),
            body: t === 'session_5min' ? 'セッション終了5分前です' : (t === 'session_end' ? '1時間が経過しました。セッションを終了してください' : 'セットを再開しましょう')
          });
          webpush.sendNotification(sub, payload).catch(err => {
            if (err.statusCode === 404 || err.statusCode === 410) {
              subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
              saveSubscriptions();
            }
          });
        }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // cancel
    if (req.method === 'POST' && req.url === '/cancel') {
      const { type } = json;
      const t = type || 'interval';

      subscriptions.forEach(sub => {
        const key = `${sub.endpoint}_${t}`;
        const existing = activeTimers.get(key);
        if (existing) {
          if (existing.timer) clearTimeout(existing.timer);
          activeTimers.delete(key);
          console.log(`Timer cancelled for key=${key}`);
        }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on 127.0.0.1:${PORT}`);
});
