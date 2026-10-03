/* 채다 지원 사이트 — 렌더러
 * 문구·데이터는 모두 content.js 에 있습니다. 이 파일은 구조/동작만 담당합니다. */
(function () {
  var C = window.CHAEDA_CONTENT;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var el = function (id) { return document.getElementById(id); };
  var won = function (n) { return n.toLocaleString('ko-KR') + '원'; };
  var DemoCalc = window.CHAEDA_DEMO_CALCULATOR;
  /* 아이콘은 항상 장식이다 — aria-hidden 이 없으면 스크린리더가 ligature 원문("chevron_right")을 읽는다. */
  var ico = function (name, cls) {
    return '<span class="ms' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + name + '</span>';
  };

  /* 페이지 깊이 보정. 하위 폴더 페이지는 <body data-base="../../"> 로 선언한다.
   * <base href> 는 가이드의 #s1 같은 프래그먼트 링크까지 바꿔버리므로 쓰지 않는다. */
  var BASE = document.body.getAttribute('data-base') || '';
  var href = function (file) { return BASE + file; };

  /* 아이콘 매핑 (구조 정보 — 문구 아님) */
  var FEATURE_ICON = {
    browse: 'travel_explore', detail: 'query_stats', holdings: 'account_balance_wallet',
    income: 'savings', alerts: 'notifications_active', watch: 'compare_arrows'
  };
  var TAB_ICON = { browse: 'explore', holdings: 'account_balance_wallet', watch: 'favorite', alerts: 'settings' };
  var CARD_ICON = { 0: 'mail', 1: 'schedule', 2: 'smartphone' };

  /* 스토어 마크 (구조 정보 — 배포 시 공식 배지 이미지로 교체 권장) */
  var STORE_SVG = {
    apple: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="currentColor">' +
      '<path d="M16.7 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 6.9 1.2 9.2.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7 1.4 0 1.8.7 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.6-1-2.6-3.6zM14.4 5.9c.6-.8 1-1.8.9-2.9-.9.1-2 .6-2.6 1.4-.6.7-1 1.7-.9 2.7 1 .1 2-.4 2.6-1.2z"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="currentColor">' +
      '<path d="M4.5 3.2c-.3.3-.5.7-.5 1.3v15c0 .6.2 1 .5 1.3l8-7.8-8-7.8zm9.2 6.6L6.3 2.6l9.6 5.4-2.2 1.8zm0 4.4 2.2 1.8-9.6 5.4 7.4-7.2zm3.5-3.4 2.9 1.6c.6.3.6 1 0 1.4l-2.9 1.6-2.4-2.3 2.4-2.3z"/></svg>'
  };

  /* ── 공통 헤더 / 푸터 ─────────────────────── */
  function closeDrops(hdr) {
    Array.prototype.forEach.call(hdr.querySelectorAll('.navdrop.is-open'), function (d) {
      d.classList.remove('is-open');
      d.querySelector('.navdrop-btn').setAttribute('aria-expanded', 'false');
    });
  }

  function chrome(page) {
    var hdr = el('hdr');
    var ftr = el('ftr');

    if (hdr) {
      var nav = C.site.nav.map(function (n) {
        if (n.children) {
          var active = n.children.some(function (c) { return c.key === page; });
          var items = n.children.map(function (c) {
            return '<a href="' + href(c.file) + '"' + (c.key === page ? ' aria-current="page"' : '') + '>' + esc(c.label) + '</a>';
          }).join('');
          return '<div class="navdrop' + (active ? ' is-active' : '') + '">' +
            '<button type="button" class="navdrop-btn" aria-haspopup="true" aria-expanded="false">' + esc(n.label) +
            ico('expand_more', 'navdrop-caret') + '</button>' +
            '<div class="navdrop-menu">' + items + '</div></div>';
        }
        return '<a href="' + href(n.file) + '"' + (n.key === page ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>';
      }).join('');
      hdr.innerHTML = '<a class="skip" href="#main">본문 바로가기</a><div class="wrap">' +
        '<a class="brand" href="' + href('index.html') + '"><span class="mark" aria-hidden="true">' + esc(C.site.logoText) + '</span>' +
        '<span class="brandname">' + esc(C.site.name) + '</span></a>' +
        '<nav class="nav" aria-label="주요 메뉴">' + nav + '</nav></div>';
      Array.prototype.forEach.call(hdr.querySelectorAll('.navdrop-btn'), function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var drop = btn.parentNode;
          var wasOpen = drop.classList.contains('is-open');
          closeDrops(hdr);
          if (!wasOpen) {
            drop.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');
          }
        });
      });
      document.addEventListener('click', function () { closeDrops(hdr); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeDrops(hdr); }
      });
    }

    if (ftr) {
      ftr.innerHTML = '<div class="wrap"><div class="lines">' +
        C.footer.lines.map(esc).join('<br>') +
        '<span class="copy">' + esc(C.footer.copyright) + '</span>' +
        '</div><nav aria-label="사이트 정보">' +
        C.footer.nav.map(function (n) {
          return '<a href="' + href(n.file) + '">' + esc(n.label) + '</a>';
        }).join('') +
        '</nav></div>';
    }
    /* document.title 은 각 페이지의 정적 <title> 이 단일 출처다.
     * 여기서 덮어쓰면 크롤러가 보는 값과 사용자가 보는 값이 갈라지고,
     * 가이드 페이지에서는 dc-runtime 의 <helmet> title 과 경쟁한다. */
  }

  /* ── 프리뷰 상태 ──────────────────────────── */
  var state = {
    feature: C.features[0].key,
    chip: C.preview.browse.chips[0],
    sim: C.preview.detail.sim.defaultManwon,
    openHolding: null,
    yearIdx: 0,
    alerts: {},
    compare: C.preview.watch.defaultSelected.slice(),
    demoStep: 0,
    demoBondId: C.demo.bonds[0].id,
    demoAmount: C.demo.amountDefault,
    demoRegistered: false
  };
  C.preview.alerts.toggles.forEach(function (t) { state.alerts[t.key] = !!t.on; });

  function riskBadge(meta) {
    var m = String(meta).split('·').pop().trim();
    if (!m) return '';
    var cls = m === '안전' ? 'safe' : 'normal';
    return '<span class="badge ' + cls + '">' + esc(m) + '</span>';
  }

  function screenBody() {
    var k = state.feature, P = C.preview, h = '';

    if (k === 'browse') {
      var B = P.browse;
      var list = B.bonds.filter(function (b) {
        return state.chip === B.chips[0] ? true
          : state.chip === B.shortChipLabel ? b.short : b.kind === state.chip;
      });
      h += '<div class="stack">' +
        '<div class="search">' + ico('search') + esc(B.searchPlaceholder) + '</div>' +
        '<div class="chips">' + B.chips.map(function (c) {
          return '<button class="chip" data-chip="' + esc(c) + '" aria-pressed="' + (state.chip === c) + '">' + esc(c) + '</button>';
        }).join('') + '</div>' +
        '<div class="cnt">' + list.length + esc(B.countSuffix) + '</div>' +
        list.map(function (b) {
          var meta = b.meta.split('·').slice(0, 2).join('·').trim();
          return '<div class="card"><div class="c-top"><div><div class="c-name">' + esc(b.name) + '</div>' +
            '<div class="c-meta">' + esc(meta) + '</div></div>' +
            '<div style="text-align:right"><div class="c-val">' + esc(b.yield) + '</div>' +
            '<div style="margin-top:6px">' + riskBadge(b.meta) + '</div></div></div></div>';
        }).join('') + '</div>';
    }

    if (k === 'detail') {
      var D = P.detail, S = D.sim;
      var principal = state.sim * 10000;
      var interest = Math.round(principal * S.rate * S.years);
      h += '<div class="stack" style="gap:12px">' +
        '<div class="hero-card"><div class="lbl">' + esc(D.sub) + '</div>' +
        '<div style="margin-top:6px;font-size:19px;font-weight:800;letter-spacing:-.025em">' + esc(D.name) + '</div></div>' +
        '<div class="metrics">' + D.metrics.map(function (m, i) {
          return '<div class="metric"><div class="k">' + esc(m.k) + '</div>' +
            '<div class="v' + (i === 0 ? ' mint' : '') + '">' + esc(m.v) + '</div></div>';
        }).join('') + '</div>' +
        '<div class="panel"><div class="cap">' + esc(S.label) + '</div>' +
        '<div style="margin-top:12px;display:flex;justify-content:space-between;align-items:baseline">' +
        '<span style="font-size:12px;color:var(--g600)">' + esc(S.amountLabel) + '</span>' +
        '<span style="font-size:17px;font-weight:800">' + won(principal) + '</span></div>' +
        '<input type="range" id="sim" aria-label="' + esc(S.label) + '" min="' + S.min + '" max="' + S.max + '" step="' + S.step + '" value="' + state.sim + '">' +
        '<div class="stack" style="gap:8px;margin-top:8px">' +
        '<div class="kv"><span>' + esc(S.interestLabel) + '</span><b style="color:var(--mint600)">+' + won(interest) + '</b></div>' +
        '<div class="kv"><span>' + esc(S.totalLabel) + '</span><b>' + won(principal + interest) + '</b></div></div>' +
        '<div class="small" style="margin-top:12px">' + esc(S.note) + '</div></div>' +
        '<div class="cta">' + ico('add_circle') + esc(D.cta) + '</div></div>';
    }

    if (k === 'holdings') {
      var H = P.holdings;
      h += '<div class="stack">' +
        '<div class="hero-card"><div class="lbl">' + esc(H.summaryLabel) + '</div>' +
        '<div class="big">' + esc(H.summaryValue) + '</div>' +
        '<div class="met">' + esc(H.summaryMeta) + '</div></div>' +
        H.items.map(function (it) {
          var open = state.openHolding === it.name;
          return '<div class="card' + (open ? ' on' : '') + '" data-holding="' + esc(it.name) + '" style="cursor:pointer">' +
            '<div class="c-top"><div><div class="c-name">' + esc(it.name) + '</div>' +
            '<div class="c-meta">' + esc(it.meta) + '</div></div>' +
            '<div class="c-val">' + esc(it.pl) + '</div></div>' +
            (open ? '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--g200)" class="stack" >' +
              it.rows.map(function (r) { return '<div class="kv"><span>' + esc(r.k) + '</span><b>' + esc(r.v) + '</b></div>'; }).join('') +
              '</div>' : '') + '</div>';
        }).join('') +
        '<div class="small" style="padding:2px">' + esc(H.hint) + '</div></div>';
    }

    if (k === 'income') {
      var I = P.income, y = I.years[state.yearIdx];
      var max = Math.max.apply(null, y.bars);
      h += '<div class="stack" style="gap:12px">' +
        '<div class="seg"><button data-year="-1">' + ico('chevron_left') + '</button>' +
        '<span class="yr">' + y.year + '년</span>' +
        '<button data-year="1">' + ico('chevron_right') + '</button></div>' +
        '<div class="tintcard"><div class="lbl">' + y.year + esc(I.totalLabelSuffix) + '</div>' +
        '<div class="big">' + esc(y.total) + '</div>' +
        '<div class="bars">' + y.bars.map(function (v, i) {
          return '<div><b class="' + (v === max && v > 0 ? '' : 'dim') + '" style="height:' + (v === 0 ? '3px' : v + '%') + '"></b>' +
            '<span>' + (i + 1) + '</span></div>';
        }).join('') + '</div></div>' +
        '<div class="rows">' + y.schedule.map(function (s) {
          var maturity = s.kind.indexOf('만기') >= 0;
          return '<div><div style="display:flex;align-items:center;gap:10px">' +
            '<span class="dot ' + (maturity ? 'm' : 'i') + '"></span><div>' +
            '<div class="rname">' + esc(s.name) + '</div>' +
            '<div class="rmeta">' + esc(s.date) + ' · ' + esc(s.kind) + '</div></div></div>' +
            '<div class="ramt ' + (maturity ? 'lav' : 'mint') + '">' + esc(s.amount) + '</div></div>';
        }).join('') + '</div></div>';
    }

    if (k === 'alerts') {
      var A = P.alerts, queue = [];
      A.toggles.forEach(function (t) { if (state.alerts[t.key]) queue = queue.concat(t.queue || []); });
      h += '<div class="stack" style="gap:14px"><div class="rows">' + A.toggles.map(function (t) {
        return '<div><div><div class="rname">' + esc(t.label) + '</div>' +
          '<div class="rmeta">' + esc(t.desc) + '</div></div>' +
          '<button class="sw" data-toggle="' + esc(t.key) + '" role="switch" aria-checked="' + !!state.alerts[t.key] + '"><i></i></button></div>';
      }).join('') + '</div>' +
        '<div class="panel" style="border:0;background:var(--g100)"><div class="cap" style="color:var(--g700)">' +
        esc(A.queueLabel) + '</div><div class="stack" style="gap:10px;margin-top:12px">' +
        queue.map(function (q) {
          return '<div class="kv"><span style="font-weight:600;color:var(--g800)">' + esc(q.name) + '</span>' +
            '<span style="color:var(--g600);font-size:11.5px">' + esc(q.when) + '</span></div>';
        }).join('') +
        (queue.length === 0 ? '<div class="small">' + esc(A.emptyText) + '</div>' : '') +
        '</div></div></div>';
    }

    if (k === 'watch') {
      var W = P.watch;
      h += '<div class="stack"><div class="cnt">' + esc(W.hint) + '</div>' +
        P.browse.bonds.slice(0, 4).map(function (b) {
          var on = state.compare.indexOf(b.name) >= 0;
          return '<div class="pickrow' + (on ? ' on' : '') + '" data-watch="' + esc(b.name) + '">' +
            '<div class="check' + (on ? ' on' : '') + '">' + (on ? ico('check') : '') + '</div>' +
            '<div style="flex:1"><div class="c-name">' + esc(b.name) + '</div>' +
            '<div class="c-meta">' + esc(b.meta.split('·').slice(0, 2).join('·').trim()) + '</div></div>' +
            '<div class="c-val">' + esc(b.yield) + '</div></div>';
        }).join('') + '</div>';
    }
    return h;
  }

  function renderExplorer() {
    var f = C.features.filter(function (x) { return x.key === state.feature; })[0];
    var W = C.preview.watch;
    el('screenTitle').textContent = f.screenTitle;
    el('screenBody').innerHTML = screenBody();

    var bar = el('cmpbar');
    if (state.feature === 'watch') {
      var on = state.compare.length >= 2;
      bar.hidden = false;
      bar.innerHTML = '<div class="cmpbtn' + (on ? ' on' : '') + '">' +
        (on ? state.compare.length + esc(W.barTextSuffix) : esc(W.emptyBarText)) + '</div>';
    } else { bar.hidden = true; bar.innerHTML = ''; }

    Array.prototype.forEach.call(document.querySelectorAll('[data-feature]'), function (n) {
      n.setAttribute('aria-selected', String(n.getAttribute('data-feature') === state.feature));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (n) {
      n.setAttribute('aria-selected', String(n.getAttribute('data-tab') === state.feature));
    });
  }

  function selectedDemoBond() {
    return C.demo.bonds.filter(function (b) { return b.id === state.demoBondId; })[0] || C.demo.bonds[0];
  }

  function demoResult() {
    return DemoCalc.calculate({
      budget: state.demoAmount,
      unitPrice: selectedDemoBond().unitPrice,
      annualRatePct: selectedDemoBond().rate,
      years: selectedDemoBond().years
    });
  }

  function demoCard(b) {
    var selected = b.id === state.demoBondId;
    return '<button type="button" class="demo-bond' + (selected ? ' is-selected' : '') + '" data-demo-bond="' + esc(b.id) + '" aria-pressed="' + selected + '">' +
      '<span><b>' + esc(b.name) + '</b><small>' + esc(b.kind) + ' · ' + esc(b.grade) + ' · 만기 ' + esc(b.maturity) + '</small></span>' +
      '<span class="demo-rate"><b>' + esc(b.rate.toFixed(2)) + '%</b><small>표면이율</small></span></button>';
  }

  function renderDemo() {
    var D = C.demo, b = selectedDemoBond(), r = demoResult(), body = '', title = '';
    if (state.demoStep === 0) {
      title = '둘러보기';
      body = '<div class="search">' + ico('search') + '채권명 · 종목코드 검색</div>' +
        '<div class="chips"><span class="chip" aria-pressed="true">전체</span><span class="chip">국채</span><span class="chip">회사채</span></div>' +
        '<div class="demo-list-head"><b>예시 채권 ' + D.bonds.length + '건</b><span>채권을 눌러 상세 보기</span></div>' +
        '<div class="demo-bond-list">' + D.bonds.map(demoCard).join('') + '</div>';
    } else if (state.demoStep === 1) {
      title = '채권 상세';
      body = '<div class="demo-detail-hero"><span>' + esc(b.kind) + ' · ' + esc(b.grade) + '</span><h3>' + esc(b.name) + '</h3><small>' + esc(b.code) + '</small></div>' +
        '<div class="metrics"><div class="metric"><div class="k">표면이율</div><div class="v mint">' + esc(b.rate.toFixed(2)) + '%</div></div><div class="metric"><div class="k">만기</div><div class="v">' + esc(b.maturity.slice(2).replace(/-/g,'.')) + '</div></div><div class="metric"><div class="k">이자 주기</div><div class="v">' + esc(b.cycleMonths) + '개월</div></div></div>' +
        '<div class="demo-register"><label for="demoAmount">' + esc(D.amountLabel) + '<output id="demoAmountOut">' + won(state.demoAmount) + '</output></label>' +
        '<input id="demoAmount" type="range" min="' + D.amountMin + '" max="' + D.amountMax + '" step="' + D.amountStep + '" value="' + state.demoAmount + '">' +
        '<div class="demo-range"><span>' + won(D.amountMin) + '</span><span>' + won(D.amountMax) + '</span></div>' +
        '<button type="button" class="demo-app-primary" data-demo-next>' + ico('calculate') + esc(D.calculate) + '</button></div>';
    } else if (state.demoStep === 2) {
      title = '예상 수익';
      body = '<div class="demo-result"><div class="result-main"><span>' + esc(b.name) + ' · 예상 세후 만기 수령액</span><strong>' + won(r.estimatedTotal) + '</strong><small>원금 상환액 + 세후 단순 이자</small></div>' +
        '<dl><div><dt>예상 매입금액</dt><dd>' + won(r.purchaseAmount) + '</dd></div><div><dt>액면금액</dt><dd>' + won(r.faceAmount) + '</dd></div>' +
        '<div><dt>세전 단순 이자</dt><dd>' + won(r.grossInterest) + '</dd></div><div><dt>예상 원천징수</dt><dd>−' + won(r.withholdingTax) + '</dd></div></dl>' +
        '<p class="calc-note">고정금리·정상 만기상환 전제의 단순 계산입니다. 15.4%는 예시 이자에만 적용합니다. 실제 이표 일정·경과이자·체결가·수수료와 개인별 과세 조건에 따라 달라질 수 있습니다.</p>' +
        '<button type="button" class="demo-app-primary" data-demo-register>' + ico('add_circle') + esc(D.register) + '</button></div>';
    } else {
      title = '나의 채권';
      body = '<div class="demo-holding-summary"><span>예시 보유 금액</span><strong>' + won(r.faceAmount) + '</strong><small>가상 등록 1종목</small></div>' +
        '<div class="holding-demo"><div class="holding-top"><div><span>보유채권</span><h3>' + esc(b.name) + '</h3></div><span class="status-pill">데모</span></div>' +
        '<div class="holding-grid"><div><span>등록 액면금액</span><b>' + won(r.faceAmount) + '</b></div><div><span>만기일</span><b>' + esc(b.maturity) + '</b></div><div><span>이자 주기</span><b>' + esc(b.cycleMonths) + '개월</b></div><div><span>예산 잔액</span><b>' + won(r.remainingCash) + '</b></div></div>' +
        '<div class="vision-preview"><b>앞으로 연결할 관리 경험</b><span>공식 정보의 변화 → 내 채권 영향 확인 → 원문과 후속 확인 항목</span><small>미래 비전 예시이며 현재 제공 기능이 아닙니다.</small></div></div>';
    }

    var backDisabled = state.demoStep === 0;
    el('demoApp').innerHTML = '<div class="demo-shell"><div class="demo-banner">' + ico('science') + '<b>' + esc(D.badge) + '</b><span>' + esc(D.caution) + '</span></div>' +
      '<div class="demo-device-wrap"><div class="demo-device"><div class="demo-status"><span>9:41</span><span>' + ico('signal_cellular_alt') + ico('wifi') + ico('battery_full') + '</span></div>' +
      '<div class="demo-appbar"><button type="button" data-demo-prev' + (backDisabled ? ' disabled' : '') + ' aria-label="이전 화면">' + ico('arrow_back') + '</button><b>' + esc(title) + '</b><button type="button" data-demo-reset aria-label="처음부터 다시">' + ico('restart_alt') + '</button></div>' +
      '<div class="demo-appbody" aria-live="polite">' + body + '</div><div class="demo-tabbar">' +
      '<button type="button" data-demo-tab="0" class="' + (state.demoStep < 3 ? 'is-active' : '') + '">' + ico('explore') + '<span>둘러보기</span></button>' +
      '<button type="button" data-demo-tab="3" class="' + (state.demoStep === 3 ? 'is-active' : '') + '"' + (state.demoRegistered ? '' : ' disabled') + '>' + ico('account_balance_wallet') + '<span>나의 채권</span></button>' +
      '<button type="button" disabled>' + ico('favorite') + '<span>관심</span></button><button type="button" disabled>' + ico('settings') + '<span>설정</span></button></div></div>' +
      '<aside class="demo-coach"><span>앱 화면을 직접 눌러보세요</span><h3>' + esc(D.steps[state.demoStep]) + '</h3><p>' + (state.demoStep === 0 ? '목록에서 궁금한 채권을 선택하세요.' : state.demoStep === 1 ? '금액을 바꾸고 예상 수익을 계산하세요.' : state.demoStep === 2 ? '계산 가정을 확인하고 보유채권으로 등록하세요.' : '등록한 채권의 금액과 일정을 확인하세요.') + '</p><button type="button" data-demo-reset>' + ico('restart_alt') + esc(D.startOver) + '</button></aside></div></div>';
  }

  /* ── 소개 페이지 ──────────────────────────── */
  function home() {
    var H = C.hero;
    el('hero').innerHTML = '<div class="wrap"><div>' +
      '<div class="eyebrow">' + esc(H.eyebrow) + '</div>' +
      '<h1>' + H.titleLines.map(esc).join('<br>') + '</h1>' +
      '<p>' + esc(H.body) + '</p>' +
      '<div class="disc">' + esc(H.disclaimer) + '</div>' +
      '<div class="btns">' + H.buttons.map(function (b) {
        return '<a class="btn primary" href="' + esc(b.href) + '" target="_blank" rel="noopener">' +
          (STORE_SVG[b.store] || '') + esc(b.label) + '</a>';
      }).join('') + '<a class="btn ghost" href="#demo">' + esc(H.demoLabel) + '</a></div></div>' +
      '</div>';

    var P = C.problem;
    el('problemContent').innerHTML = '<div class="section-head"><div class="kicker">' + esc(P.kicker) + '</div><h2>' + esc(P.title) + '</h2><p class="sub">' + esc(P.body) + '</p></div>' +
      '<div class="question-grid">' + P.questions.map(function (q) { return '<article><span>' + esc(q.no) + '</span><h3>' + esc(q.title) + '</h3><p>' + esc(q.body) + '</p></article>'; }).join('') + '</div>';
    el('demoHead').innerHTML = '<div class="kicker">' + esc(C.demo.kicker) + '</div><h2>' + esc(C.demo.title) + '</h2><p class="sub">' + esc(C.demo.body) + '</p>';
    var V = C.vision;
    el('visionContent').innerHTML = '<div class="section-head"><div class="kicker">' + esc(V.kicker) + '</div><h2>' + esc(V.title) + '</h2></div><div class="roadmap" role="list">' +
      V.phases.map(function (phase) { return '<article class="roadmap-phase ' + esc(phase.key) + '" role="listitem"><div class="roadmap-marker" aria-hidden="true"></div><div class="roadmap-head"><b>' + esc(phase.label) + '</b></div><ul>' + phase.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></article>'; }).join('') +
      '</div><p class="vision-note">' + esc(V.note) + '</p>';

    el('featTitle').textContent = C.featuresSection.title;
    el('status').innerHTML = '<span>' + esc(C.preview.statusTime) + '</span>' +
      '<span style="display:flex;gap:4px;align-items:center">' + ico('signal_cellular_alt', '') +
      ico('wifi', '') + ico('battery_full', '') + '</span>';
    /* aria-selected 는 tab 역할 위에서만 유효하다 — role 없이 쓰면 무시된다. */
    el('tabbar').setAttribute('role', 'tablist');
    el('tabbar').innerHTML = C.preview.tabs.map(function (t) {
      return '<button class="tab" role="tab" data-tab="' + esc(t.key) + '">' +
        ico(TAB_ICON[t.key] || 'circle') + '<span>' + esc(t.label) + '</span></button>';
    }).join('');
    el('frail').setAttribute('role', 'tablist');
    el('frail').innerHTML = C.features.map(function (f) {
      return '<button class="fitem" role="tab" data-feature="' + esc(f.key) + '">' +
        '<span class="icn">' + ico(FEATURE_ICON[f.key] || 'circle') + '</span>' +
        '<span style="flex:1"><h3>' + esc(f.title) + '</h3><p>' + esc(f.body) + '</p></span>' +
        '<span class="arw ms" aria-hidden="true">chevron_right</span></button>';
    }).join('');
    el('notices').innerHTML = C.notices.map(function (n) {
      return '<div class="pane' + (n.strong ? ' strong' : '') + '"><h3>' + esc(n.title) + '</h3><p>' + esc(n.body) + '</p></div>';
    }).join('');

    renderExplorer();
    renderDemo();

    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-feature],[data-tab],[data-chip],[data-holding],[data-year],[data-toggle],[data-watch],[data-demo-bond],[data-demo-prev],[data-demo-next],[data-demo-register],[data-demo-reset],[data-demo-tab]') : null;
      if (!t) return;
      var d = t.dataset;
      if (d.demoBond) { state.demoBondId = d.demoBond; state.demoStep = 1; renderDemo(); return; }
      if (d.demoPrev !== undefined) { state.demoStep = Math.max(0, state.demoStep - 1); renderDemo(); return; }
      if (d.demoNext !== undefined) { state.demoStep = Math.min(C.demo.steps.length - 1, state.demoStep + 1); renderDemo(); return; }
      if (d.demoRegister !== undefined) { state.demoRegistered = true; state.demoStep = 3; renderDemo(); return; }
      if (d.demoReset !== undefined) { state.demoStep = 0; state.demoBondId = C.demo.bonds[0].id; state.demoAmount = C.demo.amountDefault; state.demoRegistered = false; renderDemo(); return; }
      if (d.demoTab !== undefined) { if (Number(d.demoTab) !== 3 || state.demoRegistered) state.demoStep = Number(d.demoTab); renderDemo(); return; }
      if (d.feature) state.feature = d.feature;
      else if (d.tab) state.feature = d.tab;
      else if (d.chip) state.chip = d.chip;
      else if (d.holding) state.openHolding = state.openHolding === d.holding ? null : d.holding;
      else if (d.year) state.yearIdx = Math.min(C.preview.income.years.length - 1, Math.max(0, state.yearIdx + Number(d.year)));
      else if (d.toggle) state.alerts[d.toggle] = !state.alerts[d.toggle];
      else if (d.watch) {
        var i = state.compare.indexOf(d.watch);
        if (i >= 0) state.compare.splice(i, 1);
        else if (state.compare.length < C.preview.watch.maxCompare) state.compare.push(d.watch);
      }
      renderExplorer();
    });
    document.addEventListener('input', function (e) {
      if (e.target.id === 'sim') { state.sim = Number(e.target.value); renderExplorer(); }
      if (e.target.id === 'demoAmount') {
        state.demoAmount = Number(e.target.value);
        var out = el('demoAmountOut');
        if (out) out.textContent = won(state.demoAmount);
      }
    });
  }

  /* ── 지원 페이지 ──────────────────────────── */
  function support() {
    var S = C.support;
    el('title').textContent = S.title;
    el('lede').textContent = S.intro;
    el('cards').innerHTML = S.cards.map(function (c, i) {
      var v = c.mailto ? '<a href="mailto:' + esc(c.value) + '">' + esc(c.value) + '</a>' : esc(c.value);
      return '<div class="ccard' + (c.primary ? ' strong' : '') + '">' +
        '<div class="k">' + esc(c.label) + '</div><div class="v">' + v + '</div></div>';
    }).join('');
    el('faqLabel').textContent = S.faqLabel;
    el('faq').innerHTML = S.faqs.map(function (f, i) {
      return '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) +
        '<span class="ms" aria-hidden="true">expand_more</span></summary><p>' + esc(f.a) + '</p></details>';
    }).join('');
    el('blocks').innerHTML = S.blocks.map(function (b) {
      return '<div class="pane' + (b.strong ? ' strong' : '') + '"><h3>' + esc(b.title) + '</h3>' +
        (b.body ? '<p>' + esc(b.body) + '</p>' : '') +
        (b.items ? '<ul>' + b.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }).join('');
  }

  /* ── 개인정보처리방침 ─────────────────────── */
  function privacy() {
    var P = C.privacy;
    el('title').textContent = P.title;
    el('pmeta').textContent = P.meta;
    el('pintro').innerHTML = [].concat(P.intro).map(function (p) {
      return '<p class="lede">' + esc(p) + '</p>';
    }).join('');
    el('tocLabel').textContent = P.tocLabel;
    /* 앵커는 제목에서 뽑은 슬러그를 쓴다. 인덱스(#s0…)로 두면 섹션을 하나 끼워넣는 순간
     * 밖에서 걸어둔 딥링크가 조용히 다른 조항을 가리킨다. */
    function slug(s, i) {
      var m = String(s.title).match(/^\s*(\d+)\./);
      return m ? 's' + m[1] : 's' + (i + 1);
    }
    el('toc').innerHTML = P.sections.map(function (s, i) {
      return '<a href="#' + slug(s, i) + '">' + esc(s.title) + '</a>';
    }).join('');

    function item(it) {
      if (typeof it === 'string') return '<li>' + esc(it) + '</li>';
      var body = esc(it.text);
      if (it.link) {
        body += ' <a href="' + esc(it.link) + '" target="_blank" rel="noopener">' + esc(it.link) + '</a>';
        if (it.tail) body += ' <span class="tail">' + esc(it.tail) + '</span>';
      }
      if (it.items) body += '<ul>' + it.items.map(item).join('') + '</ul>';
      return '<li>' + body + '</li>';
    }

    function block(b) {
      if (b.type === 'p') return '<p>' + esc(b.text) + '</p>';
      if (b.type === 'ol') return '<ol>' + b.items.map(item).join('') + '</ol>';
      if (b.type === 'ul') return '<ul>' + b.items.map(item).join('') + '</ul>';
      if (b.type === 'table') {
        /* CSS grid 로 그리되 표 의미는 role 로 준다 — 그리드 div 만으로는
         * 스크린리더에 행/열 관계가 전혀 전달되지 않는다. 첫 행은 헤더로 취급한다. */
        return '<div class="tbl" role="table">' + b.rows.map(function (r, ri) {
          var cell = ri === 0 ? 'columnheader' : 'cell';
          return '<div class="tr" role="row" style="grid-template-columns:' + esc(b.cols) + '">' +
            r.map(function (c) {
              return '<div class="td" role="' + cell + '">' + esc(c) + '</div>';
            }).join('') + '</div>';
        }).join('') + '</div>';
      }
      return '';
    }

    el('psecs').innerHTML = P.sections.map(function (s, i) {
      return '<section class="psec"><h2 id="' + slug(s, i) + '">' + esc(s.title) + '</h2>' +
        (s.blocks || []).map(block).join('') + '</section>';
    }).join('');
  }

  /* Material Symbols 는 ligature 폰트라, Google Fonts 가 막힌 망(사내·학교)에서는
   * 아이콘 자리에 "chevron_right" 같은 원문이 그대로 노출된다. 로드 실패를 감지해 숨긴다. */
  function guardIconFont() {
    if (!document.fonts || !document.fonts.load) { return; }
    document.fonts.load('24px "Material Symbols Outlined"').then(function () {
      if (!document.fonts.check('24px "Material Symbols Outlined"')) {
        document.documentElement.classList.add('no-ms');
      }
    })['catch'](function () {
      document.documentElement.classList.add('no-ms');
    });
  }

  var page = document.body.dataset.page;
  chrome(page);
  guardIconFont();
  if (page === 'home-legacy') home();
  if (page === 'support') support();
  if (page === 'privacy') privacy();
})();
