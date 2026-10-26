import assert from 'node:assert/strict';

export function romeTime(timestamp) {
  const date = new Date(timestamp);
  assert(Number.isFinite(date.getTime()), 'Invalid timestamp');
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, minute: Number(values.hour) * 60 + Number(values.minute) };
}

export function forecastDates() {
  const dates = ['2026-10-28'];
  for (let month = 0; month < 9; month++) {
    const date = new Date(Date.UTC(2026, 10 + month, 1)).toISOString().slice(0, 7);
    for (const day of [7, 14, 21, 28]) dates.push(`${date}-${String(day).padStart(2, '0')}`);
  }
  return dates;
}

export function truthDates() {
  return Array.from({ length: 10 }, (_, i) => ({ month: new Date(Date.UTC(2026, 9 + i, 1)).toISOString().slice(0, 7), due: `${new Date(Date.UTC(2026, 10 + i, 1)).toISOString().slice(0, 7)}-07` }));
}

export function captureWindow(referenceDate, timestamp, frozenAt) {
  const local = romeTime(timestamp);
  return forecastDates().includes(referenceDate) && local.date === referenceDate && local.minute >= 23 * 60 + 45 && new Date(timestamp).getTime() > new Date(frozenAt).getTime();
}

export function validateOwnedSnapshot(data, enrollment) {
  assert.equal(data.ownerId, enrollment.accountId, 'Snapshot owner differs from enrolled account');
  assert(Number.isFinite(Date.parse(data.extractedAt)), 'Invalid database snapshot timestamp');
  for (const key of ['transactions', 'budgets', 'recurringExpenses', 'categories']) {
    assert(Array.isArray(data[key]), `Missing ${key}`);
    for (const row of data[key]) assert.equal(row.user_id, enrollment.accountId, 'Foreign row in account snapshot');
  }
}

export function scorePredictions(predictions, truths, modelIds) {
  const primaryMonths = truthDates().map(x => x.month).filter(month => month >= '2026-11');
  const expected = forecastDates().filter(date => date >= '2026-11-01');
  const usableMonths = primaryMonths.filter(month => Number.isFinite(truths[month]));
  const byDate = new Map(predictions.map(p => [p.referenceDate, p]));
  assert.equal(byDate.size, predictions.length, 'Duplicate prediction date');
  const metrics = {};
  for (const model of modelIds) {
    const rows = expected.filter(date => usableMonths.includes(date.slice(0, 7))).map(date => ({ date, total: byDate.get(date)?.forecasts[model]?.total, actual: truths[date.slice(0, 7)] }));
    const matched = rows.filter(r => Number.isFinite(r.total));
    const errors = matched.map(r => r.total - r.actual);
    const round = v => Math.round(v * 100) / 100;
    metrics[model] = { expectedOrigins: rows.length, matchedOrigins: matched.length, missingDates: rows.filter(r => !Number.isFinite(r.total)).map(r => r.date),
      mae: errors.length ? round(errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length) : null,
      rmse: errors.length ? round(Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length)) : null,
      bias: errors.length ? round(errors.reduce((s, e) => s + e, 0) / errors.length) : null };
  }
  return { completedPrimaryMonths: usableMonths, expectedFinalOrigins: 36, metrics,
    provisional: usableMonths.length < 9 || Object.values(metrics).some(m => m.matchedOrigins !== 36),
    bestModelConfirmed: false, note: 'Point errors alone do not confirm a winner; paired monthly uncertainty and multiple comparisons remain required.' };
}
