/* 공개 웹의 허용 이벤트만 전달한다. SDK·쿠키·자동 수집·사용자 식별 연결은 사용하지 않는다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.ChaedaPostHogAcquisition = api;
    api.install(root);
  }
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  var PRODUCTION_HOSTS = ['chaeda.kr', 'www.chaeda.kr'];
  var INGESTION_ORIGIN = 'https://us.i.posthog.com';
  var SEND_LIMIT = 50;
  var attached = false;
  var state = { configured: false, enabled: false, reason: 'not_initialized', attempted: 0, transportAccepted: 0, transportFailed: 0, dropped: 0, lastTransport: 'none' };

  function configValues(config) {
    if (!config || typeof config !== 'object' || typeof config.projectToken !== 'string' || !/^phc_[A-Za-z0-9]{16,200}$/.test(config.projectToken)) return null;
    var host;
    try { host = new URL(config.apiHost); } catch (error) { return null; }
    if (host.origin !== INGESTION_ORIGIN || host.username || host.password || host.search || host.hash || host.pathname !== '/') return null;
    if (!Array.isArray(config.productionHosts)) return null;
    return { token: config.projectToken, origin: host.origin, hosts: config.productionHosts.filter(function (value) { return PRODUCTION_HOSTS.indexOf(value) !== -1; }) };
  }

  function privacyBlocked(win) {
    var nav = win.navigator || {};
    return nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || win.doNotTrack === '1';
  }

  function pageIdentifier(win) {
    var crypto = win.crypto;
    if (!crypto) return null;
    if (typeof crypto.randomUUID === 'function') return 'web_page_' + crypto.randomUUID();
    if (typeof crypto.getRandomValues !== 'function') return null;
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    return 'web_page_' + Array.prototype.map.call(bytes, function (byte, index) {
      return ([4, 6, 8, 10].indexOf(index) !== -1 ? '-' : '') + byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function status() {
    return Object.assign({}, state, { pageSendLimit: SEND_LIMIT, identityScope: 'page_memory', persistentStorageUsed: false });
  }

  function install(win) {
    if (attached) return status();
    var raw = win && win.CHAEDA_WEB_ANALYTICS;
    var config = configValues(raw);
    state.configured = config !== null;
    if (!config) { state.reason = 'invalid_or_missing_config'; return status(); }
    if (raw.enabled !== true) { state.reason = 'disabled_in_config'; return status(); }
    if (!win.location || win.location.protocol !== 'https:' || config.hosts.indexOf(win.location.hostname) === -1) {
      state.reason = 'non_production_host'; return status();
    }
    if (privacyBlocked(win)) { state.reason = 'privacy_signal'; return status(); }
    var acquisition = win.ChaedaAcquisition;
    if (!acquisition || typeof acquisition.buildEvent !== 'function' || typeof acquisition.setAdapter !== 'function') {
      state.reason = 'acquisition_unavailable'; return status();
    }
    if (typeof win.fetch !== 'function') { state.reason = 'transport_unavailable'; return status(); }
    var distinctId;
    try { distinctId = pageIdentifier(win); } catch (error) { state.reason = 'randomness_unavailable'; return status(); }
    if (!distinctId) { state.reason = 'randomness_unavailable'; return status(); }
    attached = true;
    state.enabled = true;
    state.reason = 'ready';
    acquisition.setAdapter(function (name, input) {
      if (privacyBlocked(win)) {
        state.enabled = false;
        state.reason = 'privacy_signal';
        state.dropped += 1;
        return;
      }
      if (!state.enabled || state.attempted >= SEND_LIMIT) {
        state.enabled = false;
        state.reason = state.reason === 'privacy_signal' ? 'privacy_signal' : 'page_budget_exhausted';
        state.dropped += 1;
        return;
      }
      // adapter를 직접 호출해도 허용 항목 밖의 데이터나 이벤트는 전송되지 않는다.
      var safe = acquisition.buildEvent(name, input && input.page, input, input);
      if (!safe) { state.dropped += 1; return; }
      var properties = Object.assign({}, safe.properties, {
        '$process_person_profile': false,
        '$geoip_disable': true,
        '$ip': '0.0.0.0',
        platform: 'public_web',
        environment: 'production'
      });
      var payload = { api_key: config.token, distinct_id: distinctId, event: safe.event, properties: properties };
      state.attempted += 1;
      state.lastTransport = 'pending';
      try {
        Promise.resolve(win.fetch(config.origin + '/i/v0/e/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          mode: 'cors',
          redirect: 'error',
          keepalive: true
        })).then(function (response) {
          if (response && response.ok) {
            state.transportAccepted += 1;
            state.lastTransport = 'accepted';
          } else {
            state.transportFailed += 1;
            state.lastTransport = 'failed';
          }
        }, function () {
          state.transportFailed += 1;
          state.lastTransport = 'failed';
        });
      } catch (error) {
        state.transportFailed += 1;
        state.lastTransport = 'failed';
      }
    });
    return status();
  }

  return { install: install, status: status, configValues: configValues, privacyBlocked: privacyBlocked };
});
