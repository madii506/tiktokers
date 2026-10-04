// TIKTOKERS: one coin's page. Its TikToker (the portrait and its latest video), its videos (download, copy the caption),
// its numbers (read by the cycle from the chain), the split locked into it. A token that landed on pump.fun without its
// split can be finished here by whoever launched it.
(function () {
  'use strict';
  const C = window.Core, X = window.Cross, L = window.Live, $ = C.$, esc = C.esc;
  const mint = (location.pathname.match(/\/c\/([1-9A-HJ-NP-Za-km-z]{32,44})/) || [])[1] || new URLSearchParams(location.search).get('mint');
  const STATE = { awake: 'filming', rot: 'slowing down', dead: 'off camera', ascended: 'graduated' };
  const TR = { walkin: 'Walk-in', spin: 'Outfit spin', flip: 'Hair flip', dance: 'Dance', react: 'Reaction', zoom: 'Crash zoom', grwm: 'GRWM', vlog: 'Vlog' };
  const when = t => t ? C.ago(new Date(t).getTime()) : '—';
  let data = null, solUsd = null;
  function lost(text) { $('#cw').innerHTML = `<div class="none"><b>${esc(text)}</b><a class="btn" href="/">back to TIKTOKERS</a></div>`; }
  async function load() {
    if (!mint) return lost('No coin lives at that address.');
    let j; try { j = await C.get('/api/kid?mint=' + mint); } catch { j = { ok: false, error: 'TIKTOKERS didn’t answer. Try again.' }; }
    if (!j.ok) return lost(j.missing ? 'No coin lives at that address.' : j.error);
    data = j; render();
  }
  function render() {
    const k = data.infl, pending = k.status === 'pending';
    document.title = '$' + k.symbol + ' · TIKTOKERS';
    $('#cName').textContent = k.name; $('#cTick').textContent = '$' + k.symbol;
    $('#cState').textContent = (pending ? ['not launched yet'] : [STATE[k.state] || k.state, (k.vids || 0) + ' video' + (k.vids === 1 ? '' : 's'), 'live ' + when(k.born_at)]).join(' · ');
    $('#bio').textContent = k.voice;
    const vs = (data.posts || []).filter(v => v.status === 'done');
    const scr = $('#pvScr');
    if (vs.length) { if (!scr.querySelector('video')) scr.innerHTML = `<video src="/api/film?v=${vs[0].id}" muted playsinline autoplay loop></video>`; $('#pvCap').textContent = vs[0].caption || ''; }
    else if (!scr.querySelector('img')) scr.innerHTML = `<img src="/f/${mint}" alt="">`;
    $('#pvWho').textContent = '@' + k.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
    const acts = [];
    if (!pending) acts.push(`<a class="btn" href="https://pump.fun/coin/${mint}" target="_blank" rel="noopener">buy on pump.fun ↗</a>`, `<button class="btn line" type="button" id="feedBtn">pay out its fees</button>`);
    else acts.push(`<button class="btn" type="button" id="finishBtn">finish it: lock its split</button>`);
    if (k.xhandle) acts.push(`<a class="btn line" href="https://x.com/${esc(k.xhandle)}" target="_blank" rel="noopener">@${esc(k.xhandle)} ↗</a>`);
    acts.push(`<button class="btn line" type="button" data-copy="${mint}">copy CA</button>`);
    $('#cActs').innerHTML = acts.join('');
    if ($('#feedBtn')) $('#feedBtn').onclick = feed;
    if ($('#finishBtn')) $('#finishBtn').onclick = finish;
    const all = data.posts || [];
    $('#vids').innerHTML = all.length ? all.map(v => v.status === 'done'
      ? `<article class="vc"><div class="ph"><video src="/api/film?v=${v.id}" muted playsinline loop preload="metadata"></video></div><div class="meta"><a href="/api/film?v=${v.id}" download="${esc(k.symbol)}-${v.id}.mp4">${esc(TR[v.trend] || v.trend)} ↓</a><p>${esc(v.caption || '')}</p><div class="acts"><button type="button" class="mini" data-copy="${esc(v.caption || '')}">copy caption</button></div></div></article>`
      : `<article class="vc"><div class="ph"><div class="film"><span class="rec"></span>filming<small>${esc(TR[v.trend] || v.trend)}</small></div></div><div class="meta"><p>${esc(when(v.at))}</p></div></article>`).join('')
      : `<div class="none"><b>${pending ? 'not launched yet' : 'its first video is on the way'}</b>${pending ? 'Its TikToker starts filming once the coin is launched.' : 'It films a new trend every six hours while the coin trades.'}</div>`;
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => es.forEach(en => { const v = en.target; if (en.isIntersecting) v.play().catch(() => {}); else v.pause(); }), { threshold: .5 }); document.querySelectorAll('#vids video').forEach(v => io.observe(v)); }
    $('#log').innerHTML = (data.log || []).length ? data.log.map(e => `<li>${esc(when(e.at))} · ${esc(e.text)}</li>`).join('') : '<li>Nothing yet.</li>';
    const cap = k.mcap_sol != null ? (solUsd ? C.usd(k.mcap_sol * solUsd) : (+k.mcap_sol).toFixed(1) + ' SOL') : '—';
    $('#nums').innerHTML = [['market cap', pending ? '—' : cap], ['videos', String(k.vids || 0)], ['last trade', pending ? '—' : when(k.last_trade_at)]].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    const shares = typeof k.shares === 'string' ? JSON.parse(k.shares) : (k.shares || []);
    $('#split').innerHTML = shares.map(s => `<div><dt>${s.address === data.studio ? 'the house · pays for the videos' : s.address === k.payer ? 'its creator' : 'a share'}</dt><dd>${s.bps / 100}%</dd></div>`).join('');
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (!b) return; C.copy(b.dataset.copy); });
  async function feed() {
    const b = $('#feedBtn'); b.disabled = true; $('#cStatus').textContent = '';
    try { const r = await X.feed(mint); if (r) { C.toast('Paid out to every share.'); $('#cStatus').innerHTML = `<a href="${C.solscan('tx', r.sig)}" target="_blank" rel="noopener">the payout on solscan ↗</a>`; } }
    catch (e) { $('#cStatus').textContent = C.human(e); }
    finally { b.disabled = false; }
  }
  async function finish() {
    const b = $('#finishBtn'); $('#cStatus').textContent = '';
    if (!C.S.me) { const ok = await C.connect(); if (!ok) return; }
    if (C.S.me !== data.infl.payer) { $('#cStatus').textContent = 'Only the wallet that launched it can finish it.'; return; }
    b.disabled = true;
    try { const s = await C.post('/api/settle', { mint }); if (!(s && s.live)) await X.route(mint); C.toast('It’s live.'); await load(); }
    catch (e) { $('#cStatus').textContent = C.human(e); }
    finally { if ($('#finishBtn')) $('#finishBtn').disabled = false; }
  }

  C.get('/api/board').then(j => { if (j && j.solUsd) { solUsd = j.solUsd; if (data) render(); } }).catch(() => {});
  load(); setInterval(() => { if (!document.hidden) load(); }, 15000);
  if (L) { L.births(false); if (mint) L.watch([mint]); L.start(); }
})();
