import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, retryDelay, withRateLimitRetry } from '../src/lib/request.ts';
import { analyzeFile, fetchSample } from '../src/lib/api.ts';

function immediateTimers(t) {
  const delays = [];
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    delays.push(delay);
    queueMicrotask(callback);
    return 0;
  });
  return delays;
}

test('Retry-After accepts seconds and HTTP dates with a safe fallback', () => {
  assert.equal(retryDelay('20'), 20000);
  assert.equal(retryDelay('Thu, 19 Nov 2026 00:00:30 GMT', Date.parse('2026-11-19T00:00:00Z')), 30000);
  for (const value of [null, '', 'invalid', '-5']) assert.equal(retryDelay(value), 10000);
  assert.equal(retryDelay('0'), 1000);
});

test('rate limiting retries once, then returns an actionable error', async (t) => {
  const delays = immediateTimers(t);
  let requests = 0;
  let notices = 0;
  await assert.rejects(withRateLimitRetry(async () => {
    requests++;
    throw new HttpError(429, null, '15');
  }, () => notices++), /wait 15 seconds/);
  assert.equal(requests, 2);
  assert.equal(notices, 1);
  assert.deepEqual(delays, [15000]);
});

test('long cooldowns, other HTTP errors and network errors do not retry', async (t) => {
  const delays = immediateTimers(t);
  for (const error of [new HttpError(429, null, '120'), new HttpError(422, 'Invalid export', null), new Error('Network error')]) {
    let requests = 0;
    await assert.rejects(withRateLimitRetry(async () => { requests++; throw error; }, () => assert.fail('unexpected retry')), e => e === error);
    assert.equal(requests, 1);
  }
  assert.deepEqual(delays, []);
});

test('sample handles a non-JSON 429 and recovers', async (t) => {
  const delays = immediateTimers(t);
  const payload = { overview: { total_messages: 3 } };
  const responses = [new Response('Too many requests', { status: 429, headers: { 'Retry-After': '2' } }), Response.json(payload)];
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => { calls.push(url); return responses.shift(); });
  const progress = [];
  assert.deepEqual(await fetchSample({start: '2024-01-01', end: null}, p => progress.push(p)), payload);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
  assert.match(calls[0], /start=2024-01-01/);
  assert.deepEqual(delays, [2000]);
  assert.equal(progress[0].phase, 'retrying');
});

test('upload retry preserves the file and date range', async (t) => {
  const delays = immediateTimers(t);
  const sent = [];
  const progress = [];
  const payload = { overview: { total_messages: 3 } };
  class FakeXHR {
    upload = {};
    open(method, url) { assert.equal(method, 'POST'); assert.equal(url, '/api/analyze'); }
    getResponseHeader(name) { assert.equal(name, 'Retry-After'); return '3'; }
    send(form) {
      sent.push(form);
      this.status = sent.length === 1 ? 429 : 200;
      this.responseText = this.status === 429 ? '<html>Too many requests</html>' : JSON.stringify(payload);
      queueMicrotask(() => this.onload());
    }
  }
  const previous = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = FakeXHR;
  t.after(() => { if (previous === undefined) delete globalThis.XMLHttpRequest; else globalThis.XMLHttpRequest = previous; });
  const file = new File(['fictional chat'], 'sample.txt');
  assert.deepEqual(await analyzeFile(file, {start:'2024-01-01',end:'2024-12-31'}, p => progress.push(p)), payload);
  assert.equal(sent.length, 2);
  for (const form of sent) {
    assert.equal(await form.get('file').text(), 'fictional chat');
    assert.equal(form.get('file').name, 'sample.txt');
    assert.equal(form.get('start'), '2024-01-01');
    assert.equal(form.get('end'), '2024-12-31');
  }
  assert.deepEqual(delays, [3000]);
  assert.equal(progress[0].phase, 'retrying');
});
