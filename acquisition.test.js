'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const modulePath = require.resolve('./acquisition.js');
const fresh = () => { delete require.cache[modulePath]; return require(modulePath); };
const valid = '?utm_source=instagram&utm_medium=organic_social&utm_campaign=coupon_vs_yield_202610&utm_content=profile';

function environment(page = 'home', url = 'https://chaeda.kr/' + valid) {
  const handlers = {};
  const dispatched = [];
  const replacements = [];
  const anchors = [];
  const win = {
    location: new URL(url),
    document: {
      readyState: 'complete',
      body: { getAttribute: () => page },
      querySelectorAll: () => anchors,
      addEventListener: (name, handler) => { handlers[name] = handler; }
    },
    history: { state: null, replaceState: (state, title, href) => replacements.push(href) },
    CustomEvent: function (name, init) { this.type = name; this.detail = init.detail; },
    dispatchEvent: event => dispatched.push(event),
    fetch: () => { throw new Error('기본 수집기는 네트워크를 사용하면 안 됩니다.'); }
  };
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('지속 저장 금지'); } });
  Object.defineProperty(win.document, 'cookie', { get() { throw new Error('쿠키 접근 금지'); }, set() { throw new Error('쿠키 저장 금지'); } });
  function element(attrs = {}, options = {}) {
    const result = {
      tagName: options.tagName || 'A',
      id: options.id || '',
      disabled: options.disabled || false,
      getAttribute: key => attrs[key] || null,
      setAttribute: (key, value) => { attrs[key] = value; },
      closest: selector => selector === 'a,button' ? result : selector === '#hero' && options.hero ? {} : selector === '[data-guide]' && page !== 'home' ? {} : null
    };
    if (result.tagName === 'A') anchors.push(result);
    return result;
  }
  return { win, dispatched, replacements, element, click: target => handlers.click({ target }) };
}

test('승인된 캠페인값만 읽고 개인정보·미등록값·중복값은 제외한다', () => {
  const api = fresh();
  const result = api.readCampaign(valid + '&email=private%40example.com&utm_term=01012345678&token=secret');
  assert.deepEqual(result, { utm_source: 'instagram', utm_medium: 'organic_social', utm_campaign: 'coupon_vs_yield_202610', utm_content: 'profile' });
  assert.deepEqual(api.readCampaign('?utm_source=private%40example.com&utm_medium=organic_social'), {});
  assert.deepEqual(api.readCampaign(valid + '&utm_source=instagram'), {});
  assert.deepEqual(api.readCampaign('?utm_source=instagram&utm_medium=organic_social&utm_campaign=private-name&utm_content=01012345678'), { utm_source: 'instagram', utm_medium: 'organic_social' });
});

test('내부 가이드 이동과 체험 앵커에는 캠페인만 보존하고 대상 쿼리는 정리한다', () => {
  const api = fresh();
  const campaign = api.readCampaign(valid);
  const result = new URL(api.withCampaign('/guides/coupon-vs-yield/?email=private%40example.com#example', 'https://chaeda.kr/?token=secret', campaign), 'https://chaeda.kr');
  assert.equal(result.hash, '#example');
  assert.equal(result.searchParams.get('utm_source'), 'instagram');
  assert.equal(result.searchParams.has('email'), false);
  assert.equal(result.searchParams.has('token'), false);
  assert.equal(api.withCampaign('/#features', result.href, campaign), '/?' + api.campaignQuery(campaign) + '#features');
});

test('외부 스토어와 메일·체험 iframe에는 캠페인을 덧붙이지 않는다', () => {
  const api = fresh();
  const campaign = api.readCampaign(valid);
  [
    'https://apps.apple.com/kr/app/id6794857475',
    'https://play.google.com/store/apps/details?id=com.chaeda.app&hl=ko',
    'mailto:chaeda.official@gmail.com',
    'app-demo/index.html?v=demo-20261002-18#bonds'
  ].forEach(href => assert.equal(api.withCampaign(href, 'https://chaeda.kr/', campaign), href));
});

test('준비 시 내부 href를 장식해 가운데 클릭·우클릭 새 탭에서도 출처를 보존한다', () => {
  const api = fresh();
  const env = environment();
  const internal = env.element({ href: '/guides/coupon-vs-yield/?email=private%40example.com#example', target: '_blank' });
  const external = env.element({ href: 'https://apps.apple.com/kr/app/id6794857475' });
  api.install(env.win);
  assert.equal(internal.getAttribute('href').includes('utm_source=instagram'), true);
  assert.equal(internal.getAttribute('href').includes('email='), false);
  assert.equal(external.getAttribute('href'), 'https://apps.apple.com/kr/app/id6794857475');
  // 원래 페이지에서 click 이벤트가 발생하지 않은 새 탭 경로를 재현한다.
  assert.deepEqual(api.snapshot().map(row => row.event), ['web_page_view']);
  const newTab = environment('coupon-vs-yield', new URL(internal.getAttribute('href'), env.win.location).href);
  const newApi = fresh();
  newApi.install(newTab.win);
  assert.equal(newApi.snapshot()[0].properties.utm_source, 'instagram');
  assert.equal(newApi.snapshot()[0].properties.utm_campaign, 'coupon_vs_yield_202610');
});

