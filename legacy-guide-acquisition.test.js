'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function environment(path = '/guides/bond-yield-structure/', scriptSource = 'https://chaeda.kr/app.js?v=original') {
  const pending = [];
  const requests = [];
  const attrs = { 'data-page': 'bond-yield-structure' };
  const links = [{ attrs: { href: '../../index.html' }, getAttribute(key) { return this.attrs[key]; }, setAttribute(key, value) { this.attrs[key] = value; } }];
  const handlers = {};
  const doc = {
    readyState: 'interactive',
    currentScript: { src: scriptSource },
    head: { appendChild(script) { pending.push(script); } },
    body: { dataset: { page: attrs['data-page'] }, getAttribute: key => attrs[key], setAttribute(key, value) { attrs[key] = value; this.dataset.page = value; } },
    createElement: () => ({}),
    querySelectorAll: () => links,
    getElementById: () => null,
    addEventListener(type, callback) { (handlers[type] ||= []).push(callback); }
  };
  const win = {
    location: new URL('https://chaeda.kr' + path + '?utm_source=instagram&utm_medium=organic_social&utm_campaign=coupon_vs_yield_202610&utm_content=profile'),
    document: doc,
    navigator: {},
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
    history: { replaceState() {} },
    fetch(url, options) { requests.push({ url, payload: JSON.parse(options.body) }); return Promise.resolve({ ok: true }); }
  };
  const context = { window: win, document: doc, URL, URLSearchParams, Uint8Array, Object, Array, Promise };
  const execute = name => vm.runInNewContext(fs.readFileSync(require.resolve('./' + name), 'utf8'), context);
  execute('content.js');
  execute('app.js');
  function loaded(name) {
    const script = pending.shift();
    assert.equal(new URL(script.src).pathname, '/' + name);
    assert.equal(new URL(script.src).origin, win.location.origin);
    execute(name);
    if (name === 'acquisition-config.js') win.CHAEDA_WEB_ANALYTICS = { ...win.CHAEDA_WEB_ANALYTICS, enabled: true, projectToken: 'phc_testOnlyPublicProjectToken000000' };
    script.onload();
  }
  return { win, doc, pending, requests, links, execute, loaded };
}

test('기존 가이드는 interactive 시점에도 adapter를 먼저 준비해 첫 이벤트와 새 탭 출처를 보존한다', async () => {
  const env = environment();
  assert.equal(env.win.CHAEDA_ACQUISITION_MANUAL_START, true);
  env.loaded('acquisition.js');
  assert.equal(env.win.ChaedaAcquisition.snapshot().length, 0);
  assert.equal(env.requests.length, 0);
  env.loaded('acquisition-config.js');
  assert.equal(env.requests.length, 0);
  env.loaded('posthog-acquisition.js');
  await Promise.resolve();
  assert.equal(env.win.__chaedaGuideAcquisitionBootstrap, 'ready');
  assert.equal(env.win.CHAEDA_ACQUISITION_MANUAL_START, false);
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].payload.event, 'web_page_view');
  assert.equal(env.requests[0].payload.properties.page, 'bond-yield-structure');
  assert.equal(env.requests[0].payload.properties.utm_source, 'instagram');
  assert.equal(env.links[0].getAttribute('href').includes('utm_source=instagram'), true);
  env.execute('app.js');
  assert.equal(env.pending.length, 0);
  assert.equal(env.requests.length, 1);
});

test('기존 가이드의 정확한 경로·동일 출처 app.js만 적용하고 로드 실패 시 읽기를 막지 않는다', () => {
  assert.equal(environment('/').pending.length, 0);
  assert.equal(environment('/guides/coupon-vs-yield/').pending.length, 0);
  assert.equal(environment('/guides/bond-yield-structure/', 'https://other.example.com/app.js').pending.length, 0);
  const env = environment('/guides/bond-yield-structure/index.html');
  env.loaded('acquisition.js');
  assert.doesNotThrow(() => env.pending.shift().onerror());
  assert.equal(env.win.__chaedaGuideAcquisitionBootstrap, 'failed');
  assert.equal(env.win.ChaedaAcquisition.snapshot().length, 1);
  assert.equal(env.requests.length, 0);
  assert.equal(env.links[0].getAttribute('href').includes('utm_source=instagram'), true);
  assert.equal(env.doc.body.dataset.page, 'bond-yield-structure');
});
