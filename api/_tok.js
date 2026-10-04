// TIKTOKERS: every coin launched here gets an AI TikToker, a fictional creator made from one line, who films its videos.
// This file: the birth (once the chain shows its split locked), the cycle's reading of every coin from the chain, the
// TikToker's face, the trends it can film, captions, and the video jobs.
const L = require('./_lib');
const DAY = 864e5;
async function routingOf(mint) {
  if (L.MOCK && L.MOCK.routing) return L.MOCK.routing(mint);
  return require('./_pump').routing(mint, L.accounts);
}
const sameShares = (got, want) => got.length === want.length && want.every((w, i) => got[i].address === w.address && got[i].bps === w.bps);
async function settle(mint) {
  const k = (await L.q('SELECT mint, symbol, status, slot, shares FROM t0_coins WHERE mint=$1', [mint]))[0];
  if (!k) return { ok: false, error: 'No coin was recorded for that token.' };
  if (k.status === 'live') return { ok: true, live: true, slot: k.slot };
  if (k.status === 'void') return { ok: true, live: false, void: true };
  const r = await routingOf(mint);
  if (!r.exists) return { ok: true, live: false, waiting: 'coin' };
  const shares = typeof k.shares === 'string' ? JSON.parse(k.shares) : k.shares;
  if (!(r.routed && r.revoked && sameShares(r.shareholders, shares))) return { ok: true, live: false, waiting: 'split', mint };
  for (let i = 0; i < 4; i++) {
    try {
      const u = await L.q(`UPDATE t0_coins SET status='live', slot=(SELECT coalesce(max(slot),-1)+1 FROM t0_coins WHERE status='live'), born_at=now(), state=$4,
        last_trade_at=now(), mcap_sol=$2, complete=$3 WHERE mint=$1 AND status<>'live' RETURNING slot`, [mint, r.mcapSol, !!r.complete, r.complete ? 'ascended' : 'awake']);
      if (u.length) await L.log('born', mint, `$${k.symbol} got its TikToker`);
      const s = (await L.q('SELECT slot FROM t0_coins WHERE mint=$1', [mint]))[0];
      return { ok: true, live: true, slot: s && s.slot };
    } catch (e) { if (!/unique|duplicate/i.test(String(e && e.message))) throw e; }
  }
  return { ok: true, live: false, waiting: 'slot' };
}
async function lastTrade(mint) {
  if (L.MOCK && L.MOCK.lastTrade) return L.MOCK.lastTrade(mint);
  const r = await L.rpc('getSignaturesForAddress', [L.bondingCurveOf(mint), { limit: 1, commitment: 'confirmed' }]).catch(() => null);
  return r && r[0] && r[0].blockTime ? new Date(r[0].blockTime * 1000) : null;
}
const stateFor = (k, now) => k.complete ? 'ascended' : !k.last_trade_at ? 'awake' : now - new Date(k.last_trade_at) >= 7 * DAY ? 'dead' : now - new Date(k.last_trade_at) >= DAY ? 'rot' : 'awake';
async function readBoard() {
  const ks = await L.q(`SELECT mint, symbol, state, mcap_sol, complete, last_trade_at FROM t0_coins WHERE status='live' ORDER BY slot`);
  const vaults = ks.length ? await L.accounts(ks.map(k => L.vaultOf(k.mint))).catch(() => ks.map(() => null)) : [];
  const curves = ks.length ? await L.accounts(ks.map(k => L.bondingCurveOf(k.mint))).catch(() => ks.map(() => null)) : [];
  const now = Date.now(); let changes = 0;
  await L.pool(ks, 6, async (k, i) => {
    let mcap = k.mcap_sol, complete = k.complete;
    if (L.MOCK && L.MOCK.routing) { const r = await L.MOCK.routing(k.mint); mcap = r.mcapSol; complete = !!r.complete; }
    else if (curves[i]) { try { const { PUMP_SDK } = require('@pump-fun/pump-sdk'); const bc = PUMP_SDK.decodeBondingCurve(curves[i]); const vq = bc.virtualSolReserves || bc.virtualQuoteReserves, vt = bc.virtualTokenReserves; complete = !!bc.complete; if (vt && !vt.isZero()) mcap = Number(vq.mul(bc.tokenTotalSupply).div(vt).toString()) / 1e9; } catch {} }
    const vl = vaults[i] ? Math.max(0, vaults[i].lamports - L.RENT0) : 0;
    const t = complete ? null : await lastTrade(k.mint);
    const last = t && (!k.last_trade_at || t > new Date(k.last_trade_at)) ? t : k.last_trade_at;
    const st = stateFor({ ...k, complete, last_trade_at: last }, now);
    if (st !== k.state) { changes++; await L.log(st, k.mint, `$${k.symbol} ${st === 'rot' ? 'is slowing down' : st === 'dead' ? 'went quiet' : st === 'ascended' ? 'graduated: its curve is complete' : 'is back to filming'}`); }
    await L.q(`UPDATE t0_coins SET mcap_sol=$2, complete=$3, last_trade_at=$4, state=$5, vault_lamports=$6 WHERE mint=$1`, [k.mint, mcap, complete, last, st, vl]);
  });
  return { coins: ks.length, changes };
}



