/* Patient-side interactivity. No trackers, no cookies, no network calls except same-origin JSON. */
(function () {
  'use strict';
  var d = document, B = d.body.getAttribute('data-base') || './', VER = d.body.getAttribute('data-ver');
  var params = new URLSearchParams(location.search);
  var APP = null;
  function app() { return APP ? Promise.resolve(APP) : fetch(B + 'data/app.json').then(function (r) { return r.json(); }).then(function (j) { APP = j; return j; }); }
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function notice(html, cls) { var n = $('#notice'); if (!n) return; n.innerHTML = html; n.className = 'wrap notice ' + (cls || ''); n.hidden = false; }

  // ---- large text ----
  var lt = $('#lt-btn');
  function setLT(on) { d.documentElement.classList.toggle('lt', on); if (lt) lt.setAttribute('aria-pressed', on ? 'true' : 'false'); try { localStorage.setItem('lt', on ? '1' : '0'); } catch (e) { } }
  if (lt) { setLT(d.documentElement.classList.contains('lt')); lt.addEventListener('click', function () { setLT(!d.documentElement.classList.contains('lt')); }); }

  // ---- language ----
  function langMsg() { app().then(function (a) { notice('🌐 ' + esc(a.ui.langNotAvailable), 'warn'); }); }
  var sel = $('#lang-sel');
  if (sel) sel.addEventListener('change', function () { var v = sel.value; app().then(function (a) { var l = a.langs.filter(function (x) { return x.code === v; })[0]; if (!l || !l.enabled) { langMsg(); sel.value = 'zh-TW'; } }); });
  var qlang = params.get('lang');
  if (qlang && qlang !== 'zh-TW' && qlang !== 'zh') app().then(function (a) { var l = a.langs.filter(function (x) { return x.code === qlang; })[0]; if (!l || !l.enabled) langMsg(); });

  // ---- version notice ----
  var qv = params.get('v');
  if (qv && qv !== VER) app().then(function (a) { notice('ℹ️ ' + esc(a.ui.updated.replace('{v}', 'v' + VER))); });

  // ---- hospital drug code ----
  var code = params.get('code');
  if (code) {
    app().then(function (a) {
      var m = a.codes[code] || a.codes[code.toUpperCase()];
      var main = $('#main');
      if (m && m.status === 'active') {
        var here = location.pathname.replace(/\/index\.html$/, '/');
        var target = new URL(B + m.target + '/', location.href);
        if (target.pathname !== here) { var q = new URLSearchParams(); if (params.get('src')) q.set('src', params.get('src')); location.replace(target.href + (q.toString() ? '?' + q : '')); }
      } else {
        var msg = m && m.status === 'disabled' ? a.ui.retired : a.ui.notFound;
        if (main) main.innerHTML = '<h1>⚠ ' + esc(m ? '衛教資料已停用' : '找不到衛教資料') + '</h1><p class="warnbox">' + esc(msg) + '</p><p class="small">代碼：' + esc(code) + '</p><p><a class="btn" href="' + B + '">← 回首頁搜尋</a></p>';
      }
    }).catch(function () { notice('網路連線不穩，無法讀取代碼對應。請詢問藥師。', 'warn'); });
  }

  // ---- legacy #slug links from the old site ----
  if (d.body.classList.contains('p-home') && location.hash.length > 1 && !code) {
    var h = decodeURIComponent(location.hash.slice(1));
    app().then(function (a) { if (a.slugs.indexOf(h) >= 0) location.replace(B + 'd/' + h + '/'); });
  }

  // ---- glossary tooltips ----
  function closeAll(except) { $$('.gl-btn[aria-expanded="true"]').forEach(function (b) { if (b !== except) { b.setAttribute('aria-expanded', 'false'); var p = d.getElementById(b.getAttribute('aria-controls')); if (p) p.hidden = true; } }); }
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.gl-btn');
    if (b) { var p = d.getElementById(b.getAttribute('aria-controls')); var open = b.getAttribute('aria-expanded') === 'true'; closeAll(b); b.setAttribute('aria-expanded', open ? 'false' : 'true'); if (p) p.hidden = open; return; }
    if (!(e.target.closest && e.target.closest('.gl-pop'))) closeAll();
    var pr = e.target.closest && e.target.closest('[data-print]'); if (pr) { e.preventDefault(); window.print(); }
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeAll(); stopTTS(); } });
  if (params.get('print') === '1') window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });

  // ---- text to speech (Web Speech API) ----
  var synth = window.speechSynthesis, speaking = false;
  function voice() { if (!synth) return null; var vs = synth.getVoices(); return vs.filter(function (v) { return /zh[-_]TW/i.test(v.lang); })[0] || vs.filter(function (v) { return /^zh/i.test(v.lang) && !/HK/i.test(v.lang); })[0] || null; }
  function textOf(el) {
    var c = el.cloneNode(true);
    $$('button.tts-sec,.gl-pop,svg,figure,.callouts,.no-tts,.qrimg,.print-only', c).forEach(function (x) { x.remove(); });
    $$('.st-n', c).forEach(function (x) { x.textContent = '第' + x.textContent + '步，'; });
    return (c.innerText || c.textContent).replace(/\s+/g, ' ').trim();
  }
  function chunks(t) { var out = [], parts = t.split(/(?<=[。！？；])/); var cur = ''; parts.forEach(function (p) { if ((cur + p).length > 180) { if (cur) out.push(cur); cur = p; } else cur += p; }); if (cur) out.push(cur); return out; }
  function stopTTS() { if (synth) synth.cancel(); speaking = false; $$('.reading').forEach(function (x) { x.classList.remove('reading'); }); $$('.tts-stop').forEach(function (b) { b.hidden = true; }); }
  function speak(els) {
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { app().then(function (a) { notice(esc(a.ui.ttsUnavailable), 'warn'); }); return; }
    stopTTS(); speaking = true; $$('.tts-stop').forEach(function (b) { b.hidden = false; });
    var q = []; els.forEach(function (el) { chunks(textOf(el)).forEach(function (c) { q.push([el, c]); }); });
    var v = voice();
    (function next() {
      if (!speaking || !q.length) { stopTTS(); return; }
      var it = q.shift(); $$('.reading').forEach(function (x) { if (x !== it[0]) x.classList.remove('reading'); }); it[0].classList.add('reading');
      var u = new SpeechSynthesisUtterance(it[1]); u.lang = 'zh-TW'; if (v) u.voice = v; u.rate = 0.9;
      u.onend = next; u.onerror = next; synth.speak(u);
    })();
  }
  $$('.tts-all').forEach(function (b) { b.addEventListener('click', function () { var art = $('article') || $('#main'); var parts = $$('.idbox,.role,.warnbox,.sec:not(.meta):not(.qr):not([data-noprint])', art); speak(parts.length ? parts : [art]); }); });
  $$('.tts-stop').forEach(function (b) { b.addEventListener('click', stopTTS); });
  $$('.tts-sec').forEach(function (b) { b.addEventListener('click', function () { var s = d.getElementById(b.getAttribute('data-tts')); if (s) speak([s]); }); });
  if (!synth) $$('.tts-all,.tts-sec').forEach(function (b) { b.setAttribute('aria-disabled', 'true'); b.title = '此裝置不支援朗讀'; });

  // ---- TFDA index (lazy, sharded) ----
  var SHARDS = ['other', 'topical', 'oral'], IDX = null, idxP = null;
  function loadIndex() { if (idxP) return idxP; idxP = Promise.all(SHARDS.map(function (s) { return fetch(B + 'data/index/' + s + '.json').then(function (r) { return r.json(); }); })).then(function (arr) { IDX = []; arr.forEach(function (a) { IDX = IDX.concat(a.rows || a); }); return IDX; }); return idxP; }
  function norm(s) { return String(s || '').toLowerCase().replace(/[\s\-_.,()（）/]+/g, ''); }

  // ---- home search ----
  var q = $('#q');
  if (q) {
    var chip = '', cards = $$('#cards .dcard'), count = $('#q-count'), nores = $('#noresult'), idxOl = $('#idx'), more = $('#idx-more'), hint = $('#idx-hint'), shown = 50, lastHits = [];
    cards.forEach(function (c) { c._s = norm(c.getAttribute('data-s')); });
    function renderIdx(a) {
      idxOl.innerHTML = lastHits.slice(0, shown).map(function (r) {
        var t = a.techTitles[r[5]] || r[5];
        return '<li><a href="' + B + 't/' + r[5] + '/?l=' + encodeURIComponent(r[0]) + '"><b>' + esc(r[1]) + '</b> <span class="en">' + esc(r[2]) + '</span></a><span class="small">' + esc(r[3]) + '｜' + esc(r[4]) + '｜' + esc(r[0]) + '</span><span class="small">→ ' + esc(t) + '</span></li>';
      }).join('');
      more.hidden = lastHits.length <= shown;
    }
    var techLis = $$('.tgroup li[data-s]'), techBox = $('#tech-hits'), ORD = { rectal: 1, vaginal: 2 };
    techLis.forEach(function (li) { li._s = norm(li.getAttribute('data-s')); });
    function techHits(v) {
      if (!techBox) return;
      var hits = v.length < 1 ? [] : techLis.filter(function (li) { return li._s.indexOf(v) >= 0; });
      hits.sort(function (a, b) { return (ORD[a.getAttribute('data-g')] || 0) - (ORD[b.getAttribute('data-g')] || 0); });
      techBox.hidden = !hits.length;
      techBox.innerHTML = hits.length ? '<h2 class="h3">符合的使用方法</h2><ul class="links">' + hits.map(function (li) { var g = li.closest('.tgroup'), h = g && g.querySelector('h3'); var a = li.querySelector('a'); return '<li><a href="' + a.getAttribute('href') + '">' + esc(a.textContent) + '</a>' + (h ? '<span class="small">（' + esc(h.textContent) + '）</span>' : '') + '</li>'; }).join('') + '</ul>' : '';
    }
    function run() {
      var v = norm(q.value), n = 0;
      techHits(v);
      cards.forEach(function (c) { var ok = (!chip || c.getAttribute('data-chip') === chip) && (!v || c._s.indexOf(v) >= 0); c.hidden = !ok; if (ok) n++; });
      app().then(function (a) {
        count.textContent = a.ui.showing.replace('{n}', n).replace('{total}', cards.length);
        if (v.length < 2) { idxOl.innerHTML = ''; more.hidden = true; hint.textContent = a.ui.indexSearchHint; nores.hidden = n > 0 || !v; return; }
        hint.textContent = a.ui.indexLoading;
        loadIndex().then(function (rows) {
          if (norm(q.value) !== v) return;
          var tt = a.techTitles;
          lastHits = rows.filter(function (r) { return norm(r[1] + r[2] + r[3] + r[4] + (tt[r[5]] || '')).indexOf(v) >= 0; });
          shown = 50; renderIdx(a);
          hint.textContent = '索引符合 ' + lastHits.length + ' 項' + (lastHits.length > 50 ? '（先顯示 50 項）' : '');
          nores.hidden = n > 0 || lastHits.length > 0;
        }).catch(function () { hint.textContent = '索引載入失敗，請稍後再試，或詢問藥師。'; });
      });
    }
    var tmr; q.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(run, 180); });
    q.addEventListener('focus', function () { loadIndex(); }, { once: true });
    more.addEventListener('click', function () { shown += 100; app().then(renderIdx); });
    $$('button.chip').forEach(function (b) { b.addEventListener('click', function () { chip = b.getAttribute('data-chip'); $$('button.chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); run(); }); });
    var pq = params.get('q'); if (pq) { q.value = pq; }
    run();
  }

  // ---- technique page opened from an index entry (?l=license) ----
  var lic = params.get('l'), prod = $('#product');
  if (lic && prod) {
    Promise.all([app(), loadIndex()]).then(function (res) {
      var a = res[0], r = res[1].filter(function (x) { return x[0] === lic; })[0];
      if (!r) return;
      prod.innerHTML = '<h2 class="ph">' + esc(r[1]) + '<span class="en">' + esc(r[2]) + '</span></h2><dl><div><dt>' + a.ui.ingredient + '</dt><dd>' + esc(r[3]) + '</dd></div><div><dt>' + a.ui.form + '</dt><dd>' + esc(r[4]) + '</dd></div><div><dt>' + a.ui.license + '</dt><dd>' + esc(r[0]) + '</dd></div></dl><p class="check">✅ ' + esc(a.ui.checkDrug) + '</p><p class="small">' + esc(a.ui.indexOnlyNote) + '</p><p><a class="btn" target="_blank" rel="noopener" href="https://mcp.fda.gov.tw/exportpdf/' + encodeURIComponent(r[0]) + '">' + esc(a.ui.insert) + '</a></p>';
      prod.hidden = false;
    });
  }

  // ---- offline-ish ----
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register(B + 'sw.js').catch(function () { });

  // v1.1 puff counter (localStorage only)
  $$('.counter[data-key]').forEach(function (c) {
    var k = c.getAttribute('data-key'), tot = $('.cnt-total', c), used = $('.cnt-used', c), left = $('.cnt-left', c);
    function get() { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } }
    function put(v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } show(v); }
    function show(v) { var u = v.used || 0, t = v.total || parseInt(tot.getAttribute('data-default') || '0', 10) || 0; used.textContent = u; tot.value = t || ''; if (t) { var r = Math.max(t - u, 0); left.textContent = '，剩 ' + r + ' 下' + (r <= 20 ? '（快用完了，請準備新的一支）' : ''); left.className = 'cnt-left' + (r <= 20 ? ' low' : ''); } else { left.textContent = ''; left.className = 'cnt-left'; } }
    tot.addEventListener('change', function () { var v = get(); var n = parseInt(tot.value, 10); v.total = n > 0 ? n : 0; put(v); });
    $('.cnt-plus', c).addEventListener('click', function () { var v = get(); v.used = (v.used || 0) + 1; put(v); });
    $('.cnt-minus', c).addEventListener('click', function () { var v = get(); v.used = Math.max((v.used || 0) - 1, 0); put(v); });
    $('.cnt-reset', c).addEventListener('click', function () { if (confirm('確定換新的一支、把已用次數歸零？')) { var v = get(); v.used = 0; put(v); } });
    show(get());
  });
})();
