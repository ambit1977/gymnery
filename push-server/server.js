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

// タイマー管理
let activeTimer = null;
let scheduledTime = null;

function sendPushToAll() {
  const payload = JSON.stringify({
    title: 'インターバル終了 ⏱',
    body: 'セットを再開しましょう'
  });

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
      const { fireAt } = json;
      if (!fireAt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing fireAt' }));
        return;
      }

      const delay = fireAt - Date.now();
      console.log(`Scheduling push in ${delay}ms (at ${new Date(fireAt).toLocaleString()})`);

      if (activeTimer) clearTimeout(activeTimer);

      if (delay > 0) {
        scheduledTime = fireAt;
        activeTimer = setTimeout(() => {
          console.log('Timer fired. Sending push notifications...');
          sendPushToAll();
          activeTimer = null;
          scheduledTime = null;
        }, delay);
      } else {
        // 即時送信
        sendPushToAll();
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // cancel
    if (req.method === 'POST' && req.url === '/cancel') {
      if (activeTimer) {
        clearTimeout(activeTimer);
        activeTimer = null;
        scheduledTime = null;
        console.log('Timer cancelled');
      }
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
