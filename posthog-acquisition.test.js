'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const acquisition = require('./acquisition.js');
const modulePath = require.resolve('./posthog-acquisition.js');
const fresh = () => { delete require.cache[modulePath]; return require(modulePath); };
const TOKEN = 'phc_testOnlyPublicProjectToken000000';
let nextId = 1;
function environment(configOverrides = {}, windowOverrides = {}) {
  const requests = [];
  const config = { enabled: true, apiHost: 'https://us.i.posthog.com', projectToken: TOKEN, productionHosts: ['chaeda.kr', 'www.chaeda.kr'], ...configOverrides };
  let handler;
  const win = {
    CHAEDA_WEB_ANALYTICS: config,
    location: new URL('https://chaeda.kr/?email=private%40example.com'),
    navigator: {},
    distinct_id: 'existing-app-user-id',
    crypto: { randomUUID: () => '00000000-0000-4000-8000-' + String(nextId++).padStart(12, '0') },
    ChaedaAcquisition: {
      buildEvent: acquisition.buildEvent,
      snapshot() { throw new Error('이전 이벤트를 재전송하면 안 됩니다.'); },
      setAdapter(callback) { handler = callback; }
    },
    fetch(url, options) { requests.push({ url, options, payload: JSON.parse(options.body) }); return Promise.resolve({ ok: true }); },
    ...windowOverrides
  };
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('지속 저장 금지'); } });
  Object.defineProperty(win, 'sessionStorage', { get() { throw new Error('지속 저장 금지'); } });
  const emit = (name = 'web_page_view', props = { page: 'home' }) => { if (handler) return handler(name, props); };
  return { win, config, requests, emit, hasAdapter: () => typeof handler === 'function' };
}

test('공개 활성화가 꺼져 있으면 설정만 확인하고 외부 전송기를 연결하지 않는다', () => {
  const api = fresh();
  const env = environment({ enabled: false });
  api.install(env.win);
  assert.equal(api.status().configured, true);
  assert.equal(api.status().enabled, false);
  assert.equal(api.status().reason, 'disabled_in_config');
  assert.equal(env.hasAdapter(), false);
  assert.equal(env.requests.length, 0);
});

test('HTTPS 운영 호스트만 허용하고 localhost·미리보기·유사 도메인은 차단한다', () => {
  for (const origin of ['http://chaeda.kr', 'http://localhost:18765', 'https://preview.chaeda.kr', 'https://chaeda.kr.example.com']) {
    const api = fresh();
    const env = environment({ productionHosts: ['chaeda.kr', 'localhost', 'preview.chaeda.kr', 'chaeda.kr.example.com'] }, { location: new URL(origin) });
    api.install(env.win);
    assert.equal(api.status().reason, 'non_production_host');
    assert.equal(env.hasAdapter(), false);
  }
  const api = fresh();
  const env = environment({}, { location: new URL('https://www.chaeda.kr') });
  assert.equal(api.install(env.win).enabled, true);
});

test('잘못된 토큰과 다른 수집 서버·사용자정보·쿼리·경로가 붙은 수집 주소는 거부한다', () => {
  for (const overrides of [
    { projectToken: 'personal-secret-key' },
    { apiHost: 'https://unreviewed.example.com' },
    { apiHost: 'https://user:pass@us.i.posthog.com' },
    { apiHost: 'https://us.i.posthog.com/?key=secret' },
    { apiHost: 'https://us.i.posthog.com/capture' }
  ]) {
    const api = fresh();
    const env = environment(overrides);
    assert.equal(api.install(env.win).reason, 'invalid_or_missing_config');
    assert.equal(env.hasAdapter(), false);
  }
});

