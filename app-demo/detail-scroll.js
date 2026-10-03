(function () {
  'use strict';

  var hint = document.getElementById('detail-scroll-hint');
  var progress = 0;
  var touchY = null;

  function syncHint() {
    hint.dataset.visible = String(location.hash === '#detail' && progress < 180);
  }

  addEventListener('hashchange', function () {
    progress = 0;
    syncHint();
  });
  addEventListener('wheel', function (event) {
    progress += Math.max(0, event.deltaY);
    syncHint();
  }, { passive: true });
  addEventListener('touchstart', function (event) {
    touchY = event.touches.length ? event.touches[0].clientY : null;
  }, { passive: true });
  addEventListener('touchmove', function (event) {
    if (touchY === null || !event.touches.length) return;
    var nextY = event.touches[0].clientY;
    progress += Math.max(0, touchY - nextY);
    touchY = nextY;
    syncHint();
  }, { passive: true });
  syncHint();
}());
