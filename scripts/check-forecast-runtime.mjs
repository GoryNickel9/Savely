// Load the compiled function with native Node ESM, without Vite resolving imports.
import assert from 'node:assert/strict';
import handler from '../.vercel/forecast-runtime-smoke/api/spending-forecast.js';
const headers = new Map(); let status;
const res = { setHeader: (key, value) => headers.set(key, value), status: code => { status = code; return res; }, json: value => value };
await handler({ method: 'GET', headers: {} }, res); assert.equal(status, 405);
await handler({ method: 'POST', headers: {}, body: { schemaVersion: 1, timeZone: 'Europe/Rome' } }, res); assert.equal(status, 401);
assert.match(headers.get('Cache-Control'), /private, no-store/);
console.log('Forecast native Node ESM runtime: method, authentication and cache headers passed.');