test('DNT·GPC가 켜져 있으면 임시 식별자도 만들지 않고 전송을 막는다', () => {
  for (const signals of [{ navigator: { doNotTrack: '1' } }, { navigator: { doNotTrack: 'yes' } }, { navigator: { globalPrivacyControl: true } }, { doNotTrack: '1' }]) {
    const api = fresh();
    const env = environment({}, { ...signals, crypto: { randomUUID() { throw new Error('프라이버시 거부 시 ID 생성 금지'); } } });
    assert.equal(api.install(env.win).reason, 'privacy_signal');
    assert.equal(env.hasAdapter(), false);
    assert.equal(env.requests.length, 0);
  }
});

test('허용 이벤트와 속성만 공식 capture 형태로 보내고 개인 식별·URL·입력값을 제외한다', async () => {
  const api = fresh();
  const env = environment();
  api.install(env.win);
  env.emit('web_store_click', {
    page: 'home', store: 'play', placement: 'hero',
    utm_source: 'instagram', utm_medium: 'organic_social', utm_campaign: 'coupon_vs_yield_202610', utm_content: 'profile',
    email: 'private@example.com', distinct_id: 'app-user', user_id: 'app-user', $current_url: 'https://chaeda.kr/?token=secret', referrer: 'private', amount: 1000000,
    $process_person_profile: true, $geoip_disable: false, $ip: '192.0.2.10'
  });
  await Promise.resolve();
  assert.equal(env.requests.length, 1);
  const { url, options, payload } = env.requests[0];
  assert.equal(url, 'https://us.i.posthog.com/i/v0/e/');
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.keepalive, true);
  assert.equal(options.redirect, 'error');
  assert.match(payload.distinct_id, /^web_page_[0-9a-f-]{36}$/);
  assert.equal(payload.api_key, TOKEN);
  assert.deepEqual(payload.properties, {
    page: 'home', utm_source: 'instagram', utm_medium: 'organic_social', utm_campaign: 'coupon_vs_yield_202610', utm_content: 'profile', store: 'play', placement: 'hero',
    $process_person_profile: false, $geoip_disable: true, $ip: '0.0.0.0', platform: 'public_web', environment: 'production'
  });
  assert.equal(api.status().transportAccepted, 1);
  assert.equal(JSON.stringify(payload).includes('private'), false);
});

test('한 페이지 안에서만 임시 ID를 공유하고 새 페이지에는 새 ID를 생성한다', () => {
  const first = fresh();
  const env1 = environment();
  first.install(env1.win);
  env1.emit(); env1.emit('web_demo_start', { page: 'home' });
  const second = fresh();
  const env2 = environment();
  second.install(env2.win); env2.emit();
  assert.equal(env1.requests[0].payload.distinct_id, env1.requests[1].payload.distinct_id);
  assert.notEqual(env1.requests[0].payload.distinct_id, env2.requests[0].payload.distinct_id);
  assert.equal(first.status().identityScope, 'page_memory');
});

test('설정 이후 새 이벤트만 전송하고 identify·미등록 이벤트·잘못된 페이지는 보내지 않는다', () => {
  const api = fresh();
  const env = environment();
  api.install(env.win);
  assert.equal(env.requests.length, 0);
  env.emit('$identify', { page: 'home', $set: { email: 'private@example.com' } });
  env.emit('web_page_view', { page: 'account/private-id' });
  assert.equal(env.requests.length, 0);
  assert.equal(api.status().dropped, 2);
});

test('클릭이 반복되어도 한 페이지 전송 시도는 50건으로 제한한다', () => {
  const api = fresh();
  const env = environment();
  api.install(env.win);
  for (let i = 0; i < 70; i++) env.emit();
  assert.equal(env.requests.length, 50);
  assert.equal(api.status().attempted, 50);
  assert.equal(api.status().dropped, 20);
  assert.equal(api.status().reason, 'page_budget_exhausted');
});

test('페이지 사용 도중 프라이버시 신호가 켜지면 이후 전송을 멈춘다', () => {
  const api = fresh();
  const env = environment();
  api.install(env.win);
  env.emit();
  env.win.navigator.globalPrivacyControl = true;
  env.emit();
  assert.equal(env.requests.length, 1);
  assert.equal(api.status().enabled, false);
  assert.equal(api.status().reason, 'privacy_signal');
});

