// TIKTOKERS home: the reel, the trends, the studio (face → video → launch), the For You feed and the board.
// Every video on this page is a real AI video made here; when there are none yet, the page says so.
(function () {
  'use strict';
  const C = window.Core, X = window.Cross, L = window.Live;
  const { $, $$, esc } = C;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TRENDS = [['walkin', 'Walk-in'], ['spin', 'Outfit spin'], ['flip', 'Hair flip'], ['dance', 'Dance'], ['react', 'Reaction'], ['zoom', 'Crash zoom'], ['grwm', 'GRWM'], ['vlog', 'Vlog']];
  const CREATORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const HANDLES = ['@capy.grwm', '@goldie.news', '@chef.whiskers', '@dj.ribbit', '@shrimp.spa', '@horse.on.business', '@pod.penguin', '@raccoon.eats', '@gym.hammy', '@goat.fits'];
  const SLOP = n => '/api/slop?n=' + n;
  const TREND_IMG = { walkin: 6, spin: 10, flip: 5, dance: 4, react: 8, zoom: 9, grwm: 1, vlog: 7 };
  const st = { face: null, faceUrl: null, trend: 'walkin', job: null, vid: null, busy: false, born: null, open: null, board: null, sort: 'new', shown: 24, reel: [], handle: '' };
  const status = (el, t, bad) => { el.textContent = t || ''; el.classList.toggle('bad', !!bad); };

  // ---------- the hero reel: real AI videos once the house has filmed them; until then, the creators' photos ----------
  (function reel() {
    const scr = $('#reelScr'), who = $('#reelWho'), cap = $('#reelCap'), bar = $('#reelBar'), box = $('#reel');
    let i = 0, t0 = 0, dur = 6000, timer = null;
    function tickBar() { const p = Math.min(1, (performance.now() - t0) / dur); bar.style.width = (p * 100) + '%'; if (p < 1) requestAnimationFrame(tickBar); }
    function show() {
      const r = st.reel.length ? st.reel[i % st.reel.length] : null;
      const n = r ? r.n : CREATORS[i % CREATORS.length];
      const trend = r ? (TRENDS.find(t => t[0] === r.trend) || TRENDS[0])[1] : TRENDS[i % TRENDS.length][1];
      who.textContent = HANDLES[(n - 1) % HANDLES.length]; cap.textContent = trend.toLowerCase() + ' · AI-generated';
      clearTimeout(timer); t0 = performance.now(); bar.style.width = '0';
      if (r) {
        const v = document.createElement('video'); v.src = r.url; v.muted = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto'; v.className = 'in';
        v.onloadedmetadata = () => { dur = (v.duration || 5) * 1000; t0 = performance.now(); };
        v.onended = () => { i++; show(); };
        v.onerror = () => { timer = setTimeout(() => { i++; show(); }, 1500); };
        scr.replaceChildren(v); v.play().catch(() => {});
        timer = setTimeout(() => { i++; show(); }, 12000);
      } else {
        dur = 6000; const im = new Image(); im.src = SLOP(n); im.alt = ''; im.className = 'in' + (calm ? '' : ' kb');
        scr.replaceChildren(im); timer = setTimeout(() => { i++; show(); }, dur);
      }
      if (!calm) requestAnimationFrame(tickBar);
    }
    box.addEventListener('click', () => { i++; show(); });
    C.get('/api/film?reel=1').then(j => { if (j && j.ok && j.reel && j.reel.length) { st.reel = j.reel; i = 0; } renderTrends(); show(); }).catch(() => show());
  })();

  // ---------- 01 the trends ----------
  function renderTrends() {
    const byTrend = {}; st.reel.forEach(r => { if (!byTrend[r.trend]) byTrend[r.trend] = r; });
    $('#trendGrid').innerHTML = TRENDS.map(([k, label], i) => {
      const r = byTrend[k];
      const media = r ? `<video src="${r.url}" muted playsinline loop preload="metadata"></video>` : `<img src="${SLOP(TREND_IMG[k])}" alt="" loading="lazy">`;
      return `<button type="button" class="tr" data-t="${k}" style="--d:${(i % 4) * .06}s">${media}<em>${r ? '▶ real AI video' : 'trend'}</em><b>${esc(label)}</b></button>`;
    }).join('');
    $$('#trendGrid .tr').forEach(b => {
      const v = b.querySelector('video');
      if (v) { b.addEventListener('mouseenter', () => v.play().catch(() => {})); b.addEventListener('mouseleave', () => v.pause()); }
      b.addEventListener('click', () => { pickTrend(b.dataset.t); document.getElementById('create').scrollIntoView({ behavior: calm ? 'auto' : 'smooth' }); });
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(en => { const v = en.target.querySelector('video'); if (v) { if (en.isIntersecting && !calm) v.play().catch(() => {}); else v.pause(); } }), { threshold: .4 });
      $$('#trendGrid .tr').forEach(b => io.observe(b));
    }
  }

  // ---------- 02 the studio ----------
  const line = $('#line'), faceBtn = $('#faceBtn'), faceStatus = $('#faceStatus'), filmBtn = $('#filmBtn'), filmStatus = $('#filmStatus');
  const pvScr = $('#pvScr'), pvWho = $('#pvWho'), pvCap = $('#pvCap'), kit = $('#kit');
  const nm = $('#nm'), tk = $('#tk'), xh = $('#xh'), goBtn = $('#goBtn'), goStatus = $('#goStatus'), goProg = $('#goProg'), goRes = $('#goRes');
  $('#trendPick').innerHTML = TRENDS.map(([k, l]) => `<button type="button" class="chip${k === st.trend ? ' on' : ''}" data-t="${k}">${esc(l)}</button>`).join('');
  function pickTrend(k) { st.trend = k; $$('#trendPick .chip').forEach(c => c.classList.toggle('on', c.dataset.t === k)); }
  $('#trendPick').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) pickTrend(c.dataset.t); });

  faceBtn.addEventListener('click', async () => {
    const l = line.value.trim();
    if (l.length < 8) return status(faceStatus, 'Describe your TikToker in one line first.', true);
    faceBtn.disabled = true; faceBtn.textContent = 'making…'; status(faceStatus, 'Casting your TikToker. About 20 seconds.');
    pvScr.innerHTML = `<div class="film"><span class="rec"></span>casting<small>a fictional creator, made from your line</small></div>`;
    try {
      const r = await C.post('/api/face', { line: l });
      if (!r.ok) { status(faceStatus, r.error || 'It didn’t come out. Try again.', true); pvScr.innerHTML = '<div class="empty"><span class="gl" data-t="T">T</span><p>your TikToker shows up here</p></div>'; return; }
      st.face = r.face; st.faceUrl = r.url; st.job = null; st.vid = null;
      st.handle = '@' + (r.handle || 'my.tiktoker');
      pvScr.innerHTML = `<img class="in${calm ? '' : ' kb'}" src="${r.url}" alt="">`;
      pvWho.textContent = st.handle; pvCap.textContent = r.niche ? r.niche + ' · AI-generated' : 'AI-generated';
      $('#kHandle').textContent = st.handle; $('#kCap').textContent = '—'; $('#dlFace').href = r.url; $('#dlVid').hidden = true; kit.hidden = false;
      if (!nm.value) { const base = (r.handle || '').split(/[._]/)[0]; if (base) { nm.value = base.charAt(0).toUpperCase() + base.slice(1); syncTicker(); } }
      filmBtn.disabled = false; status(faceStatus, 'Meet your TikToker. Now pick a trend and film it.');
      refreshGo();
    } catch { status(faceStatus, 'It didn’t come out. Try again.', true); }
    finally { faceBtn.disabled = false; faceBtn.textContent = st.face ? 'make another' : 'make my TikToker'; }
  });

  async function pollJob(job, onDone, onFail, label) {
    const t0 = Date.now();
    for (;;) {
      await new Promise(r => setTimeout(r, 4000));
      let j = null; try { j = await C.get('/api/film?job=' + job); } catch {}
      const s = Math.round((Date.now() - t0) / 1000);
      if (label) label(s);
      if (j && j.ok && j.status === 'done') return onDone(j);
      if (j && j.ok && j.status === 'error') return onFail(j.error);
      if (Date.now() - t0 > 6 * 60000) return onFail('It’s taking longer than usual. It keeps filming; check back in a few minutes.');
    }
  }
  filmBtn.addEventListener('click', async () => {
    if (!st.face || st.busy) return;
    filmBtn.disabled = true; filmBtn.textContent = 'filming…'; status(filmStatus, 'Rolling. A 5-second video takes about a minute.');
    pvScr.insertAdjacentHTML('beforeend', `<div class="film" id="filmOv"><span class="rec"></span><span id="filmT">filming</span><small>${esc(TRENDS.find(t => t[0] === st.trend)[1])} · 5 s · vertical</small></div>`);
    try {
      const r = await C.post('/api/film', { face: st.face, trend: st.trend, name: nm.value, symbol: tk.value });
      if (!r.ok) { status(filmStatus, r.error || 'The camera didn’t start. Try again.', true); $('#filmOv') && $('#filmOv').remove(); return; }
      st.job = r.job; if (r.caption) { $('#kCap').textContent = r.caption; pvCap.textContent = r.caption; }
      await pollJob(r.job, j => {
        st.vid = j.url;
        pvScr.innerHTML = `<video class="in" src="${j.url}" muted playsinline autoplay loop></video>`;
        const v = pvScr.querySelector('video'); v.play().catch(() => {});
        if (j.caption) { $('#kCap').textContent = j.caption; pvCap.textContent = j.caption; }
        const dl = $('#dlVid'); dl.href = j.url; dl.hidden = false;
        status(filmStatus, 'Filmed. Download it, or launch the coin and it keeps filming.');
        C.toast('Your TikToker filmed its first video.');
      }, err => { status(filmStatus, err || 'The video didn’t come out. Try again.', true); $('#filmOv') && $('#filmOv').remove(); },
      s => { const el = $('#filmT'); if (el) el.textContent = 'filming · ' + s + 's'; });
    } catch { status(filmStatus, 'The camera didn’t start. Try again.', true); $('#filmOv') && $('#filmOv').remove(); }
    finally { filmBtn.disabled = false; filmBtn.textContent = 'film another'; }
  });

  // copy buttons in the kit
  kit.addEventListener('click', e => { const b = e.target.closest('[data-copyk]'); if (!b) return; const t = $('#' + b.dataset.copyk).textContent; if (t && t !== '—') C.copy(t); });

  // name → ticker
  let tickerTouched = false;
  function syncTicker() { if (!tickerTouched) tk.value = nm.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10); refreshGo(); }
  nm.addEventListener('input', syncTicker);
  tk.addEventListener('input', () => { tickerTouched = !!tk.value; tk.value = tk.value.replace(/[^A-Za-z0-9$]/g, '').toUpperCase(); refreshGo(); });
  const handle = () => xh.value.trim().replace(/^@/, '');
  const clip32 = s => { s = s.trim(); while (new TextEncoder().encode(s).length > 32) s = s.slice(0, -1); return s; };

  // ---------- the split and the launch ----------
  function splitShow() {
    const me = C.S.me || '\u0000you', H = '\u0000house';
    $('#split').innerHTML = X.sharesOf(me, H).map(r => `<div class="${r.address === me ? 'me' : ''}"><dt>${r.address === me ? 'you' : 'the house · pays for the videos'}</dt><dd>${r.bps / 100}%</dd></div>`).join('');
  }
  function refreshGo() {
    if (st.busy) return;
    if (st.open === false) { goBtn.disabled = true; goBtn.textContent = 'Launching opens soon'; return; }
    if (st.born) { goBtn.disabled = true; goBtn.textContent = 'launched ✓'; return; }
    goBtn.disabled = false; goBtn.textContent = C.S.me ? 'launch it' : 'Connect wallet to launch';
  }
  const buy = X.buyBox($('#buyBox'));
  C.onWallet(() => { splitShow(); refreshGo(); });
  async function firstVideo(mint) {
    const box = $('#firstVid'); if (!box) return;
    box.innerHTML = '<p class="status">its TikToker is filming its first video…</p>';
    let r = null; try { r = await C.post('/api/film', { mint }); } catch {}
    if (!r || !r.ok || !r.job) { box.innerHTML = `<p class="status">${esc((r && r.error) || 'Its first video comes with the next cycle.')}</p>`; return; }
    pollJob(r.job, j => { box.innerHTML = `<div class="ph" style="max-width:220px"><video src="${j.url}" muted playsinline autoplay loop></video></div><div class="acts"><a class="btn sm" href="${j.url}" download="${esc(nm.value || 'tiktoker')}.mp4">download</a></div>`; },
      err => { box.innerHTML = `<p class="status">${esc(err || 'Its first video comes with the next cycle.')}</p>`; });
  }
  goBtn.addEventListener('click', async () => {
    if (st.busy || st.born || st.open === false) return;
    if (!C.S.me) { await C.connect(); refreshGo(); return; }
    const name = clip32(nm.value), symbol = tk.value.trim().replace(/^\$/, '').toUpperCase();
    if (!st.face) return status(goStatus, 'Make your TikToker first (step 1).', true);
    if (!name) return status(goStatus, 'Give it a name.', true);
    if (!/^[A-Z0-9]{1,10}$/.test(symbol)) return status(goStatus, 'The ticker is 1–10 letters or numbers.', true);
    if (handle() && !/^[A-Za-z0-9_]{1,15}$/.test(handle())) return status(goStatus, 'That X handle doesn’t look right.', true);
    if (buy.over()) return status(goStatus, 'Up to 5 SOL in the first buy.', true);
    st.busy = true; goBtn.disabled = true; goBtn.textContent = 'launching…'; status(goStatus, ''); goRes.hidden = true;
    try {
      const r = await X.run({ name, symbol, face: st.face, trend: st.trend, x: handle(), devBuy: buy.lamports(), onStep: i => X.steps(goProg, i) });
      X.steps(goProg, 99, true);
      const live = r.settle && r.settle.live; st.born = r.mint;
      goRes.hidden = false;
      goRes.innerHTML = `<p class="ok">$${esc(symbol)} is ${live ? 'live. Its TikToker is filming.' : 'on pump.fun.'}</p>${r.buyNote ? `<p class="status">${esc(r.buyNote)}</p>` : ''}<div id="firstVid"></div><div class="acts"><a class="btn" href="/c/${r.mint}">its page →</a><a class="btn line" href="https://pump.fun/coin/${r.mint}" target="_blank" rel="noopener">pump.fun ↗</a><a class="btn line" href="${C.solscan('tx', r.sig)}" target="_blank" rel="noopener">solscan ↗</a></div>`;
      C.toast('$' + symbol + ' is live.');
      loadBoard(r.mint);
      if (live) firstVideo(r.mint);
    } catch (e) {
      status(goStatus, C.human(e), true);
      if (e && e.mint) { goRes.hidden = false; goRes.innerHTML = `<div class="acts"><a class="btn" href="/c/${e.mint}">finish it on its page →</a></div>`; }
    } finally { st.busy = false; refreshGo(); }
  });

  // ---------- 03 for you + 04 coins ----------
  const seen = new Set();
  function renderFeed() {
    const vs = (st.board && st.board.posts) || [], el = $('#feed');
    if (!vs.length) { el.innerHTML = `<div class="none"><b>no videos yet</b>The first coin’s TikToker films here the minute it launches.</div>`; return; }
    let n = 0;
    el.innerHTML = vs.map(v => { const nw = !seen.has(v.id); seen.add(v.id);
      return `<article class="vc${nw ? ' new' : ''}" style="--i:${nw ? n++ : 0}"><div class="ph"><video src="/api/film?v=${v.id}" muted playsinline loop preload="metadata"></video></div><div class="meta"><a href="/c/${v.mint}">$${esc(v.symbol)}</a><p>${esc(v.caption || '')}</p></div></article>`; }).join('');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(en => { const v = en.target; if (en.isIntersecting && !calm) v.play().catch(() => {}); else v.pause(); }), { threshold: .5 });
      $$('#feed video').forEach(v => io.observe(v));
    }
  }
  function sorted() {
    const ks = ((st.board && st.board.infl) || []).slice();
    if (st.sort === 'heavy') ks.sort((x, y) => (y.mcap_sol || 0) - (x.mcap_sol || 0) || y.slot - x.slot); else ks.sort((x, y) => y.slot - x.slot);
    return ks;
  }
  function renderCoins(hit) {
    const ks = sorted(), el = $('#nursery'), sol = st.board && st.board.solUsd;
    if (!ks.length) { el.innerHTML = `<div class="none"><b>no TikTokers live yet</b>The first one launched is yours.</div>`; $('#moreBtn').hidden = true; return; }
    el.innerHTML = ks.slice(0, st.shown).map(k => {
      const mc = k.mcap_sol != null ? (sol ? C.usd(k.mcap_sol * sol) : k.mcap_sol.toFixed(1) + ' SOL') : '—';
      return `<a class="cn${k.mint === hit ? ' hit' : ''}" data-m="${k.mint}" href="/c/${k.mint}"><img src="/f/${k.mint}" alt="" loading="lazy"><span><b>$${esc(k.symbol)}</b><small>${esc(k.name)} · ${k.state === 'ascended' ? 'graduated' : k.state === 'dead' ? 'quiet' : k.state === 'rot' ? 'slowing down' : 'filming'}</small></span><span class="v m">${k.vids || 0} videos</span><span class="v">${mc}</span></a>`;
    }).join('');
    $('#moreBtn').hidden = ks.length <= st.shown;
  }
  $('#moreBtn').addEventListener('click', () => { st.shown += 24; renderCoins(); });
  $('#sorts').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.sort = b.dataset.s; $$('#sorts button').forEach(x => x.classList.toggle('on', x === b)); renderCoins(); });
  if (L) {
    L.births(false);
    L.on('trade', t => { const c = document.querySelector(`.cn[data-m="${t.mint}"]`); if (!c) return; c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit'); });
  }
  async function loadBoard(hit) {
    let j = null; try { j = await C.get('/api/board'); } catch {}
    if (!j || !j.ok) { if (!st.board) { $('#nursery').innerHTML = `<div class="none"><b>the records didn’t answer</b><button class="btn line sm" type="button" id="retryBoard">try again ↻</button></div>`; const r = $('#retryBoard'); if (r) r.onclick = () => loadBoard(); renderFeed(); } return; }
    st.board = j; if (j.open != null) st.open = j.open; refreshGo(); const hb = $('#hfBadge'); if (hb) hb.hidden = !j.hf;
    renderCoins(hit); renderFeed();
    if (L) L.watch((j.infl || []).slice(0, 200).map(k => k.mint));
  }

  // ---------- reveals and the nav ----------
  (function reveal() {
    if (calm || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; en.target.classList.add('seen'); io.unobserve(en.target); }), { rootMargin: '0px 0px -8% 0px' });
    $$('.sh, .st, .how li, .faq details, .preview, .tr').forEach((el, i) => { el.classList.add('rv'); el.style.setProperty('--d', (i % 4) * .06 + 's'); io.observe(el); });
    const links = $$('.nav a'); const nio = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) links.forEach(a => a.classList.toggle('on', a.hash === '#' + en.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
    ['trends', 'create', 'foryou', 'coins', 'faq'].forEach(id => nio.observe(document.getElementById(id)));
  })();


  // ---------- motion: the creator wall, the phone that follows the pointer, tilting trend cards, a cursor dot ----------
  (function motion() {
    const cards = (start) => { let h = ''; for (let k = 0; k < 10; k++) { const n = ((k + start) % 10) + 1; h += `<div class="wc"><img src="${SLOP(n)}" alt="" loading="lazy"><span>${TRENDS[(k + start) % 8][1]}</span><i style="--dl:-${(k * 0.7).toFixed(1)}s"></i></div>`; } return h + h; };
    $$('.wall .row').forEach((r, i) => { r.querySelector('.rt').innerHTML = cards(i * 3); });
    if (calm || matchMedia('(hover: none)').matches) return;
    const ph = $('.stage .ph.main'), stage = $('.stage');
    stage.addEventListener('mousemove', e => { const b = stage.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5; ph.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`; });
    stage.addEventListener('mouseleave', () => { ph.style.transform = ''; });
    document.addEventListener('mousemove', e => { const t = e.target.closest && e.target.closest('.tr'); $$('.tr').forEach(c => { if (c !== t) c.style.transform = ''; }); if (!t) return; const b = t.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5; t.style.transform = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateY(-4px)`; });
    const dot = document.createElement('div'); dot.className = 'cursor-dot'; document.body.appendChild(dot);
    let mx = innerWidth / 2, my = innerHeight / 2, dx = mx, dy = my;
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; dot.classList.toggle('big', !!(e.target.closest && e.target.closest('a,button,.tr,.ph.main'))); });
    (function loop() { dx += (mx - dx) * .2; dy += (my - dy) * .2; dot.style.transform = `translate(${dx - 5}px, ${dy - 5}px)`; requestAnimationFrame(loop); })();
  })();

  renderTrends(); splitShow(); refreshGo(); loadBoard();
  setInterval(() => { if (!document.hidden && !st.busy) loadBoard(); }, 20000);
  if (L) L.start();
})();
