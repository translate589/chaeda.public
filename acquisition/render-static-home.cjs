/* content.js 정본에서 검색·JavaScript 미사용용 홈 HTML을 갱신한다. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), context);
const C = context.window.CHAEDA_CONTENT;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const H = C.hero;
/* 글 + 앱 예시 화면 2단 섹션(채권 뉴스·튜토리얼). */
const spotlight = (S, titleId, preview) => '<div class="spot-layout"><div class="spot-copy"><div class="kicker">' + esc(S.kicker) + '</div><h2 id="' + titleId + '">' + S.titleLines.map(esc).join('<br>') + '</h2><p class="sub">' + esc(S.body) + '</p><ul class="spot-points">' + S.points.map(p => '<li><b>' + esc(p.title) + '</b><span>' + esc(p.body) + '</span></li>').join('') + '</ul></div>' + preview + '</div>';
const nav = C.site.nav.flatMap(item => item.children || [item]);
const blocks = {
  header: '<a class="skip" href="#main">본문 바로가기</a><div class="wrap"><a class="brand" href="index.html"><span class="mark" aria-hidden="true">' + esc(C.site.logoText) + '</span><span class="brandname">' + esc(C.site.name) + '</span></a><nav class="nav static-nav" aria-label="주요 메뉴">' + nav.map(item => '<a href="' + esc(item.file) + '"' + (item.key === 'home' ? ' aria-current="page"' : '') + '>' + esc(item.label) + '</a>').join('') + '</nav></div>',
  hero: '<div class="wrap"><div><div class="eyebrow">' + esc(H.eyebrow) + '</div><h1>' + H.titleLines.map(esc).join('<br>') + '</h1><p>' + esc(H.body) + '</p><div class="disc">' + esc(H.disclaimer) + '</div><div class="btns">' + H.buttons.map(button => '<a class="btn primary" href="' + esc(button.href) + '" target="_blank" rel="noopener" data-store="' + esc(button.store) + '" data-placement="hero">' + esc(button.label) + '</a>').join('') + '<a class="btn ghost" href="#features" data-acquisition-action="experience">' + esc(H.demoLabel) + '</a></div></div></div>',
  problem: '<div class="section-head"><div class="kicker">' + esc(C.problem.kicker) + '</div><h2>' + esc(C.problem.title) + '</h2><p class="sub">' + esc(C.problem.body) + '</p></div><div class="question-grid">' + C.problem.questions.map(item => '<article><span>' + esc(item.no) + '</span><h3>' + esc(item.title) + '</h3><p>' + esc(item.body) + '</p></article>').join('') + '</div>',
  news: spotlight(C.newsSection, 'newsTitle', '<div class="spot-preview" aria-label="채권 뉴스 예시 화면"><div class="spot-preview-head"><b>' + esc(C.newsSection.preview.title) + '</b><span>' + esc(C.newsSection.preview.updated) + '</span></div>' + C.newsSection.preview.days.map(day => '<div class="spot-group">' + esc(day.label) + '</div>' + day.digests.map(d => '<article class="news-digest"><h3>' + esc(d.title) + '</h3><ul>' + d.articles.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' + (d.hasMore ? '<div class="news-more">더 보기 <span aria-hidden="true">›</span></div>' : '') + '</article>').join('')).join('') + '<p class="spot-note">' + esc(C.newsSection.preview.note) + '</p></div>') + '<p class="spot-disc">' + esc(C.newsSection.disclaimer) + '</p>',
  tutorial: spotlight(C.tutorialSection, 'tutorialTitle', '<div class="spot-preview" aria-label="튜토리얼 목록 예시 화면"><div class="spot-preview-head"><b>' + esc(C.tutorialSection.preview.title) + '</b></div><div class="tut-progress">' + esc(C.tutorialSection.preview.progress) + '</div>' + C.tutorialSection.preview.groups.map(group => '<div class="spot-group">' + esc(group.label) + '</div>' + group.items.map(item => '<div class="tut-row"><div><b>' + esc(item.title) + '</b><span>' + esc(item.body) + '</span></div>' + (item.done ? '<em>✓ 완료</em>' : '') + '<i aria-hidden="true">›</i></div>').join('')).join('') + '<p class="spot-note">' + esc(C.tutorialSection.preview.note) + '</p></div>'),
  guides: '<div class="section-head"><div class="kicker">' + esc(C.guideSection.kicker) + '</div><h2 id="guideTitle">' + esc(C.guideSection.title) + '</h2><p class="sub">' + esc(C.guideSection.body) + '</p></div><div class="guide-cards">' + C.guideSection.items.map(item => '<a class="guide-card" href="' + esc(item.file) + '" data-placement="guide"><span class="guide-card-label">쉽게 읽는 채권</span><h3>' + esc(item.label) + '</h3><p>' + esc(item.body) + '</p><span class="guide-card-link">가이드 읽기 <span aria-hidden="true">→</span></span></a>').join('') + '</div>',
  vision: '<div class="section-head"><div class="kicker">' + esc(C.vision.kicker) + '</div><h2>' + esc(C.vision.title) + '</h2></div><div class="roadmap" role="list">' + C.vision.phases.map(phase => '<article class="roadmap-phase ' + esc(phase.key) + '" role="listitem"><div class="roadmap-marker" aria-hidden="true"></div><div class="roadmap-head"><b>' + esc(phase.label) + '</b></div><ul>' + phase.items.map(text => '<li>' + esc(text) + '</li>').join('') + '</ul></article>').join('') + '</div><p class="vision-note">' + esc(C.vision.note) + '</p>',
  notices: C.notices.map(item => '<div class="pane' + (item.strong ? ' strong' : '') + '"><h3>' + esc(item.title) + '</h3><p>' + esc(item.body) + '</p></div>').join(''),
  footer: '<div class="wrap"><div class="lines">' + C.footer.lines.map(esc).join('<br>') + '<span class="copy">' + esc(C.footer.copyright) + '</span></div></div>'
};
const file = path.join(root, 'index.html');
let html = fs.readFileSync(file, 'utf8');
for (const [key, markup] of Object.entries(blocks)) {
  const matcher = new RegExp('<!-- static:' + key + ':start -->[\\s\\S]*?<!-- static:' + key + ':end -->');
  if (!matcher.test(html)) throw new Error('정적 홈 블록 누락: ' + key);
  html = html.replace(matcher, '<!-- static:' + key + ':start -->\n' + markup + '\n<!-- static:' + key + ':end -->');
}
if (process.argv.includes('--check')) {
  if (html !== fs.readFileSync(file, 'utf8')) {
    console.error('content.js와 홈 정적 본문이 다릅니다. node acquisition/render-static-home.cjs 를 실행하세요.');
    process.exitCode = 1;
  } else console.log('홈 정적 본문이 content.js와 일치합니다.');
} else {
  fs.writeFileSync(file, html);
  console.log('홈 정적 본문을 갱신했습니다.');
}
