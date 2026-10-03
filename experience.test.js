const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const publicScript = fs.readFileSync(path.join(__dirname, 'experience.js'), 'utf8');
const demoMain = fs.readFileSync(path.join(__dirname, '..', 'shared-kmp', 'web-demo', 'src', 'wasmJsMain', 'kotlin', 'com', 'chaeda', 'webdemo', 'Main.kt'), 'utf8');
const detailScroll = fs.readFileSync(path.join(__dirname, '..', 'shared-kmp', 'web-demo', 'src', 'wasmJsMain', 'resources', 'detail-scroll.js'), 'utf8');
const bondDetailContent = fs.readFileSync(path.join(__dirname, '..', 'shared-kmp', 'compose-ui', 'src', 'commonMain', 'kotlin', 'com', 'chaeda', 'composeui', 'ui', 'bonddetail', 'BondDetailContent.kt'), 'utf8');
const MissionProgress = require('./mission-progress.js');
const publicContent = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
const publicStyles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const guideHtml = fs.readFileSync(path.join(__dirname, 'guides', 'bond-yield-structure', 'index.html'), 'utf8');
const bondChart = fs.readFileSync(path.join(__dirname, 'guides', 'bond-yield-structure', 'BondChart.dc.html'), 'utf8');

test('simulator mission uses an interaction exposed by the demo UI', () => {
  assert.match(publicScript, /이자 지급 일정을 펼쳐 보세요/);
  assert.match(publicScript, /'simulator-schedule': \['simulator', 'schedule'\]/);
  assert.match(demoMain, /SimulatorUiEvent\.ScheduleToggled -> reportAction\("simulator-schedule"\)/);
  assert.doesNotMatch(publicScript, /세후 계산 조건을 바꿔 보세요|simulator-tax/);
});

test('registration and holdings missions require their matching user events', () => {
  assert.match(publicScript, /'register-form': \['register', 'form'\]/);
  assert.match(publicScript, /'register-alert': \['register', 'alert'\]/);
  assert.match(publicScript, /'register-submit-success': \['register', 'submit'\]/);
  assert.match(publicScript, /'holdings-inspect': \['holdings', 'distribution'\]/);
  assert.match(demoMain, /HoldingStepUiEvent\.Submit.*navigate\(DemoRoute\.Registered\).*reportAction\("register-submit-success"\)/s);
  assert.match(demoMain, /MyBondsUiEvent\.FutureIncomeClick -> Unit/);
  assert.doesNotMatch(demoMain, /MyBondsUiEvent\.FutureIncomeClick.*navigate\(DemoRoute\.Cashflow\)/s);
});

test('next is gated while the underlined skip always changes route', () => {
  assert.match(publicScript, /missionNext\.disabled = completed < step\.missions\.length/);
  assert.match(publicScript, /navigateFrameToStep\(activeStep\)/);
  assert.match(publicScript, /missionSkip\.addEventListener/);
  assert.doesNotMatch(publicScript, /앱에서 다음 행동을 이어가세요/);
});

test('course summary mission counts match the single step definition', () => {
  const counts = [...publicHtml.matchAll(/<em>미션 (\d+)<\/em>/g)].map((match) => Number(match[1]));
  assert.deepEqual(counts, [3, 1, 2, 3, 1, 2]);
  assert.match(publicScript, /steps\[index\]\.missions\.length/);
});

test('detail gesture observer does not cancel Compose scrolling', () => {
  assert.doesNotMatch(detailScroll, /preventDefault|stopPropagation/);
  assert.match(detailScroll, /wheel/);
  assert.match(detailScroll, /touchmove/);
  assert.doesNotMatch(detailScroll, /completionThreshold|detail-scroll-complete|postMessage/);
  assert.match(demoMain, /onContentEndReached = \{ reportAction\("detail-scroll-complete"\) \}/);
  assert.match(bondDetailContent, /onContentEndReached: \(\) -> Unit = \{\}/);
  assert.match(bondDetailContent, /scrollState\.maxValue > 0 && scrollState\.value >= scrollState\.maxValue/);
  assert.match(bondDetailContent, /scrollState = scrollState/);
  assert.match(publicScript, /'detail-scroll-complete': \['detail', 'reach-end'\]/);
  assert.doesNotMatch(publicScript, /detail-simulate-intent.*markMission|detail-register-intent.*markMission/);
});

test('cashflow is the sixth reachable course step', () => {
  assert.match(publicScript, /title: '전체 일정'.*route: 'cashflow'/s);
  assert.match(publicScript, /'cashflow-month': \['cashflow', 'month'\]/);
  assert.match(publicScript, /'cashflow-bond': \['cashflow', 'bond'\]/);
  assert.match(publicScript, /' \/ ' \+ steps\.length/);
});