test('네트워크·CORS·HTTP 오류를 흡수하고 자동 재시도·재전송하지 않는다', async () => {
  for (const fetch of [() => Promise.reject(new Error('CORS')), () => Promise.resolve({ ok: false }), () => { throw new Error('offline'); }]) {
    const api = fresh();
    let calls = 0;
    const env = environment({}, { fetch: (...args) => { calls++; return fetch(...args); } });
    api.install(env.win);
    assert.doesNotThrow(() => env.emit());
    await Promise.resolve();
    assert.equal(calls, 1);
    assert.equal(api.status().transportFailed, 1);
    assert.equal(api.status().transportAccepted, 0);
  }
});

test('실제 스크립트 순서에서 첫 페이지 이벤트 전에 adapter가 준비된다', async () => {
  const listeners = {};
  const env = environment();
  env.win.document = { readyState: 'loading', body: { getAttribute: () => 'home' }, addEventListener: (type, fn) => { listeners[type] = fn; } };
  env.win.history = { replaceState() {} };
  const context = { window: env.win, URL, URLSearchParams, Uint8Array, Object, Array, Promise };
  vm.runInNewContext(fs.readFileSync(require.resolve('./acquisition.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(require.resolve('./posthog-acquisition.js'), 'utf8'), context);
  assert.equal(env.requests.length, 0);
  listeners.DOMContentLoaded();
  await Promise.resolve();
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].payload.event, 'web_page_view');
});

test('홈·가이드의 실제 script 속성과 파서 시점에서도 첫 페이지 이벤트가 전송된다', async () => {
  const pages = [
    { file: 'index.html', page: 'home', path: '/' },
    { file: 'guides/coupon-vs-yield/index.html', page: 'coupon-vs-yield', path: '/guides/coupon-vs-yield/' }
  ];
  for (const page of pages) {
    const html = fs.readFileSync(require('node:path').join(__dirname, page.file), 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*?)src="([^"]+)"([^>]*)>/g)]
      .map(match => ({ attrs: match[1] + match[3], name: match[2].split('?')[0].split('/').pop() }))
      .filter(script => ['acquisition.js', 'acquisition-config.js', 'posthog-acquisition.js'].includes(script.name));
    assert.deepEqual(scripts.map(script => script.name), ['acquisition.js', 'acquisition-config.js', 'posthog-acquisition.js'], page.file);
    assert.equal(scripts.some(script => /\basync\b/.test(script.attrs)), false, '비동기 순서 경쟁 금지: ' + page.file);
    const env = environment({}, { location: new URL('https://chaeda.kr' + page.path) });
    const listeners = { DOMContentLoaded: [] };
    env.win.document = {
      readyState: 'loading',
      body: { getAttribute: () => page.page },
      addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }
    };
    env.win.history = { replaceState() {} };
    const context = { window: env.win, URL, URLSearchParams, Uint8Array, Object, Array, Promise };
    const deferred = [];
    function execute(script) {
      vm.runInNewContext(fs.readFileSync(require.resolve('./' + script.name), 'utf8'), context);
      // 공개 설정은 비활성 그대로 두고 테스트 안에서만 전송 가능 상태를 모델링한다.
      if (script.name === 'acquisition-config.js') env.win.CHAEDA_WEB_ANALYTICS = { ...env.win.CHAEDA_WEB_ANALYTICS, enabled: true, projectToken: TOKEN };
    }
    for (const script of scripts) {
      if (/\bdefer\b/.test(script.attrs)) deferred.push(script);
      else execute(script);
    }
    env.win.document.readyState = 'interactive';
    deferred.forEach(execute);
    listeners.DOMContentLoaded.forEach(fn => fn());
    await Promise.resolve();
    assert.equal(env.requests.length, 1, '첫 페이지 이벤트 유실: ' + page.file);
    assert.equal(env.requests[0].payload.event, 'web_page_view');
    assert.equal(env.requests[0].payload.properties.page, page.page);
  }
});
