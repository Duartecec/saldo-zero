/* Cenas de fundo da home: carrega 4 SVGs, injeta inline em #homeScenes e alterna a cada 4 s com crossfade.
 * API: window.HomeScenes = { start(), stop(), pause(), resume(), show(i) }  (auto-inicia se #homeScenes existir). */
(function () {
  var FILES = ['scene-jato.svg', 'scene-charutos.svg', 'scene-resort.svg', 'scene-fachada.svg'];
  var INTERVAL = 4000;
  var base = (document.currentScript && document.currentScript.src || location.href).replace(/[^\/]*$/, '');
  var root, scenes = [], idx = 0, timer = null, started = false, userPaused = false;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function visible() { return !document.hidden && !userPaused && root && root.getClientRects().length > 0; }

  function show(i) {
    if (!scenes.length) return;
    idx = ((i % scenes.length) + scenes.length) % scenes.length;
    scenes.forEach(function (el, k) { el.classList.toggle('is-active', k === idx); });
  }
  function tick() { if (visible() && !reduced && scenes.length > 1) show(idx + 1); }
  function schedule() {
    clearInterval(timer);
    if (!reduced && !document.hidden && !userPaused) timer = setInterval(tick, INTERVAL);
  }
  function sync() {
    if (!root) return;
    root.classList.toggle('hs-paused', document.hidden || userPaused);
    schedule();
  }

  function load(file, pos) {
    return fetch(base + file).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (txt) {
      var wrap = document.createElement('div');
      wrap.className = 'hs-scene';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = txt;
      var svg = wrap.querySelector('svg');
      if (svg) { svg.removeAttribute('role'); svg.removeAttribute('aria-label'); svg.setAttribute('focusable', 'false'); }
      scenes[pos] = wrap;
      return wrap;
    }).catch(function () { return null; });
  }

  function start(selector) {
    if (started) return;
    root = document.querySelector(selector || '#homeScenes');
    if (!root) return;
    started = true;
    Promise.all(FILES.map(function (f, i) { return load(f, i); })).then(function (els) {
      scenes = els.filter(Boolean);
      scenes.forEach(function (el) { root.appendChild(el); });
      show(0);
      sync();
    });
    document.addEventListener('visibilitychange', sync);
  }

  window.HomeScenes = {
    start: start,
    stop: function () { clearInterval(timer); timer = null; },
    pause: function () { userPaused = true; sync(); },
    resume: function () { userPaused = false; sync(); },
    show: function (i) { show(i); schedule(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { start(); });
  else start();
})();
