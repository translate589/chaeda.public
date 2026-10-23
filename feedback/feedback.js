/* 승인된 채다 호스트에서 Community API에 연결하는 공개 의견 피드. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { api.mount(root); }, { once: true });
  else api.mount(root);
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  var BODY_LIMIT = 1000;
  var NAME_LIMIT = 20;

  function isLocalHost(hostname) {
    return ['localhost', '127.0.0.1', '::1', '[::1]'].indexOf(String(hostname || '').toLowerCase()) !== -1;
  }

  function apiBaseForHost(hostname) {
    var host = String(hostname || '').toLowerCase();
    if (isLocalHost(host)) return 'http://127.0.0.1:8300/feedback';
    if (host === 'chaeda.kr' || host === 'www.chaeda.kr') return 'https://api.chaeda.kr/community/feedback';
    return '';
  }

  // 작성자 역할은 별명이나 작성 폼이 아닌 서버 응답에서 정한다. 방문자 입력으로 역할을 부여하지 않는다.
  function isOperator(item) {
    return !!item && Object.prototype.hasOwnProperty.call(item, 'authorRole') && item.authorRole === 'operator';
  }

  function validateInput(input) {
    var body = typeof input.body === 'string' ? input.body.trim() : '';
    var nickname = typeof input.nickname === 'string' ? input.nickname.trim() : '';
    if (!body.replace(/[\s\u200B-\u200D\uFEFF]/g, '')) return { ok: false, error: '메시지를 입력해 주세요.' };
    if (body.length > BODY_LIMIT) return { ok: false, error: '메시지는 1,000자까지 남길 수 있어요.' };
    if (nickname.length > NAME_LIMIT) return { ok: false, error: '별명은 20자까지 입력할 수 있어요.' };
    return { ok: true, body: body, nickname: nickname || '익명' };
  }

  function createStore(examples, clock) {
    var now = typeof clock === 'function' ? clock : Date.now;
    var sequence = 0;
    var messages = examples.map(function (item) { return Object.assign({}, item, { comments: item.comments.map(function (comment) { return Object.assign({}, comment); }) }); });
    function find(id) { return messages.find(function (message) { return message.id === id; }); }
    function copy(message) { return Object.assign({}, message, { comments: message.comments.map(function (comment) { return Object.assign({}, comment); }) }); }
    return {
      list: function () { return messages.map(copy); },
      addMessage: function (input) {
        var valid = validateInput(input);
        if (!valid.ok) return valid;
        var message = { id: 'local-message-' + (++sequence), body: valid.body, nickname: valid.nickname, authorRole: 'visitor', createdAt: now(), own: true, comments: [] };
        messages.unshift(message);
        return { ok: true, message: copy(message) };
      },
      addComment: function (parentId, input) {
        var parent = find(parentId);
        if (!parent) return { ok: false, error: '원래 메시지를 찾을 수 없어요.' };
        var valid = validateInput(input);
        if (!valid.ok) return valid;
        var comment = { id: 'local-comment-' + (++sequence), body: valid.body, nickname: valid.nickname, authorRole: 'visitor', createdAt: now(), own: true };
        parent.comments.push(comment);
        return { ok: true, comment: Object.assign({}, comment) };
      },
      removeMessage: function (id, confirmed) {
        var message = find(id);
        if (!message) return { ok: false, reason: 'not_found' };
        if (!message.own) return { ok: false, reason: 'not_owned' };
        if (message.comments.length && !confirmed) return { ok: false, reason: 'confirmation_required', commentCount: message.comments.length };
        messages = messages.filter(function (item) { return item.id !== id; });
        return { ok: true };
      },
      removeComment: function (parentId, commentId) {
        var parent = find(parentId);
        if (!parent) return { ok: false, reason: 'not_found' };
        var comment = parent.comments.find(function (item) { return item.id === commentId; });
        if (!comment) return { ok: false, reason: 'not_found' };
        if (!comment.own) return { ok: false, reason: 'not_owned' };
        parent.comments = parent.comments.filter(function (item) { return item.id !== commentId; });
        return { ok: true };
      }
    };
  }

  var CLIENT_KEY = 'feedback.client-token.v1';

  function clientToken(win) {
    try {
      var saved = win.localStorage.getItem(CLIENT_KEY);
      if (/^[a-f0-9]{64}$/.test(saved || '')) return saved;
      var bytes = new Uint8Array(32);
      win.crypto.getRandomValues(bytes);
      var token = Array.from(bytes).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
      win.localStorage.setItem(CLIENT_KEY, token);
      if (win.localStorage.getItem(CLIENT_KEY) !== token) throw new Error('storage unavailable');
      return token;
    } catch (error) {
      throw new Error('작성한 글의 삭제 권한을 보관하려면 이 브라우저의 로컬 저장소를 허용해 주세요.');
    }
  }

  function createRemoteStore(fetcher, token, apiBase) {
    apiBase = apiBase || 'http://127.0.0.1:8300/feedback';
    var messages = [];
    var total = 0;
    var nextOffset = 0;
    var following = false;
    function find(id) { return messages.find(function (item) { return item.id === id; }); }
    function copy(item) { return Object.assign({}, item, { comments: (item.comments || []).map(function (comment) { return Object.assign({}, comment); }) }); }
    function merge(items, additions, ascending) {
      var map = new Map();
      items.concat(additions).forEach(function (item) { map.set(item.id, item); });
      return Array.from(map.values()).sort(function (a, b) {
        var order = Number(a.createdAt) - Number(b.createdAt);
        if (!order) order = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        return ascending ? order : -order;
      });
    }
    async function request(path, method, body) {
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 12000) : null;
      try {
        var headers = { 'X-Feedback-Client': token };
        if (body) headers['Content-Type'] = 'application/json';
        var response = await fetcher(apiBase + path, {
          method: method || 'GET', headers: headers, credentials: 'omit', cache: 'no-store',
          body: body ? JSON.stringify({ body: body.body, nickname: body.nickname }) : undefined,
          signal: controller ? controller.signal : undefined
        });
        var data = await response.json().catch(function () { return {}; });
        if (response.ok) return { ok: true, data: data };
        var detail = data.detail;
        if (detail && detail.code === 'confirmation_required') return { ok: false, reason: detail.code, commentCount: detail.commentCount };
        var errors = {
          401: '이 브라우저의 작성 권한을 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.',
          403: '이 브라우저에서 작성한 글만 삭제할 수 있어요.',
          404: '메시지가 삭제되었거나 로컬 의견 피드가 켜져 있지 않아요. 새로 불러와 주세요.',
          413: '입력한 내용이 너무 길어요. 메시지는 1,000자까지 남길 수 있어요.',
          422: '메시지와 별명을 확인해 주세요. 메시지는 1,000자, 별명은 20자까지 입력할 수 있어요.',
          429: '너무 빠르게 여러 번 요청했어요. 잠시 후 다시 시도해 주세요.'
        };
        return { ok: false, error: errors[response.status] || '저장소에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' };
      } catch (error) {
        return { ok: false, error: method && method !== 'GET' ? '저장 결과를 확인하지 못했어요. 새로 불러와 등록 여부를 확인한 뒤 다시 시도해 주세요. 입력은 그대로 남아 있어요.' : '의견 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' };
      } finally { if (timer) clearTimeout(timer); }
    }
    return {
      list: function () { return messages.map(copy); },
      total: function () { return total; },
      hasNext: function () { return following; },
      loadMessages: async function (reset) {
        var result = await request('/messages?limit=10&offset=' + (reset ? 0 : nextOffset));
        if (!result.ok) return result;
        var page = result.data;
        var incoming = page.items.map(function (item) {
          var previous = reset ? null : find(item.id);
          return Object.assign({}, item, { comments: previous ? previous.comments : [], commentsLoaded: previous ? previous.commentsLoaded : false, commentsHasNext: previous ? previous.commentsHasNext : false, nextCommentOffset: previous ? previous.nextCommentOffset : 0 });
        });
        messages = merge(reset ? [] : messages, incoming, false);
        total = page.totalCount; following = page.hasNext; nextOffset = page.nextOffset;
        return { ok: true };
      },
      loadComments: async function (id, reset) {
        var parent = find(id);
        if (!parent) return { ok: false, error: '원래 메시지를 찾을 수 없어요. 새로 불러와 주세요.' };
        var result = await request('/messages/' + encodeURIComponent(id) + '/comments?limit=20&offset=' + (reset ? 0 : parent.nextCommentOffset || 0));
        if (!result.ok) { parent.commentsError = result.error; return result; }
        var page = result.data;
        parent.comments = merge(reset ? [] : parent.comments, page.items, true);
        parent.commentCount = page.totalCount; parent.commentsLoaded = true; parent.commentsHasNext = page.hasNext; parent.nextCommentOffset = page.nextOffset; parent.commentsError = '';
        return { ok: true };
      },
      addMessage: async function (input) {
        var valid = validateInput(input); if (!valid.ok) return valid;
        var result = await request('/messages', 'POST', valid); if (!result.ok) return result;
        var item = Object.assign({}, result.data.message, { comments: [], commentsLoaded: true, commentsHasNext: false, nextCommentOffset: 0 });
        messages = merge(messages, [item], false); total += 1;
        if (following) nextOffset += 1;
        return { ok: true, message: copy(item) };
      },
      addComment: async function (id, input) {
        var valid = validateInput(input); if (!valid.ok) return valid;
        var result = await request('/messages/' + encodeURIComponent(id) + '/comments', 'POST', valid); if (!result.ok) return result;
        var parent = find(id);
        if (parent) { parent.comments = merge(parent.comments, [result.data.comment], true); parent.commentCount += 1; }
        return { ok: true, comment: Object.assign({}, result.data.comment) };
      },
      removeMessage: async function (id, confirmed) {
        var result = await request('/messages/' + encodeURIComponent(id) + (confirmed ? '?confirm=true' : ''), 'DELETE');
        if (!result.ok) return result;
        messages = messages.filter(function (item) { return item.id !== id; }); total = Math.max(0, total - 1);
        if (following) nextOffset = Math.max(0, nextOffset - 1);
        return { ok: true };
      },
      removeComment: async function (id, commentId) {
        var result = await request('/messages/' + encodeURIComponent(id) + '/comments/' + encodeURIComponent(commentId), 'DELETE');
        if (!result.ok) return result;
        var parent = find(id);
        if (parent) {
          var included = parent.comments.some(function (item) { return item.id === commentId; });
          parent.comments = parent.comments.filter(function (item) { return item.id !== commentId; });
          parent.commentCount = Math.max(0, parent.commentCount - 1);
          if (included && parent.commentsHasNext) parent.nextCommentOffset = Math.max(0, parent.nextCommentOffset - 1);
        }
        return { ok: true };
      }
    };
  }

  function mount(win) {
    var doc = win.document;
    var app = doc.getElementById('feedbackApp');
    var apiBase = apiBaseForHost(win.location.hostname);
    if (!app || !apiBase) return;
    doc.body.setAttribute('data-feedback-mode', isLocalHost(win.location.hostname) ? 'local-api' : 'production-api');
    var store;
    try { store = createRemoteStore(win.fetch.bind(win), clientToken(win), apiBase); }
    catch (error) { app.textContent = error.message; return; }
    var loading = false;
    var loaded = false;
    var feedError = '';
    var pendingComments = new Set();
    var deleting = new Set();
    var pendingComposers = new Set();
    var formErrors = new Map();
    var openThreads = new Set();
    var drafts = new Map();
    var formSequence = 0;
    var announcements = doc.getElementById('feedbackAnnouncements');

    function element(tag, className, text) {
      var node = doc.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }
    function icon(name) {
      var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'fb-icon');
      var path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', { reply: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z', arrow: 'M5 12h14m-6-6 6 6-6 6', plus: 'M12 5v14m-7-7h14', down: 'm7 10 5 5 5-5', pen: 'm15 5 4 4M5 19l4-1L20 7a2.1 2.1 0 0 0-3-3L6 15l-1 4z', check: 'm5 12 4 4L19 6' }[name]);
      svg.appendChild(path); return svg;
    }
    function announce(text) { if (announcements) announcements.textContent = text; }
    function fit(textarea) {
      textarea.style.height = 'auto';
      var max = textarea.classList.contains('fb-comment-textarea') ? 220 : 340;
      var min = textarea.classList.contains('fb-comment-textarea') ? 66 : 96;
      textarea.style.height = Math.min(max, Math.max(min, textarea.scrollHeight)) + 'px';
    }
    function fitVisible() { Array.prototype.forEach.call(app.querySelectorAll('textarea'), fit); }
    function focusItem(id) {
      var node = doc.getElementById(id);
      if (node) node.focus({ preventScroll: true });
    }
    function timeLabel(timestamp) {
      var minutes = Math.floor((Date.now() - timestamp) / 60000);
      if (minutes < 1) return '방금';
      if (minutes < 60) return minutes + '분 전';
      if (minutes < 1440) return Math.floor(minutes / 60) + '시간 전';
      return Math.floor(minutes / 1440) + '일 전';
    }
    function avatar(name, own) {
      var tone = Array.from(name).reduce(function (sum, char) { return sum + char.codePointAt(0); }, 0) % 4;
      var node = element('span', 'fb-avatar tone-' + tone + (own ? ' is-own' : ''), Array.from(name)[0]);
      node.setAttribute('aria-hidden', 'true'); return node;
    }
    function operatorBadge() {
      var badge = element('span', 'fb-operator-badge');
      badge.appendChild(icon('check'));
      badge.appendChild(element('span', '', '운영자'));
      return badge;
    }
    function meta(item, isComment, parentId) {
      var row = element('div', 'fb-message-meta');
      var identity = element('span', 'fb-identity');
      if (isOperator(item)) identity.appendChild(operatorBadge());
      identity.appendChild(element('span', 'fb-author', item.nickname));
      row.appendChild(identity);
      var time = element('time', 'fb-time', timeLabel(item.createdAt));
      time.dateTime = new Date(item.createdAt).toISOString();
      time.title = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(item.createdAt);
      row.appendChild(time);
      if (item.own) row.appendChild(element('span', 'fb-own-label', isComment ? '내 댓글' : '내 메시지'));
      if (isComment && item.own) {
        var remove = element('button', 'fb-text-button is-delete', '삭제'); remove.type = 'button';
        remove.setAttribute('aria-label', '내 댓글 삭제');
        remove.addEventListener('click', async function () {
          if (deleting.has(item.id)) return;
          deleting.add(item.id); remove.disabled = true;
          var result = await store.removeComment(parentId, item.id);
          deleting.delete(item.id);
          if (result.ok) { renderFeed(); announce('댓글을 삭제했어요.'); focusItem('thread-toggle-' + parentId); }
          else { remove.disabled = false; announce(result.error); showFeedError(result.error); }
        });
        row.appendChild(remove);
      }
      return row;
    }

    var local = element('div', 'fb-local');
    var notice = element('aside', 'fb-test-notice');
    notice.setAttribute('aria-label', '로컬 테스트 안내');
    notice.appendChild(element('span', 'fb-test-dot'));
    var noticeText = element('div');
    noticeText.appendChild(element('strong', '', '로컬 테스트 · 메시지와 댓글이 저장돼요'));
    noticeText.appendChild(element('p', '', '입력한 내용은 로컬 DB에 저장되어 새로고침해도 유지돼요. 같은 브라우저에서 작성한 글을 삭제할 수 있어요. 브라우저 데이터를 지우면 삭제 권한이 사라집니다.'));
    notice.appendChild(noticeText); local.appendChild(notice);
    var operatorGuide = element('p', 'fb-operator-guide');
    operatorGuide.appendChild(operatorBadge());
    operatorGuide.appendChild(doc.createTextNode(' 뱃지는 운영자가 쓴 메시지와 댓글의 닉네임 왼쪽에 표시돼요. 별명 대신 뱃지로 운영자를 확인해 주세요.'));
    local.appendChild(operatorGuide);

    function composer(options) {
      var key = options.parentId || 'new-message';
      var draft = drafts.get(key) || { body: '', nickname: '' };
      drafts.set(key, draft);
      var formId = 'feedback-form-' + (++formSequence);
      var form = element('form', options.parentId ? 'fb-comment-composer' : 'fb-composer');
      var top = element('div', 'fb-composer-top');
      if (!options.parentId) { var mark = element('span', 'fb-composer-icon'); mark.appendChild(icon('pen')); top.appendChild(mark); }
      top.appendChild(element('span', 'fb-composer-prompt', options.parentId ? '이 이야기에 댓글 남기기' : '어떤 이야기를 나누고 싶으세요?')); form.appendChild(top);
      var bodyLabel = element('label', 'fb-sr-only', options.parentId ? '댓글 내용' : '메시지 내용'); bodyLabel.htmlFor = formId + '-body'; form.appendChild(bodyLabel);
      var textarea = element('textarea', 'fb-textarea' + (options.parentId ? ' fb-comment-textarea' : ''));
      textarea.id = formId + '-body'; textarea.name = 'body'; textarea.maxLength = BODY_LIMIT; textarea.rows = 2; textarea.value = draft.body;
      textarea.placeholder = options.parentId ? '공감한 점이나 다른 생각을 편하게 적어 주세요.' : '불편했던 점이나 떠오른 아이디어를 편하게 남겨 주세요.';
      form.appendChild(textarea);
      var formMeta = element('div', 'fb-form-meta');
      var visibility = element('span', 'fb-visibility', '모든 메시지와 댓글은 공개돼요. 개인정보는 적지 마세요.');
      visibility.id = formId + '-hint'; textarea.setAttribute('aria-describedby', formId + '-hint ' + formId + '-count'); formMeta.appendChild(visibility);
      var counter = element('span', 'fb-counter'); counter.id = formId + '-count'; counter.setAttribute('aria-live', 'off'); formMeta.appendChild(counter); form.appendChild(formMeta);
      var bottom = element('div', 'fb-form-bottom');
      var nicknameWrap = element('div', 'fb-nickname-wrap');
      var nameLabel = element('label', 'fb-nickname-label', '별명 (선택)'); nameLabel.htmlFor = formId + '-nickname'; nicknameWrap.appendChild(nameLabel);
      var nickname = element('input', 'fb-nickname'); nickname.type = 'text'; nickname.id = formId + '-nickname'; nickname.name = 'nickname'; nickname.maxLength = NAME_LIMIT; nickname.placeholder = '비워 두면 익명'; nickname.value = draft.nickname; nickname.autocomplete = 'off'; nicknameWrap.appendChild(nickname); bottom.appendChild(nicknameWrap);
      var submit = element('button', 'fb-submit'); submit.type = 'submit'; submit.appendChild(element('span', '', options.parentId ? '댓글 남기기' : '남기기')); submit.appendChild(icon('arrow')); bottom.appendChild(submit); form.appendChild(bottom);
      var error = element('p', 'fb-form-error', formErrors.get(key) || ''); error.id = formId + '-error'; error.setAttribute('role', 'alert'); form.appendChild(error);
      var submitting = false;
      function update() {
        draft.body = textarea.value; draft.nickname = nickname.value;
        counter.textContent = textarea.value.length.toLocaleString('ko-KR') + ' / 1,000';
        counter.classList.toggle('is-near-limit', textarea.value.length >= 950);
        submit.disabled = submitting || pendingComposers.has(key) || !validateInput(draft).ok;
        textarea.disabled = submitting || pendingComposers.has(key); nickname.disabled = submitting || pendingComposers.has(key);
      }
      textarea.addEventListener('input', function () { error.textContent = ''; formErrors.delete(key); textarea.removeAttribute('aria-invalid'); update(); fit(textarea); });
      nickname.addEventListener('input', function () { error.textContent = ''; formErrors.delete(key); update(); });
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (submitting || pendingComposers.has(key)) return;
        var valid = validateInput({ body: textarea.value, nickname: nickname.value });
        if (!valid.ok) { error.textContent = valid.error; textarea.setAttribute('aria-invalid', 'true'); return; }
        submitting = true; pendingComposers.add(key); update();
        var result = await (options.parentId ? store.addComment(options.parentId, valid) : store.addMessage(valid));
        submitting = false; pendingComposers.delete(key);
        if (!result.ok) { formErrors.set(key, result.error); error.textContent = result.error; update(); if (options.parentId) renderFeed(); return; }
        formErrors.delete(key);
        draft.body = ''; draft.nickname = ''; textarea.value = ''; nickname.value = '';
        if (options.parentId) openThreads.add(options.parentId);
        renderFeed();
        submitting = false; update(); fit(textarea);
        announce(options.parentId ? '댓글을 저장했어요.' : '메시지를 저장했어요.');
        focusItem(options.parentId ? result.comment.id : result.message.id);
      });
      update();
      return form;
    }

    local.appendChild(composer({}));
    var section = element('section', 'fb-feed-section'); section.setAttribute('aria-labelledby', 'feedbackFeedTitle');
    var heading = element('div', 'fb-feed-heading');
    var feedTitle = element('h2', '', '나눈 이야기'); feedTitle.id = 'feedbackFeedTitle';
    var count = element('span'); feedTitle.appendChild(count); heading.appendChild(feedTitle);
    var order = element('span', 'fb-feed-order', '최신 메시지부터'); heading.appendChild(order); section.appendChild(heading);
    section.appendChild(element('p', 'fb-feed-help', '짧은 메시지를 남기고 댓글로 이야기를 이어가요.'));
    var status = element('div', 'fb-feed-status'); status.setAttribute('role', 'status'); section.appendChild(status);
    var refresh = element('button', 'fb-text-button fb-refresh', '새로 불러오기'); refresh.type = 'button';
    refresh.addEventListener('click', function () { loadMessages(true); }); heading.appendChild(refresh);
    var feed = element('ol', 'fb-feed'); section.appendChild(feed);
    var moreWrap = element('div', 'fb-more-wrap'); section.appendChild(moreWrap); local.appendChild(section);
    var foot = element('p', 'fb-footer-note'); foot.appendChild(doc.createTextNode('개인적인 문의는 '));
    var support = element('a', '', '지원 · 문의'); support.href = '../support.html'; foot.appendChild(support); foot.appendChild(doc.createTextNode('를 이용해 주세요.')); local.appendChild(foot);
    app.replaceChildren(local);

    function renderFeed() {
      var messages = store.list();
      var visible = messages;
      count.textContent = store.total().toLocaleString('ko-KR');
      status.replaceChildren();
      refresh.disabled = loading;
      if (feedError) { status.appendChild(element('p', 'fb-form-error', feedError)); var retry = element('button', 'fb-text-button', '다시 시도'); retry.type = 'button'; retry.addEventListener('click', function () { loadMessages(!loaded); }); status.appendChild(retry); }
      else if (loading) status.appendChild(element('p', 'fb-end', '이야기를 불러오고 있어요.'));
      else if (loaded && !messages.length) status.appendChild(element('p', 'fb-empty', '첫 이야기를 남겨 주세요.'));
      feed.replaceChildren();
      visible.forEach(function (message) {
        var item = element('li', 'fb-feed-item');
        var article = element('article', 'fb-message'); article.id = message.id; article.tabIndex = -1; article.setAttribute('aria-label', message.nickname + '님의 메시지');
        article.appendChild(avatar(message.nickname, message.own));
        var main = element('div', 'fb-message-main'); main.appendChild(meta(message, false)); main.appendChild(element('p', 'fb-message-body', message.body));
        var actions = element('div', 'fb-message-actions');
        var toggle = element('button', 'fb-text-button'); toggle.type = 'button'; toggle.id = 'thread-toggle-' + message.id; toggle.appendChild(icon('reply'));
        toggle.appendChild(element('span', '', '댓글 ' + message.commentCount));
        var threadId = 'thread-' + message.id; toggle.setAttribute('aria-controls', threadId); toggle.setAttribute('aria-expanded', String(openThreads.has(message.id))); toggle.setAttribute('aria-label', '댓글 ' + message.commentCount + '개 ' + (openThreads.has(message.id) ? '접기' : '펼치기'));
        actions.appendChild(toggle);
        if (message.own) {
          var remove = element('button', 'fb-text-button is-delete', '삭제'); remove.type = 'button'; remove.setAttribute('aria-label', '내 메시지 삭제');
          var deletePanel = element('div', 'fb-delete-confirm'); deletePanel.hidden = true;
          deletePanel.setAttribute('role', 'group'); deletePanel.setAttribute('aria-label', '메시지 삭제 확인');
          var deleteText = element('p'); deletePanel.appendChild(deleteText);
          var deleteActions = element('div');
          var cancelDelete = element('button', 'fb-delete-cancel', '취소'); cancelDelete.type = 'button';
          var confirmDelete = element('button', 'fb-delete-accept', '댓글과 함께 삭제'); confirmDelete.type = 'button';
          deleteActions.appendChild(cancelDelete); deleteActions.appendChild(confirmDelete); deletePanel.appendChild(deleteActions);
          function finishRemoval(result) {
            if (result.ok) { openThreads.delete(message.id); drafts.delete(message.id); renderFeed(); announce('메시지를 삭제했어요.'); doc.getElementById('feedbackFeedTitle').focus({ preventScroll: true }); }
            else showFeedError(result.error || '메시지를 삭제하지 못했어요.');
          }
          async function removeMessage(confirmed) {
            if (deleting.has(message.id)) return;
            deleting.add(message.id); remove.disabled = true; confirmDelete.disabled = true;
            var result = await store.removeMessage(message.id, confirmed);
            deleting.delete(message.id); remove.disabled = false; confirmDelete.disabled = false;
            if (result.reason === 'confirmation_required') {
              deleteText.textContent = '이 메시지를 지우면 댓글 ' + result.commentCount + '개도 함께 지워져요.';
              deletePanel.hidden = false; cancelDelete.focus({ preventScroll: true }); return;
            }
            finishRemoval(result);
          }
          cancelDelete.addEventListener('click', function () { deletePanel.hidden = true; remove.focus({ preventScroll: true }); });
          confirmDelete.addEventListener('click', function () { removeMessage(true); });
          remove.addEventListener('click', function () { removeMessage(false); });
          actions.appendChild(remove);
        }
        main.appendChild(actions);
        if (message.own) main.appendChild(deletePanel);
        var thread = element('section', 'fb-thread'); thread.id = threadId; thread.hidden = !openThreads.has(message.id); thread.setAttribute('aria-label', message.nickname + '님 메시지의 댓글');
        var comments = element('ol', 'fb-comments');
        message.comments.forEach(function (comment) {
          var row = element('li', 'fb-comment'); row.id = comment.id; row.tabIndex = -1;
          row.appendChild(avatar(comment.nickname, comment.own));
          var commentMain = element('div'); commentMain.appendChild(meta(comment, true, message.id)); commentMain.appendChild(element('p', 'fb-message-body', comment.body)); row.appendChild(commentMain); comments.appendChild(row);
        });
        thread.appendChild(comments);
        if (pendingComments.has(message.id)) thread.appendChild(element('p', 'fb-end', '댓글을 불러오고 있어요.'));
        if (message.commentsError) thread.appendChild(element('p', 'fb-form-error', message.commentsError));
        if (message.commentsHasNext || message.commentsError) {
          var moreComments = element('button', 'fb-text-button', message.commentsError ? '댓글 다시 불러오기' : '댓글 더 보기'); moreComments.type = 'button'; moreComments.disabled = pendingComments.has(message.id);
          moreComments.addEventListener('click', function () { loadComments(message.id, !message.commentsLoaded); }); thread.appendChild(moreComments);
        }
        thread.appendChild(composer({ parentId: message.id }));
        toggle.addEventListener('click', function () {
          var expanded = !openThreads.has(message.id);
          if (expanded) openThreads.add(message.id); else openThreads.delete(message.id);
          thread.hidden = !expanded; toggle.setAttribute('aria-expanded', String(expanded)); toggle.setAttribute('aria-label', '댓글 ' + message.commentCount + '개 ' + (expanded ? '접기' : '펼치기'));
          if (expanded) { if (!message.commentsLoaded) { loadComments(message.id, true, true); return; } fitVisible(); var textarea = thread.querySelector('textarea'); if (textarea) textarea.focus({ preventScroll: true }); }
        });
        main.appendChild(thread); article.appendChild(main); item.appendChild(article); feed.appendChild(item);
      });
      moreWrap.replaceChildren();
      if (store.hasNext()) {
        var more = element('button', 'fb-more'); more.type = 'button'; more.disabled = loading; more.appendChild(element('span', '', loading ? '불러오는 중' : '더 보기')); more.appendChild(icon('down'));
        more.addEventListener('click', function () { loadMessages(false); });
        moreWrap.appendChild(more);
      } else if (loaded && !feedError) moreWrap.appendChild(element('p', 'fb-end', '여기까지 이야기를 모두 읽었어요.'));
      fitVisible();
    }
    function showFeedError(text) { feedError = text; renderFeed(); announce(text); }
    async function loadMessages(reset) {
      if (loading) return;
      loading = true; feedError = ''; renderFeed();
      var result = await store.loadMessages(reset);
      if (result.ok) {
        loaded = true; feedError = '';
        if (reset) {
          await Promise.all(store.list().filter(function (message) { return openThreads.has(message.id); }).map(function (message) { return loadComments(message.id, true); }));
        }
      } else feedError = result.error;
      loading = false;
      renderFeed();
    }
    async function loadComments(parentId, reset, focusReply) {
      if (pendingComments.has(parentId)) return;
      pendingComments.add(parentId); renderFeed();
      var result = await store.loadComments(parentId, reset);
      pendingComments.delete(parentId); renderFeed();
      if (!result.ok) announce(result.error);
      if (focusReply && openThreads.has(parentId)) { var thread = doc.getElementById('thread-' + parentId); var reply = thread && thread.querySelector('textarea'); if (reply) reply.focus({ preventScroll: true }); }
    }
    feedTitle.tabIndex = -1;
    loadMessages(true);
  }

  return { isLocalHost: isLocalHost, apiBaseForHost: apiBaseForHost, isOperator: isOperator, validateInput: validateInput, createStore: createStore, clientToken: clientToken, createRemoteStore: createRemoteStore, mount: mount };
});