test('demo registration starts with an empty memo and completion actions stay put', () => {
  assert.match(demoMain, /broker = "가상 증권사",\s*memo = ""/s);
  assert.match(demoMain, /DemoRoute\.Registered -> Box\(Modifier\.fillMaxSize\(\)\.padding\(bottom = 32\.dp\)\)/);
  assert.match(demoMain, /HoldingStepDoneScreenContent\([\s\S]*?onEvent = \{ Unit \}/);
  assert.doesNotMatch(demoMain, /register-go-holdings|register-go-cashflow/);
});

test('course mission wording matches visible app labels', () => {
  ['+ 비교', '비교', '얼마를 투자할까요', '이자 지급 일정', '매입일', '채권 시장 매수 단가',
    '액면 금액', '이자 지급 알림', '만기 알림', '등록하기', '위험', '만기', '발행사',
    '월별 막대', '전체 일정'].forEach((label) => assert.match(publicScript, new RegExp(label.replace('+', '\\+'))));
});

test('finishing closes without new or lingering confetti', () => {
  assert.match(publicScript, /querySelectorAll\('\.demo-confetti'\).*canvas\.remove\(\)/);
  assert.match(publicScript, /activeStep === steps\.length - 1\) \{ closeImmersive\(\); return; \}/);
  assert.doesNotMatch(publicScript, /activeStep === steps\.length - 1\) \{ burst\(/);
});

test('mission IDs preserve out-of-order, duplicate, reset, and route-independent state', () => {
  const steps = [{ id: 'register', missions: [
    { id: 'form' }, { id: 'alert' }, { id: 'submit' },
  ] }];
  const progress = MissionProgress.create(steps);

  assert.equal(MissionProgress.complete(progress, 'register', 'submit'), true);
  assert.deepEqual(progress.register, { form: false, alert: false, submit: true });
  assert.equal(MissionProgress.count(progress, steps[0]), 1);
  assert.equal(MissionProgress.isComplete(progress, steps[0]), false);
  assert.equal(MissionProgress.complete(progress, 'register', 'submit'), false);
  assert.equal(MissionProgress.complete(progress, 'register', 'missing'), false);
  assert.equal(MissionProgress.complete(progress, 'missing', 'submit'), false);
  assert.deepEqual(progress.register, { form: false, alert: false, submit: true });

  MissionProgress.complete(progress, 'register', 'alert');
  MissionProgress.complete(progress, 'register', 'form');
  assert.equal(MissionProgress.isComplete(progress, steps[0]), true);
  assert.equal(MissionProgress.completedStepCount(progress, steps), 1);

  const reset = MissionProgress.create(steps);
  assert.deepEqual(reset.register, { form: false, alert: false, submit: false });
  assert.deepEqual(progress.register, { form: true, alert: true, submit: true });
});

test('roadmap keeps five uncommitted directions in the requested phases', () => {
  assert.match(publicContent, /title: '로드맵'/);
  assert.match(publicContent, /key: 'phase2'[\s\S]*items: \['공식 공시와 보유자산 연결', '위험 신호의 영향 범위 설명', '원문 근거와 후속 확인 절차 연결'\]/);
  assert.match(publicContent, /key: 'phase3'[\s\S]*items: \['자산 다이어리', '포트폴리오 집중도'\]/);
  assert.match(publicContent, /데이터 확보와 정확성 검증을 거쳐 단계적으로 검토합니다/);
  assert.match(publicStyles, /\.roadmap::before/);
  assert.match(publicStyles, /scroll-snap-type:x mandatory/);
  assert.doesNotMatch(publicContent, /status: '현재 앱에서 제공'|status: '검증하며 확장할 방향'/);
  assert.doesNotMatch(publicScript, /phase\.status/);
  assert.match(publicStyles, /\.roadmap-phase\.phase1\{background:#fff;border:2px solid var\(--mint500\)/);
});

test('bond guide keeps an article-first flow and accessible cycle controls', () => {
  assert.match(guideHtml, /<button type="button" onClick="\{\{ opt\.set \}\}" aria-pressed="\{\{ opt\.selected \}\}"/);
  assert.doesNotMatch(guideHtml, /이 가이드의 표기 규칙|핵심 다시 보기|앱 체험으로 이동/);
  assert.match(guideHtml, /guide-meta-line/);
  assert.doesNotMatch(guideHtml, /background:#E0F2F1;border-radius:999px;padding:7px 14px/);
  assert.match(guideHtml, /guide-equal-products[^>]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(guideHtml, /tradeStep: 1/);
  assert.match(guideHtml, /tradeStageClass: "trade-stage-" \+ tradeStep/);
  assert.match(guideHtml, /tradePosition: tradeStep \+ " \/ 5"/);
  assert.doesNotMatch(guideHtml + bondChart, /[①②③④⑤]/);
  assert.match(guideHtml, /class="trade-range" type="range" min="0" max="1000" step="1"/);
  assert.match(guideHtml, /슬라이더를 움직여 내용을 확인해 보세요/);
  assert.doesNotMatch(guideHtml, /trade-range-labels|trade-current-copy/);
  assert.match(guideHtml, /tradeDuration = 10000/);
  assert.match(guideHtml, /Math\.floor\(progress \/ 200\)/);
  assert.match(guideHtml, /IntersectionObserver/);
  assert.match(guideHtml, /requestAnimationFrame\(this\.tickTrade\)/);
  assert.match(guideHtml, /tradeSlide: this\.slideTrade/);
  assert.match(guideHtml, /tradeKey: this\.keyTrade/);
  assert.match(guideHtml, /tradeToggle: this\.toggleTrade/);
  assert.match(guideHtml, /tradeReplay: this\.replayTrade/);
  assert.doesNotMatch(guideHtml, /class="aside trade-panel"|tradePrev:|tradeNext:|tradeReset:/);
  assert.match(guideHtml, /trade-calc-total[\s\S]*142,300원[\s\S]*15\.8%/);
  assert.match(bondChart, /trade-profit-card[\s\S]*42,300원[\s\S]*100,000원[\s\S]*142,300원/);
  assert.equal((guideHtml.match(/kind="trade"/g) || []).length, 0);
  assert.match(bondChart, /data-build-step="5"/);
  assert.match(publicStyles, /\.trade-stage-5/);
  assert.match(publicStyles, /div:nth-child\(2\):not\(:has\(\[data-build-step\]\)\)>div:nth-child\(-n\+3\)/);
  assert.match(publicStyles, /prefers-reduced-motion:reduce/);
  assert.match(publicStyles, /\.trade-build-item/);
});
