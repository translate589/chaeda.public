'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRemoteStore, clientToken, isOperator, apiBaseForHost, mount } = require('./feedback.js');
const token = 'a'.repeat(64);
const message = (id, createdAt = 100) => ({id,createdAt,body:'메시지',nickname:'익명',authorRole:'visitor',own:true,commentCount:0,comments:[]});
const comment = (id, createdAt = 200) => ({id,createdAt,body:'댓글',nickname:'채다',authorRole:'operator',own:false});
function responses(queue) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({url,options});
    const value = queue.shift();
    assert.ok(value, '예상하지 않은 요청');
    if (value instanceof Error) throw value;
    return { ok: (value.status || 200) < 400, status:value.status || 200, json:async()=>value.data };
  };
  return { calls, fetch };
}
function page(items, totalCount = items.length, nextOffset = null) { return {items,totalCount,hasNext:nextOffset !== null,nextOffset}; }

test('방문자 삭제 권한은 보안 난수로 생성해 브라우저 재방문 때 재사용한다', () => {
  const values = new Map(); let generated = 0;
  const win = {localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},crypto:{getRandomValues:bytes=>{ generated++; bytes.fill(123); }}};
  const first = clientToken(win);
  assert.match(first,/^[a-f0-9]{64}$/);
  assert.equal(clientToken(win),first);
  assert.equal(generated,1);
  values.set('feedback.client-token.v1','invalid');
  assert.equal(clientToken(win),first);
  assert.equal(generated,2);
});

test('브라우저 저장이 차단되면 삭제 권한을 잃을 임시 세션으로 쓰지 않는다', () => {
  assert.throws(()=>clientToken({localStorage:{getItem(){throw Error('blocked');}}}),/로컬 저장소/);
});

test('승인된 운영·로컬 호스트만 각 API에 연결한다', () => {
  assert.equal(apiBaseForHost('chaeda.kr'),'https://api.chaeda.kr/community/feedback');
  assert.equal(apiBaseForHost('www.chaeda.kr'),'https://api.chaeda.kr/community/feedback');
  assert.equal(apiBaseForHost('localhost'),'http://127.0.0.1:8300/feedback');
  assert.equal(apiBaseForHost('preview.example'),'');
  let requested = false;
  mount({document:{getElementById:()=>({})},location:{hostname:'preview.example'},fetch:()=>{requested=true;}});
  assert.equal(requested,false);
});

test('메시지 페이지를 합치고 중복을 없애며 방문자 헤더와 캐시 차단을 사용한다',async()=>{
  const transport=responses([{data:page([message('b',200),message('a',100)],3,2)},{data:page([message('a',100),message('c',50)],3)}]);
  const store=createRemoteStore(transport.fetch,token);
  assert.equal((await store.loadMessages(true)).ok,true);
  assert.equal(store.hasNext(),true);
  await store.loadMessages(false);
  assert.deepEqual(store.list().map(x=>x.id),['b','a','c']);
  assert.equal(store.total(),3); assert.equal(store.hasNext(),false);
  assert.match(transport.calls[1].url,/offset=2$/);
  for(const {options} of transport.calls){assert.equal(options.headers['X-Feedback-Client'],token);assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,undefined);}
});

test('댓글은 별도 페이지로 불러오고 운영자 응답 역할만 보존한다',async()=>{
  const parent={...message('parent'),commentCount:2};
  const transport=responses([{data:page([parent])},{data:page([comment('c1')],2,1)},{data:page([comment('c2',300)],2)}]);
  const store=createRemoteStore(transport.fetch,token); await store.loadMessages(true);
  await store.loadComments('parent',true); await store.loadComments('parent',false);
  const row=store.list()[0];
  assert.deepEqual(row.comments.map(x=>x.id),['c1','c2']);
  assert.equal(row.commentsHasNext,false); assert.equal(row.commentCount,2);
  assert.equal(isOperator(row.comments[0]),true);
  assert.match(transport.calls[2].url,/comments\?limit=20&offset=1$/);
});

