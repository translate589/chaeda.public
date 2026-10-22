/* 채다 공개 웹 유입 경로. 외부 수집기는 기본 비활성, 저장소·쿠키·네트워크 사용 없음. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.ChaedaAcquisition = api;
    if (root.CHAEDA_ACQUISITION_MANUAL_START !== true) api.install(root);
  }
})(typeof window === 'object' ? window : this, function () {
  'use strict';

  // 자유 입력을 수집하지 않는다. 새 캠페인은 검토 후 이 목록에 등록한다.
  var ALLOWED = {
    utm_source: ['instagram', 'naver_blog', 'naver_cafe', 'ppomppu', 'threads', 'youtube', 'google', 'naver', 'newsletter', 'kakao'],
    utm_medium: ['organic_social', 'organic_search', 'community', 'referral', 'email', 'cpc'],
    utm_campaign: ['coupon_vs_yield_202610', 'bond_basics_202610', 'chaeda_intro_202610'],
    utm_content: ['profile', 'story', 'pinned', 'post', 'reel', 'short', 'guide', 'blog', 'community', 'text_a', 'text_b']
  };
  var PAGE_IDS = ['home', 'coupon-vs-yield', 'bond-yield-structure'];
  var PLACEMENTS = ['hero', 'guide', 'experience', 'footer', 'header', 'unknown'];
  var EVENTS = ['web_page_view', 'web_guide_open', 'web_demo_interest', 'web_demo_start', 'web_store_click'];
  var PATHS = ['/', '/index.html', '/guides/coupon-vs-yield/', '/guides/coupon-vs-yield/index.html', '/guides/bond-yield-structure/', '/guides/bond-yield-structure/index.html'];
  var records = [];
  var adapter = null;
  var installed = false;

  function readCampaign(search) {
    var params = new URLSearchParams(search || '');
    var clean = {};
    Object.keys(ALLOWED).forEach(function (key) {
      var values = params.getAll(key);
      if (values.length === 1 && ALLOWED[key].indexOf(values[0]) !== -1) clean[key] = values[0];
    });
    // 출처·매체 한 쌍이 유효할 때만 캠페인으로 취급한다.
    if (!clean.utm_source || !clean.utm_medium) return {};
    return clean;
  }

  function campaignQuery(campaign) {
    var params = new URLSearchParams();
    Object.keys(ALLOWED).forEach(function (key) {
      if (campaign && ALLOWED[key].indexOf(campaign[key]) !== -1) params.set(key, campaign[key]);
    });
    return params.toString();
  }

  function withCampaign(href, base, campaign) {
    var url;
    var current;
    try { url = new URL(href, base); current = new URL(base); } catch (error) { return href; }
    // 스토어·이메일·데모 iframe 등에는 캠페인이나 현재 페이지의 쿼리를 보내지 않는다.
    if (url.origin !== current.origin || PATHS.indexOf(url.pathname) === -1) return href;
    var targetCampaign = readCampaign(url.search);
    var selected = Object.keys(campaign || {}).length ? campaign : targetCampaign;
    url.search = campaignQuery(selected);
    return url.pathname + url.search + url.hash;
  }

  function buildEvent(name, page, campaign, details) {
    if (EVENTS.indexOf(name) === -1 || PAGE_IDS.indexOf(page) === -1) return null;
    var props = { page: page };
    var approved = readCampaign(campaignQuery(campaign));
    Object.keys(approved).forEach(function (key) { props[key] = approved[key]; });
    if (name === 'web_store_click') {
      if (!details || ['apple', 'play'].indexOf(details.store) === -1) return null;
      props.store = details.store;
    }
    if (details && PLACEMENTS.indexOf(details.placement) !== -1) props.placement = details.placement;
    return { event: name, properties: props };
  }

  function install(win) {
    if (installed || !win || !win.document) return;
    var doc = win.document;
    function ready() {
      if (installed) return;
      var page = doc.body.getAttribute('data-page');
      if (PAGE_IDS.indexOf(page) === -1) return;
      installed = true;
      var campaign = readCampaign(win.location.search);
      var canonical = withCampaign(win.location.href, win.location.href, campaign);
      // 미등록 쿼리는 개인정보가 포함될 수 있어 알려진 공개 페이지의 URL에서도 제거한다.
      if (win.history && typeof win.history.replaceState === 'function') {
        try { win.history.replaceState(win.history.state, '', canonical); } catch (error) { /* 읽기 전용 환경에서도 본문 탐색을 유지한다. */ }
      }
      // 클릭 핸들러를 거치지 않는 가운데 클릭·우클릭 새 탭도 출처를 이어받는다.
      // 공용 app.js는 문서 끝의 일반 script이므로 이 시점에 메뉴·홈 링크가 생성되어 있다.
      if (typeof doc.querySelectorAll === 'function') {
        Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (anchor) {
          var href = anchor.getAttribute('href');
          if (href) anchor.setAttribute('href', withCampaign(href, win.location.href, campaign));
        });
      }

      function emit(name, details) {
        var record = buildEvent(name, page, campaign, details);
        if (!record) return;
        records.push(record);
        if (records.length > 50) records.shift();
        if (typeof win.CustomEvent === 'function' && typeof win.dispatchEvent === 'function') {
          win.dispatchEvent(new win.CustomEvent('chaeda:acquisition', { detail: { event: record.event, properties: Object.assign({}, record.properties) } }));
        }
        // 명시 설정된 adapter에만 허용된 항목을 전달한다. 기본 외부 전송·재전송은 없다.
        if (adapter) {
          try { adapter(record.event, Object.assign({}, record.properties)); } catch (error) { /* 클릭·이동을 막지 않는다. */ }
        }
      }

      emit('web_page_view');
      doc.addEventListener('click', function (event) {
        var target = event.target && event.target.closest ? event.target.closest('a,button') : null;
        if (!target) return;
        var placement = target.getAttribute('data-placement') || (target.closest('#hero') ? 'hero' : target.closest('[data-guide]') ? 'guide' : 'unknown');
        if (target.id === 'demoLaunch' && !target.disabled) emit('web_demo_start', { placement: 'experience' });
        if (target.tagName !== 'A') return;
        var raw = target.getAttribute('href');
        if (!raw) return;
        var dest;
        try { dest = new URL(raw, win.location.href); } catch (error) { return; }
        var store = dest.hostname === 'apps.apple.com' && /\/id6794857475\/?$/.test(dest.pathname) ? 'apple'
          : dest.hostname === 'play.google.com' && dest.pathname === '/store/apps/details' && dest.searchParams.get('id') === 'com.chaeda.app' ? 'play' : null;
        if (store) emit('web_store_click', { store: store, placement: placement });
        if (dest.origin === win.location.origin) {
          if (dest.pathname.indexOf('/guides/') === 0 && PATHS.indexOf(dest.pathname) !== -1 && dest.pathname !== win.location.pathname) emit('web_guide_open', { placement: placement });
          if (target.getAttribute('data-acquisition-action') === 'experience' || dest.hash === '#features') emit('web_demo_interest', { placement: placement });
          target.setAttribute('href', withCampaign(raw, win.location.href, campaign));
        }
      }, true);
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready, { once: true });
    else ready();
  }

  return {
    readCampaign: readCampaign,
    campaignQuery: campaignQuery,
    withCampaign: withCampaign,
    buildEvent: buildEvent,
    install: install,
    snapshot: function () { return records.map(function (item) { return { event: item.event, properties: Object.assign({}, item.properties) }; }); },
    setAdapter: function (callback) { adapter = typeof callback === 'function' ? callback : null; },
    status: function () { return { externalCollectorConfigured: adapter !== null, bufferedEvents: records.length, persistentStorageUsed: false }; }
  };
});
