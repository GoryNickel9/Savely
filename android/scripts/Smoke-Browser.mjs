// Run against Chrome in an isolated Android test profile after starting the signed APK.
// Forward the emulator's chrome_devtools_remote socket to localhost:9227 first.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const origin = 'https://www.savely.cc';
const targets = await (await fetch('http://127.0.0.1:9227/json/list')).json();
const requestedTarget = process.argv[2];
const target = targets.find((item) => item.type === 'page' && item.url.startsWith(`${origin}/`)
  && (!requestedTarget || item.id === requestedTarget));
if (!target) throw new Error('Open the signed APK in the isolated emulator before testing.');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let requestId = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const response = JSON.parse(data);
  const request = pending.get(response.id);
  if (request) {
    pending.delete(response.id);
    clearTimeout(request.timeout);
    if (response.error) request.reject(new Error(response.error.message));
    else request.resolve(response.result);
  }
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++requestId;
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 15000);
  pending.set(id, { resolve, reject, timeout });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error('Browser evaluation failed.');
  return result.result.value;
};
const results = [];
try {
  await call('Page.bringToFront');
  const hasAuthState = await evaluate(`Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token') && localStorage.getItem(k) && localStorage.getItem(k) !== 'null')`);
  if (hasAuthState) throw new Error('Use an anonymous test profile; this script does not navigate authenticated accounts.');
  const protectedRoutes = ['/', '/transactions', '/recurring', '/budget', '/categories', '/charts',
    '/charts/income-expense', '/charts/expense', '/charts/income', '/portfolio', '/net-worth', '/insights',
    '/settings', '/poker', '/poker/next-cut', '/poker/hourly-earnings', '/poker/rakeback', '/fumo',
    '/fumo/liquido-sigaretta', '/fumo/cbd', '/fumo/thc', '/fire', '/fire/standard', '/fire/barista',
    '/tcg', '/tcg/magic', '/tcg/pokemon', '/tcg/yugioh', '/libreria', '/libreria/libri', '/libreria/fumetti',
    '/libreria/manga', '/couple-budget', '/admin'];
  const cases = [
    ...protectedRoutes.map((route) => ({ route, expected: '/auth', text: 'Sign in|Accedi' })),
    { route: '/auth', expected: '/auth', text: 'Sign in|Accedi' },
    { route: '/privacy', expected: '/privacy', text: 'Privacy' },
    { route: '/cookies', expected: '/cookies', text: 'Cookie' },
    { route: '/terms', expected: '/terms', text: 'Terms|Termini' },
    { route: '/android-smoke-missing', expected: '/android-smoke-missing', text: '404|not found|non trovata' },
  ];
  for (const test of cases) {
    const navigation = await call('Page.navigate', { url: origin + test.route });
    if (navigation.errorText) throw new Error(`Navigation failed for ${test.route}: ${navigation.errorText}`);
    const deadline = Date.now() + 15000;
    let snapshot;
    let passed = false;
    while (Date.now() < deadline) {
      const frame = (await call('Page.getFrameTree')).frameTree.frame;
      if (navigation.loaderId && frame.loaderId !== navigation.loaderId) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      snapshot = await evaluate(`({ path: location.pathname, ready: document.readyState, text: document.body?.innerText ?? '' })`);
      passed = snapshot.path === test.expected && snapshot.ready === 'complete'
        && new RegExp(test.text, 'i').test(snapshot.text);
      if (passed) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    results.push({ route: test.route, expectedPath: test.expected, observedPath: snapshot?.path ?? null,
      loaderId: navigation.loaderId ?? null, passed,
      ...(passed ? {} : { ready: snapshot?.ready ?? null, publicText: snapshot?.text.slice(0, 240) ?? '' }) });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${test.route} -> ${snapshot?.path ?? 'no new document'}`);
  }
} finally {
  socket.close();
  const local = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../local');
  mkdirSync(local, { recursive: true });
  writeFileSync(path.join(local, 'browser-smoke.json'), JSON.stringify({
    date: new Date().toISOString(), origin, targetId: target.id,
    scope: 'Anonymous navigation only, no CRUD/authenticated parity claim', results,
  }, null, 2));
}
if (results.some((result) => !result.passed)) process.exitCode = 1;
