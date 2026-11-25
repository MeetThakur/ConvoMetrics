import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { preview } from 'vite';

async function exportedStats(page) {
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'All stats (JSON)' }).click();
  const download = await pendingDownload;
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}

test('analyzes a local export and a sample without sending chat data', { timeout: 60_000 }, async (t) => {
  const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;

  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const unauthorized = [];
  await context.route('**/*', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isAsset = url.pathname === '/' || /^\/(assets|analysis)\//.test(url.pathname);
    if (url.origin === origin && request.method() === 'GET' && isAsset && !url.search) {
      return route.continue();
    }
    unauthorized.push(request.url());
    return route.abort();
  });
  const page = await context.newPage();

  await page.goto(origin);
  await page.locator('input[type=file]').setInputFiles({
    name: 'chat.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from([
      '12/31/2023, 10:00 - Ivy: coffee 👍🏽',
      '01/20/2024, 11:00 - Jules: coffee?',
      '01/20/2024, 11:01 - Ivy: yes!',
    ].join('\n')),
  });
  await page.getByRole('heading', { name: 'Ivy & Jules', exact: true }).waitFor();
  const full = await exportedStats(page);
  assert.equal(full.platform, 'WhatsApp');
  assert.equal(full.overview.total_messages, 3);
  assert.equal(full.emojis.overall[0].emoji, '👍🏽');

  await context.setOffline(true);
  await page.getByRole('button', { name: '2024', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).waitFor();
  const filtered = await exportedStats(page);
  assert.equal(filtered.overview.total_messages, 2);
  assert.equal(filtered.range.start, '2024-01-01');

  await page.getByRole('textbox', { name: 'Word to search for' }).fill('coffee');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByText('“coffee” appears 1 time', { exact: false }).waitFor();

  await page.getByRole('button', { name: 'Sample chat', exact: true }).click();
  await page.getByRole('heading', { name: /^(Sam & Alex|Alex & Sam)$/, exact: true }).waitFor();
  assert.equal((await exportedStats(page)).overview.total_messages, 13_350);
  await page.getByRole('button', { name: 'New file', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a chat export file' }).waitFor();
  assert.deepEqual(unauthorized, []);
});