// ---------- the trends a TikToker can film (image-to-video motion prompts) ----------
const TRENDS = {
  walkin: { label: 'Walk-in', motion: 'The person walks confidently toward the camera while the handheld phone camera follows, hair and clothes moving naturally, keeping eye contact.' },
  spin: { label: 'Outfit spin', motion: 'The person does one slow full spin to show off the outfit, then stops and smiles at the camera.' },
  flip: { label: 'Hair flip', motion: 'The person flips their hair to one side and gives the camera a playful smirk.' },
  dance: { label: 'Dance', motion: 'The person does a short simple dance: a shoulder bounce, a step to each side and a little hand wave, smiling at the camera.' },
  react: { label: 'Reaction', motion: 'The person looks into the camera, gasps with a hand over their mouth, then bursts out laughing.' },
  zoom: { label: 'Crash zoom', motion: 'The camera does a fast crash zoom into the person\'s face as they raise one eyebrow and smirk.' },
  grwm: { label: 'GRWM', motion: 'The person fixes their hair and looks into the camera like a mirror, then gives a confident nod.' },
  vlog: { label: 'Vlog', motion: 'The person talks to the camera with lively hand gestures, the selfie camera moving gently as if handheld.' },
};
const TREND_KEYS = Object.keys(TRENDS);
const trendOf = t => TRENDS[t] ? t : 'walkin';
const videoPrompt = t => `${TRENDS[trendOf(t)].motion} The same person with the same face, hair and outfit as in the image. Photorealistic vertical phone video, natural light and motion, no text, no captions, no logos.`;
const RULES = 'Rules: no financial advice, no price predictions, no promises of gains, never tell anyone to buy or sell, never say "100x", "moon" or "guaranteed", no real people, nothing sexual, no links.';