test('일반 작성 payload에서 역할과 유사 플래그를 제거하고 성공 후에만 화면 자료를 갱신한다',async()=>{
  const posted=message('posted');
  const transport=responses([{data:{message:posted}},{data:{comment:{...comment('new'),authorRole:'visitor',own:true}}}]);
  const store=createRemoteStore(transport.fetch,token);
  const forged={body:' 안녕하세요 ',nickname:' 운영자 ',authorRole:'operator',isAdmin:true};
  await store.addMessage(forged); await store.addComment('posted',forged);
  for(const {options} of transport.calls) assert.deepEqual(JSON.parse(options.body),{body:'안녕하세요',nickname:'운영자'});
  assert.equal(store.total(),1); assert.equal(store.list()[0].commentCount,1);
  assert.equal(isOperator(store.list()[0]),false);
});

test('연결 실패와 입력 오류는 낙관적 메시지를 추가하거나 기존 데이터를 지우지 않는다',async()=>{
  const transport=responses([{data:page([message('kept')])},new Error('offline'),{status:422,data:{detail:[]}},new Error('offline')]);
  const store=createRemoteStore(transport.fetch,token); await store.loadMessages(true);
  const result=await store.addMessage({body:'초안',nickname:''});
  assert.equal(result.ok,false); assert.match(result.error,/입력은 그대로/);
  assert.equal((await store.addComment('kept',{body:'댓글'})).ok,false);
  assert.equal((await store.loadMessages(true)).ok,false);
  assert.deepEqual(store.list().map(x=>x.id),['kept']); assert.equal(store.total(),1);
  assert.equal(store.list()[0].commentCount,0);
});

test('댓글 있는 메시지는 서버 확인 응답을 따르고 명시적 확인 후에 삭제한다',async()=>{
  const transport=responses([{data:page([message('parent')])},{status:409,data:{detail:{code:'confirmation_required',commentCount:3}}},{data:{ok:true}}]);
  const store=createRemoteStore(transport.fetch,token); await store.loadMessages(true);
  assert.deepEqual(await store.removeMessage('parent',false),{ok:false,reason:'confirmation_required',commentCount:3});
  assert.equal(store.list().length,1);
  await store.removeMessage('parent',true);
  assert.equal(store.list().length,0); assert.equal(store.total(),0);
  assert.match(transport.calls[2].url,/\?confirm=true$/);
});

test('다른 작성자 삭제와 반복 요청 제한 오류를 사용자에게 설명한다',async()=>{
  const transport=responses([{status:403,data:{}},{status:429,data:{}}]);
  const store=createRemoteStore(transport.fetch,token);
  assert.match((await store.removeMessage('other')).error,/작성한 글만/);
  assert.match((await store.addMessage({body:'글'})).error,/잠시 후/);
});

test('HTML 연결 대상은 운영·로컬 API만 허용하고 분석 스크립트를 불러오지 않는다',()=>{
  const html=fs.readFileSync(require.resolve('./index.html'),'utf8');
  assert.match(html,/connect-src https:\/\/api\.chaeda\.kr http:\/\/127\.0\.0\.1:8300 http:\/\/localhost:8300; form-action 'none'/);
  assert.doesNotMatch(html,/<script[^>]+(?:posthog|acquisition)/);
});


test('전체 새로 불러오기는 열어본 댓글 캐시를 무효화하고 운영자가 추가한 댓글을 다시 가져온다',async()=>{
  const before={...message('parent'),commentCount:1};
  const after={...before,commentCount:2};
  const transport=responses([
    {data:page([before])},
    {data:page([comment('old',100)])},
    {data:page([after])},
    {data:page([comment('old',100),comment('operator-new',200)])}
  ]);
  const store=createRemoteStore(transport.fetch,token);
  await store.loadMessages(true); await store.loadComments('parent',true);
  assert.equal(store.list()[0].commentsLoaded,true);
  await store.loadMessages(true);
  const invalidated=store.list()[0];
  assert.equal(invalidated.commentCount,2);
  assert.equal(invalidated.commentsLoaded,false);
  assert.deepEqual(invalidated.comments,[]);
  assert.equal(invalidated.nextCommentOffset,0);
  await store.loadComments('parent',true);
  assert.deepEqual(store.list()[0].comments.map(x=>x.id),['old','operator-new']);
  assert.equal(isOperator(store.list()[0].comments[1]),true);
  assert.match(transport.calls[3].url,/comments\?limit=20&offset=0$/);
});
