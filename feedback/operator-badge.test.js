'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, isOperator } = require('./feedback.js');

test('운영자 표시는 정확한 작성자 역할로만 정하고 별명·유사 플래그는 사용하지 않는다', () => {
  assert.equal(isOperator({ nickname: '채다', authorRole: 'operator' }), true);
  for (const item of [null, {}, { nickname: '운영자' }, { nickname: '채다' }, { role: 'operator', isAdmin: true }, { authorRole: 'Operator' }, { authorRole: true }, Object.create({ authorRole: 'operator' })]) {
    assert.equal(isOperator(item), false);
  }
});

test('일반 메시지와 댓글의 운영자 역할 주입을 무시한다', () => {
  const store = createStore([], () => 1);
  const forged = { nickname: '운영자', body: '일반 입력 테스트', authorRole: 'operator', isAdmin: true };
  const message = store.addMessage(forged).message;
  const comment = store.addComment(message.id, forged).comment;
  for (const item of [message, comment]) {
    assert.equal(item.nickname, '운영자');
    assert.equal(item.authorRole, 'visitor');
    assert.equal(isOperator(item), false);
    assert.equal(Object.hasOwn(item, 'isAdmin'), false);
  }
});

test('서버 응답을 대신하는 신뢰된 예시의 메시지·댓글 역할은 보존한다', () => {
  const store = createStore([{ id: 'operator-message', nickname: '채다', body: '운영자 메시지 예시', authorRole: 'operator', comments: [{ id: 'operator-comment', nickname: '채다', body: '운영자 댓글 예시', authorRole: 'operator' }] }]);
  const message = store.list()[0];
  assert.equal(isOperator(message), true);
  assert.equal(isOperator(message.comments[0]), true);
});