// one line → a fictional adult creator's look, screened: never a real person, never a minor, nothing sexual
async function lookOf(line) {
  const r = await L.ai([
    { role: 'system', content: 'You turn a one-line idea for an AI TikTok creator into a photo description for an image model. The creator can be an animal, a creature, an object with a face or a person; viral AI-slop energy is welcome. A person is always a fictional adult aged 21 to 45. Never a real, famous or named person, never a known cartoon, game or movie character, never a child or teen, never sexual, nude or revealing, no brands or logos. If the idea asks for a real or famous person, a known character, a minor, or sexual content, refuse. Reply with JSON only: {"ok":true,"look":"under 60 words: who or what it is, look, outfit, setting and vibe","niche":"what they post, 2 to 4 words","handle":"a short lowercase TikTok handle idea, letters, digits, dots or underscores, no @"} or {"ok":false,"why":"one short sentence"}.' },
    { role: 'user', content: L.clean(line, 300) }], 220, 20000);
  if (!r.ok) return { ok: false, error: 'The idea didn’t go through. Try again.' };
  const j = L.parseJson(r.text) || {};
  if (j.ok !== true || !j.look) return { ok: false, error: L.clean(j.why, 160) || 'That one can’t be made here: no real people, known characters or minors.' };
  return { ok: true, look: L.clean(j.look, 420), niche: L.clean(j.niche, 40), handle: String(j.handle || '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24) };
}
const facePrompt = look => `Photorealistic vertical phone photo of a fictional TikTok creator: ${look}. Facing the camera as if filming itself, soft ring light glow, viral AI TikTok energy, sharp detail, candid, subject centered with room above the head, no text, no letters, no logos, no watermark.`;
async function vertical(buf) {
  return require('sharp')(buf, { limitInputPixels: 60e6 }).resize(720, 1280, { fit: 'cover', position: 'attention' }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}
async function square(buf) {
  const s = require('sharp'); const v = await s(buf).resize(720, 1280, { fit: 'cover', position: 'attention' }).toBuffer();
  return s(v).extract({ left: 0, top: 90, width: 720, height: 720 }).resize(768, 768).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}
async function makeFace(line) {
  const l = await lookOf(line); if (!l.ok) return l;
  if (!(await L.spendShot())) return { ok: false, error: 'Today’s photo budget is spent. It resets at 00:00 UTC.' };
  const ph = await L.photo(facePrompt(l.look), null, 55000, '768x1344');
  if (!ph.ok) return { ok: false, error: 'The photo didn’t come out. Try again in a minute.', why: ph.error };
  return { ok: true, img: await vertical(ph.buf), look: l.look, niche: l.niche, handle: l.handle };
}
// a caption for a video, in the creator's voice, with the cashtag once when there is one
async function caption(k, trend) {
  const tag = k.symbol ? ` Include $${k.symbol} once.` : '';
  const r = await L.ai([{ role: 'system', content: `You are ${k.name || 'an AI TikTok creator'}, a fictional AI TikTok creator. Who you are: ${L.clean(k.voice || k.look, 400)}. ${RULES}` },
    { role: 'user', content: `Write the TikTok caption for your new "${TRENDS[trendOf(trend)].label}" video. One line under 110 characters, casual TikTok voice, then three hashtags including #aigenerated.${tag} Plain text only.` }], 90, 15000).catch(() => null);
  const t = r && r.ok ? L.scrub(String(r.text || '').replace(/^"|"$/g, ''), 170) : '';
  return t && !L.BANNED.test(t) ? t : `${TRENDS[trendOf(trend)].label.toLowerCase()} check ✓ #aigenerated #fyp #ai${k.symbol ? ' $' + k.symbol : ''}`;
}
// start one video: from a portrait (JPEG buffer), in a trend. Kept as a row the page and the cycle both poll.
async function film({ jpeg, trend, kind, mint = null, face = null, k = {}, imageUrl = null }) {
  if (!(await L.spendVid())) return { ok: false, error: 'Today’s video budget is spent. It resets at 00:00 UTC.' };
  const t = trendOf(trend);
  let s = L.HF && imageUrl ? await L.hfStart(videoPrompt(t), imageUrl) : { ok: false };
  if (!s.ok) s = await L.videoStart(videoPrompt(t), jpeg.toString('base64'), { resolution: '720x1280' });
  if (!s.ok && /resolution/i.test(s.error || '')) s = await L.videoStart(videoPrompt(t), jpeg.toString('base64'));
  if (!s.ok) return { ok: false, error: /minimum balance|balance|credit/i.test(s.error || '') ? 'Filming opens soon: the house’s video credits aren’t loaded yet. Your TikToker’s photo works now.' : 'The camera didn’t start. Try again in a minute.', why: s.error, paused: /balance|credit/i.test(s.error || '') };
  const cap = await caption(k, t);
  const r = await L.q(`INSERT INTO t0_vids (mint, face, kind, trend, caption, model, op) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [mint, face, kind, t, cap, s.model, JSON.stringify(s.operation)]);
  return { ok: true, job: r[0].id, trend: t, caption: cap };
}
// ask the gateway how a job is doing; when it's done, keep the MP4
async function poll(v) {
  if (v.status !== 'pending') return v;
  if (v.polled_at && Date.now() - new Date(v.polled_at) < 3000) return v;
  await L.q(`UPDATE t0_vids SET polled_at=now() WHERE id=$1`, [v.id]);
  const op = typeof v.op === 'string' ? JSON.parse(v.op) : v.op;
  const st = String(v.model || '').startsWith('higgsfield/') ? await L.hfStatus(op && op.hf) : await L.videoStatus(v.model, op);
  if (!st.ok) { if (Date.now() - new Date(v.at) > 15 * 60000) { await L.q(`UPDATE t0_vids SET status='error', err=$2 WHERE id=$1`, [v.id, st.error]); return { ...v, status: 'error', err: st.error }; } return v; }
  if (st.status === 'pending') { if (Date.now() - new Date(v.at) > 20 * 60000) { await L.q(`UPDATE t0_vids SET status='error', err='timed out' WHERE id=$1`, [v.id]); return { ...v, status: 'error' }; } return v; }
  if (st.status === 'error') { await L.q(`UPDATE t0_vids SET status='error', err=$2 WHERE id=$1`, [v.id, st.error]); return { ...v, status: 'error', err: st.error }; }
  const buf = await L.videoBytes(st.video).catch(() => null);
  if (!buf || buf.length < 1000) { await L.q(`UPDATE t0_vids SET status='error', err='empty video' WHERE id=$1`, [v.id]); return { ...v, status: 'error' }; }
  const u = await L.q(`UPDATE t0_vids SET status='done', mp4=$2, done_at=now(), op=NULL WHERE id=$1 AND status='pending' RETURNING id`, [v.id, buf]);
  if (u.length && v.mint) { await L.q(`UPDATE t0_coins SET vids = vids + 1 WHERE mint=$1`, [v.mint]); await L.log('video', v.mint, `a new ${TRENDS[trendOf(v.trend)].label.toLowerCase()} video`); }
  return { ...v, status: 'done' };
}
// a launched coin's next video: the next trend in turn, from its portrait
async function shift(k, site) {
  const t = TREND_KEYS[(Number(k.vids) || 0) % TREND_KEYS.length];
  if (!k.face) return { ok: false, error: 'no portrait' };
  await L.q(`UPDATE t0_coins SET vid_at=now() WHERE mint=$1`, [k.mint]);
  return film({ jpeg: Buffer.from(k.face), trend: k.niche && TRENDS[k.niche] && !k.vids ? k.niche : t, kind: 'shift', mint: k.mint, k, imageUrl: site ? site + '/f/' + k.mint : null });
}
module.exports = { settle, routingOf, readBoard, TRENDS, TREND_KEYS, trendOf, lookOf, makeFace, vertical, square, caption, film, poll, shift };