test('임의 이벤트·페이지·스토어는 거부하고 임의 속성은 이벤트에 들어가지 않는다', () => {
  const api = fresh();
  assert.equal(api.buildEvent('user_email', 'home', {}, {}), null);
  assert.equal(api.buildEvent('web_page_view', 'user/123', {}, {}), null);
  assert.equal(api.buildEvent('web_store_click', 'home', {}, { store: 'unknown' }), null);
  assert.deepEqual(api.buildEvent('web_store_click', 'home', {}, { store: 'apple', placement: 'guide', email: 'private@example.com', url: 'https://chaeda.kr/?token=secret' }), { event: 'web_store_click', properties: { page: 'home', store: 'apple', placement: 'guide' } });
});

test('기본 동작은 외부 수집기 없이 URL을 정리하고 페이지 이벤트만 메모리에 남긴다', () => {
  const api = fresh();
  const env = environment('home', 'https://chaeda.kr/' + valid + '&email=private%40example.com');
  api.install(env.win);
  api.install(env.win);
  assert.equal(env.replacements.length, 1);
  assert.equal(env.replacements[0].includes('email'), false);
  assert.deepEqual(api.status(), { externalCollectorConfigured: false, bufferedEvents: 1, persistentStorageUsed: false });
  assert.equal(api.snapshot()[0].event, 'web_page_view');
  assert.equal(env.dispatched[0].type, 'chaeda:acquisition');
});

test('가이드 열기·체험 관심·실제 시작·스토어 클릭을 각각 구분한다', () => {
  const api = fresh();
  const env = environment();
  api.install(env.win);
  env.click(env.element({ href: '/guides/coupon-vs-yield/', 'data-placement': 'guide' }));
  env.click(env.element({ href: '#features' }, { hero: true }));
  env.click(env.element({}, { tagName: 'BUTTON', id: 'demoLaunch' }));
  env.click(env.element({ href: 'https://play.google.com/store/apps/details?id=com.chaeda.app&hl=ko' }, { hero: true }));
  assert.deepEqual(api.snapshot().map(row => row.event), ['web_page_view', 'web_guide_open', 'web_demo_interest', 'web_demo_start', 'web_store_click']);
  assert.equal(api.snapshot().at(-1).properties.store, 'play');
});

test('Apple·Google 스토어 반복 클릭은 동작마다 한 건씩 기록하고 외부 이동 주소를 바꾸지 않는다', () => {
  const api = fresh();
  const env = environment();
  api.install(env.win);
  const apple = env.element({ href: 'https://apps.apple.com/kr/app/id6794857475', 'data-placement': 'hero' });
  const play = env.element({ href: 'https://play.google.com/store/apps/details?id=com.chaeda.app&hl=ko', 'data-placement': 'guide' });
  env.click(apple);
  env.click(play);
  env.click(play);
  assert.deepEqual(api.snapshot().slice(1), [
    { event: 'web_store_click', properties: { page: 'home', utm_source: 'instagram', utm_medium: 'organic_social', utm_campaign: 'coupon_vs_yield_202610', utm_content: 'profile', store: 'apple', placement: 'hero' } },
    { event: 'web_store_click', properties: { page: 'home', utm_source: 'instagram', utm_medium: 'organic_social', utm_campaign: 'coupon_vs_yield_202610', utm_content: 'profile', store: 'play', placement: 'guide' } },
    { event: 'web_store_click', properties: { page: 'home', utm_source: 'instagram', utm_medium: 'organic_social', utm_campaign: 'coupon_vs_yield_202610', utm_content: 'profile', store: 'play', placement: 'guide' } }
  ]);
  assert.equal(apple.getAttribute('href'), 'https://apps.apple.com/kr/app/id6794857475');
  assert.equal(play.getAttribute('href'), 'https://play.google.com/store/apps/details?id=com.chaeda.app&hl=ko');
});

test('가이드 목차 앵커·다른 앱 링크·처음부터 버튼은 신규 유입·실제 시작으로 세지 않는다', () => {
  const api = fresh();
  const env = environment('coupon-vs-yield', 'https://chaeda.kr/guides/coupon-vs-yield/' + valid);
  api.install(env.win);
  env.click(env.element({ href: '#example' }));
  env.click(env.element({ href: 'https://play.google.com/store/apps/details?id=another.app' }));
  env.click(env.element({}, { tagName: 'BUTTON', id: 'demoRestart' }));
  env.click(env.element({}, { tagName: 'BUTTON', id: 'demoLaunch', disabled: true }));
  assert.equal(api.snapshot().length, 1);
});

test('adapter는 명시 연결 이후 새 이벤트만 받으며 오류가 링크 이동을 막지 않는다', () => {
  const api = fresh();
  const env = environment();
  api.install(env.win);
  const sent = [];
  api.setAdapter((name, props) => { sent.push(name); props.page = 'mutated'; throw new Error('collector unavailable'); });
  const anchor = env.element({ href: '/guides/coupon-vs-yield/' });
  assert.doesNotThrow(() => env.click(anchor));
  assert.deepEqual(sent, ['web_guide_open']);
  assert.equal(api.snapshot().at(-1).properties.page, 'home');
  assert.equal(anchor.getAttribute('href').includes('utm_source=instagram'), true);
  api.setAdapter(null);
  assert.equal(api.status().externalCollectorConfigured, false);
});

test('메모리 보관은 50건으로 제한하고 snapshot 변조가 내부 기록을 바꾸지 않는다', () => {
  const api = fresh();
  const env = environment();
  api.install(env.win);
  for (let i = 0; i < 80; i++) env.click(env.element({ href: '#features' }));
  assert.equal(api.snapshot().length, 50);
  api.snapshot()[0].properties.page = 'mutated';
  assert.equal(api.snapshot()[0].properties.page, 'home');
});
