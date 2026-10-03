(function () {
  var C = window.CHAEDA_CONTENT;
  var MissionProgress = window.ChaedaMissionProgress;
  var el = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  function renderStaticHome() {
    var H = C.hero;
    el('hero').innerHTML = '<div class="wrap"><div>' +
      '<div class="eyebrow">' + esc(H.eyebrow) + '</div>' +
      '<h1>' + H.titleLines.map(esc).join('<br>') + '</h1>' +
      '<p>' + esc(H.body) + '</p><div class="disc">' + esc(H.disclaimer) + '</div>' +
      '<div class="btns">' + H.buttons.map(function (b) {
        return '<a class="btn primary" href="' + esc(b.href) + '" target="_blank" rel="noopener">' + esc(b.label) + '</a>';
      }).join('') + '<a class="btn ghost" href="#features">' + esc(H.demoLabel) + '</a></div></div></div>';

    var P = C.problem;
    el('problemContent').innerHTML = '<div class="section-head"><div class="kicker">' + esc(P.kicker) + '</div><h2>' + esc(P.title) + '</h2><p class="sub">' + esc(P.body) + '</p></div>' +
      '<div class="question-grid">' + P.questions.map(function (q) {
        return '<article><span>' + esc(q.no) + '</span><h3>' + esc(q.title) + '</h3><p>' + esc(q.body) + '</p></article>';
      }).join('') + '</div>';

    var V = C.vision;
    el('visionContent').innerHTML = '<div class="section-head"><div class="kicker">' + esc(V.kicker) + '</div><h2>' + esc(V.title) + '</h2></div><div class="roadmap" role="list">' +
      V.phases.map(function (phase) { return '<article class="roadmap-phase ' + esc(phase.key) + '" role="listitem"><div class="roadmap-marker" aria-hidden="true"></div><div class="roadmap-head"><b>' + esc(phase.label) + '</b></div><ul>' + phase.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></article>'; }).join('') +
      '</div><p class="vision-note">' + esc(V.note) + '</p>';

    el('notices').innerHTML = C.notices.map(function (n) {
      return '<div class="pane' + (n.strong ? ' strong' : '') + '"><h3>' + esc(n.title) + '</h3><p>' + esc(n.body) + '</p></div>';
    }).join('');
  }

  var frame = el('composeDemo');
  var shell = el('composeFrameShell');
  var fallback = el('composeFallback');
  var launch = el('demoLaunch');
  var restart = el('demoRestart');
  var immersive = el('demoImmersive');
  var immersiveFrame = el('immersiveDemo');
  var missionNext = el('missionNext');
  var missionSkip = el('missionSkip');
  var loadTimer = null;
  var loading = false;
  var activeStep = 0;
  var missionProgress = {};
  var celebratedSteps = {};

  var steps = [
    { id: 'compare', title: '채권 비교', description: '세 가상 채권을 직접 담고 비교표를 열어 보세요.', missions: [{ id: 'select-one', label: '채권 카드의 + 비교를 눌러 보세요' }, { id: 'select-all', label: '세 채권의 + 비교를 모두 눌러 보세요' }, { id: 'open', label: '하단 비교를 눌러 보세요' }], route: 'bonds' },
    { id: 'detail', title: '상세 확인', description: '채권 상세의 정보를 위에서 아래까지 살펴보세요.', missions: [{ id: 'reach-end', label: '아래 내용을 끝까지 확인해 보세요' }], route: 'detail' },
    { id: 'simulator', title: '수익 계산', description: '예시 금액을 바꾸고 이자 지급 일정을 확인해 보세요.', missions: [{ id: 'amount', label: '얼마를 투자할까요의 금액을 바꿔 보세요' }, { id: 'schedule', label: '이자 지급 일정을 펼쳐 보세요' }], route: 'simulator' },
    { id: 'register', title: '보유 등록', description: '매입 정보와 알림을 입력하고 등록을 완료해 보세요.', missions: [{ id: 'form', label: '매입일·채권 시장 매수 단가·액면 금액을 입력해 보세요' }, { id: 'alert', label: '이자 지급 알림·만기 알림을 바꿔 보세요' }, { id: 'submit', label: '등록하기를 눌러 보세요' }], route: 'register' },
    { id: 'holdings', title: '보유 관리', description: '세 보유채권의 위험·만기·발행사 분포를 살펴보세요.', missions: [{ id: 'distribution', label: '위험·만기·발행사 탭을 바꿔 보세요' }], route: 'holdings' },
    { id: 'cashflow', title: '전체 일정', description: '월별 원금과 이자 지급 일정을 직접 살펴보세요.', missions: [{ id: 'month', label: '월별 막대를 눌러 보세요' }, { id: 'bond', label: '전체 일정의 채권명을 눌러 보세요' }], route: 'cashflow' }
  ];

  var actionMissions = {
    'compare-open': ['compare', 'open'],
    'detail-scroll-complete': ['detail', 'reach-end'],
    'simulator-amount': ['simulator', 'amount'],
    'simulator-schedule': ['simulator', 'schedule'],
    'register-form': ['register', 'form'],
    'register-alert': ['register', 'alert'],
    'register-submit-success': ['register', 'submit'],
    'holdings-inspect': ['holdings', 'distribution'],
    'cashflow-month': ['cashflow', 'month'],
    'cashflow-bond': ['cashflow', 'bond'],
  };

  el('experienceStepTotal').textContent = steps.length;
  el('experienceCompletedTotal').textContent = steps.length;

  document.querySelectorAll('.experience-steps > li').forEach(function (item, index) {
    var count = item.querySelector('em');
    if (count && steps[index]) count.textContent = '미션 ' + steps[index].missions.length;
  });

  function resetMissionProgress() {
    missionProgress = MissionProgress.create(steps);
    celebratedSteps = {};
    activeStep = 0;
  }

  function setStatus(state, title, detail) {
    shell.dataset.state = state;
    fallback.innerHTML = '<b>' + esc(title) + '</b><span>' + esc(detail) + '</span>';
    fallback.hidden = state === 'ready';
  }

  function loadPreview() {
    if (loading || shell.dataset.state === 'ready') return;
    loading = true;
    setStatus('loading', '실제 앱 화면을 불러오는 중입니다', '잠시만 기다려 주세요.');
    frame.hidden = false;
    frame.src = frame.dataset.src;
    launch.disabled = true;
    loadTimer = window.setTimeout(function () {
      if (shell.dataset.state !== 'ready') {
        loading = false;
        frame.hidden = true;
        launch.disabled = false;
        frame.removeAttribute('src');
        setStatus('error', '앱 화면을 불러오지 못했습니다', '네트워크 상태를 확인하고 다시 시도해 주세요.');
      }
    }, 15000);
  }

  function burst(target) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    var rect = target.getBoundingClientRect();
    var colors = ['#00695C', '#26A69A', '#4DB6AC', '#B2DFDB', '#FFB300', '#FFD54F'];
    var pieces = Array.from({ length: 90 }, function () {
      return { x: rect.left + rect.width / 2, y: rect.top, vx: (Math.random() - .5) * 520, vy: -500 - Math.random() * 420, size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)], life: 0 };
    });
    canvas.className = 'demo-confetti';
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
    context.scale(devicePixelRatio, devicePixelRatio);
    document.body.appendChild(canvas);
    var last = performance.now();
    function draw(now) {
      var dt = Math.min(.032, (now - last) / 1000); last = now;
      context.clearRect(0, 0, innerWidth, innerHeight);
      pieces.forEach(function (piece) {
        piece.life += dt; piece.vy += 1100 * dt; piece.x += piece.vx * dt; piece.y += piece.vy * dt;
        context.globalAlpha = Math.max(0, 1 - piece.life / 2.4); context.fillStyle = piece.color;
        context.fillRect(piece.x, piece.y, piece.size, piece.size * .65);
      });
      if (pieces.some(function (piece) { return piece.life < 2.4; })) requestAnimationFrame(draw); else canvas.remove();
    }
    requestAnimationFrame(draw);
  }

  function renderMission(stepIndex) {
    var step = steps[stepIndex];
    var completed = MissionProgress.count(missionProgress, step);
    activeStep = stepIndex;
    el('missionStep').textContent = 'STEP ' + (stepIndex + 1) + ' / ' + steps.length;
    el('missionTitle').textContent = step.title;
    el('missionDescription').textContent = step.description;
    el('demoStepBadge').textContent = '현재 ' + (stepIndex + 1) + '단계';
    el('missionCount').textContent = completed + ' / ' + step.missions.length + ' 완료';
    el('missionList').innerHTML = step.missions.map(function (mission) {
      var done = missionProgress[step.id][mission.id];
      return '<li class="' + (done ? 'is-done' : '') + '"><span>' + (done ? '✓' : '') + '</span>' + esc(mission.label) + '</li>';
    }).join('');
    el('missionComplete').hidden = completed < step.missions.length;
    el('experienceCompleted').textContent = MissionProgress.completedStepCount(missionProgress, steps);
    el('missionPrev').disabled = stepIndex === 0;
    missionNext.disabled = completed < step.missions.length;
    missionNext.textContent = stepIndex === steps.length - 1 ? '체험 마치기' : '다음: ' + steps[stepIndex + 1].title + ' →';
    missionSkip.textContent = stepIndex === steps.length - 1 ? '그냥 마칠게요' : '그냥 이동하고 싶어요';
  }

  function markMission(stepId, missionId) {
    MissionProgress.complete(missionProgress, stepId, missionId);
    var step = steps.find(function (candidate) { return candidate.id === stepId; });
    if (step && MissionProgress.isComplete(missionProgress, step) && !celebratedSteps[stepId]) {
      celebratedSteps[stepId] = true;
      burst(missionNext);
    }
  }

  function handleDemoAction(action) {
    if (action.indexOf('compare-select:') === 0) {
      var count = Number(action.split(':')[1]);
      if (count >= 1) markMission('compare', 'select-one');
      if (count >= 3) markMission('compare', 'select-all');
    } else if (actionMissions[action]) {
      markMission(actionMissions[action][0], actionMissions[action][1]);
    }
    renderMission(activeStep);
  }

  function navigateFrameToStep(stepIndex) {
    var route = steps[stepIndex].route;
    if (!immersiveFrame.contentWindow) return;
    immersiveFrame.contentWindow.location.hash = route;
    window.setTimeout(function () {
      try {
        if (immersiveFrame.contentWindow.location.hash !== '#' + route) {
          immersiveFrame.src = 'app-demo/index.html?v=demo-20261002-18&nav=' + Date.now() + '#' + route;
        }
      } catch (_) {
        immersiveFrame.src = 'app-demo/index.html?v=demo-20261002-18&nav=' + Date.now() + '#' + route;
      }
    }, 120);
  }

  function openImmersive(reset) {
    immersive.setAttribute('aria-hidden', 'false');
    document.body.classList.add('demo-is-open');
    var resetQuery = reset ? '&reset=' + Date.now() : '';
    immersiveFrame.src = 'app-demo/index.html?v=demo-20261002-18' + resetQuery + '#bonds';
    resetMissionProgress();
    renderMission(0);
  }

  function closeImmersive() {
    immersive.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('demo-is-open');
    document.querySelectorAll('.demo-confetti').forEach(function (canvas) { canvas.remove(); });
    immersiveFrame.removeAttribute('src');
    launch.focus();
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    if (event.source === immersiveFrame.contentWindow && typeof event.data === 'string' && event.data.indexOf('chaeda-demo-action:') === 0) {
      handleDemoAction(event.data.slice('chaeda-demo-action:'.length));
      return;
    }
    if (event.data !== 'chaeda-demo-ready') return;
    if (event.source === frame.contentWindow) {
      window.clearTimeout(loadTimer);
      loading = false;
      shell.dataset.state = 'ready';
      fallback.hidden = true;
      frame.hidden = false;
      launch.disabled = false;
    }
  });
  frame.addEventListener('error', function () {
    window.clearTimeout(loadTimer);
    loading = false;
    frame.hidden = true;
    launch.disabled = false;
    setStatus('error', '앱 화면을 불러오지 못했습니다', '잠시 후 다시 시도해 주세요.');
  });
  launch.addEventListener('click', function () { openImmersive(false); });
  restart.addEventListener('click', function () {
    frame.dataset.src = 'app-demo/index.html?v=demo-20261002-18&reset=' + Date.now() + '#bonds';
    shell.dataset.state = 'idle';
    loading = false;
    frame.removeAttribute('src');
    frame.hidden = true;
    loadPreview();
  });
  el('demoClose').addEventListener('click', closeImmersive);
  el('demoImmersiveRestart').addEventListener('click', function () { openImmersive(true); });
  el('missionPrev').addEventListener('click', function () {
    if (activeStep === 0) return;
    activeStep -= 1;
    navigateFrameToStep(activeStep);
    renderMission(activeStep);
  });
  missionNext.addEventListener('click', function () {
    if (missionNext.disabled) return;
    if (activeStep === steps.length - 1) { closeImmersive(); return; }
    activeStep += 1;
    navigateFrameToStep(activeStep);
    renderMission(activeStep);
  });
  missionSkip.addEventListener('click', function () {
    if (activeStep === steps.length - 1) { closeImmersive(); return; }
    activeStep += 1;
    navigateFrameToStep(activeStep);
    renderMission(activeStep);
  });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && immersive.getAttribute('aria-hidden') === 'false') closeImmersive(); });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) {
        observer.disconnect();
        loadPreview();
      }
    }, { rootMargin: '180px 0px' });
    observer.observe(shell);
  }

  resetMissionProgress();
  renderStaticHome();
})();
