'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function headerAt(origin) {
  const nodes = {
    hdr: { innerHTML: '', classList: { add() {} }, querySelectorAll: () => [] },
    ftr: { innerHTML: '' }
  };
  const document = {
    body: { dataset: { page: 'feedback' }, getAttribute: name => name === 'data-base' ? '../' : null },
    getElementById: id => nodes[id] || null,
    addEventListener() {}
  };
  const window = { location: new URL(origin + '/feedback/') };
  const context = { window, document, URL };
  for (const name of ['content.js', 'app.js']) vm.runInNewContext(fs.readFileSync(require.resolve('./' + name), 'utf8'), context);
  return nodes.hdr.innerHTML;
}

test('운영·로컬 호스트의 사이트 메뉴에서 의견 UI로 진입할 수 있다', () => {
  for (const origin of ['https://chaeda.kr', 'https://www.chaeda.kr', 'http://localhost:18766', 'http://127.0.0.1:18766', 'http://[::1]:18766']) {
    const html = headerAt(origin);
    assert.match(html, /href="\.\.\/feedback\/" aria-current="page"/);
    assert.match(html, /의견 남기기/);
  }
});

test('외부 미리보기·유사 호스트에는 의견 피드 메뉴가 노출되지 않는다', () => {
  for (const origin of ['https://preview.example', 'https://localhost.example', 'https://127.0.0.1.example']) {
    const html = headerAt(origin);
    assert.doesNotMatch(html, /feedback\//);
    assert.match(html, /지원 · 문의/);
  }
  const home = fs.readFileSync(require.resolve('./index.html'), 'utf8');
  const staticHeader = home.match(/<!-- static:header:start -->([\s\S]*?)<!-- static:header:end -->/)[1];
  assert.match(staticHeader, /href="feedback\/"/);
});
