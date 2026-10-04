// POST /api/meta {mint, payer, name, symbol, face, trend, x}  before a launch: record the coin: its TikToker (the portrait
//   made by /api/face, the reference for every video), name, ticker, first trend, optional X handle, and its split
//   (written now, locked on-chain at birth).
// GET  /m/<id>    (→ /api/meta?id=)    the metadata JSON the token's on-chain uri points at.
// GET  /i/<mint>  (→ /api/meta?img=)   its picture.
const L = require('./_lib');
const T = require('./_tok');
const bytes = s => Buffer.byteLength(s, 'utf8');
function metaJson(k, site) {
  const page = site + '/c/' + k.mint;
  return {
    name: k.name, symbol: k.symbol,
    description: `A coin with its own AI TikToker. Watch its videos: ${page.replace(/^https?:\/\//, '')}`,
    image: site + '/i/' + k.mint, external_url: page, showName: true,
    website: page, twitter: k.xhandle ? 'https://x.com/' + k.xhandle : undefined, extensions: { website: page }, createdOn: site,
    tiktokers: { v: 1, mint: k.mint, shares: k.shares },
  };
}
function img(res, buf, type, live) {
  res.statusCode = 200; res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', live ? 'public, max-age=86400, s-maxage=31536000, immutable' : 'public, max-age=30');
  return res.end(Buffer.from(buf));
}
async function get(req, res) {
  const qy = L.query(req);
  if (!L.dbReady()) return L.send(res, 404, { error: 'not found' });
  await L.ready();
  if (qy.img) {
    const mint = String(qy.img).replace(/\.\w+$/, '');
    const r = L.isAddr(mint) ? await L.q('SELECT img, status FROM t0_coins WHERE mint=$1 AND img IS NOT NULL', [mint]).catch(() => []) : [];
    if (!r.length) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=30'); return res.end(); }
    return img(res, r[0].img, 'image/jpeg', r[0].status === 'live');
  }
  if (qy.face) {
    const mint = String(qy.face).replace(/\.\w+$/, '');
    const r = L.isAddr(mint) ? await L.q('SELECT face, status FROM t0_coins WHERE mint=$1 AND face IS NOT NULL', [mint]).catch(() => []) : [];
    if (!r.length) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=30'); return res.end(); }
    return img(res, r[0].face, 'image/jpeg', r[0].status === 'live');
  }
  const id = String(qy.id || '').replace(/\.json$/, '');
  if (!/^[1-9A-HJ-NP-Za-km-z]{8,44}$/.test(id)) return L.send(res, 404, { error: 'not found' });
  const r = await L.q('SELECT mint, name, symbol, niche, xhandle, shares FROM t0_coins WHERE id=$1', [id]).catch(() => []);
  if (!r.length) return L.send(res, 404, { error: 'not found' }, 'public, max-age=30');
  L.send(res, 200, metaJson(r[0], L.origin(req)), 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
}
async function post(req, res) {
  L.setOidc(req);
  if (L.limited('meta:' + L.ip(req), 20, 600000)) return L.send(res, 200, { ok: false, error: 'Too many from here. Wait a few minutes.' });
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'TIKTOKERS’ records are offline, so launching is paused. Try again shortly.' });
  if (!L.STUDIO) return L.send(res, 200, { ok: false, error: 'Launching opens soon.' });
  const b = await L.body(req, 4.2 * 1024 * 1024);
  if (b.tooBig) return L.send(res, 200, { ok: false, error: 'That picture is too big. Try a smaller one.' });
  const mint = String(b.mint || ''), payer = String(b.payer || '');
  if (!L.isAddr(mint)) return L.send(res, 200, { ok: false, error: 'The new token address is missing.' });
  if (!L.isAddr(payer)) return L.send(res, 200, { ok: false, error: 'Connect your wallet first.' });
  const name = L.clean(b.name, 64), symbol = L.clean(b.symbol, 20).replace(/^\$/, '').toUpperCase();
  const niche = T.TRENDS[String(b.trend || '')] ? String(b.trend) : 'walkin';
  const vstyle = null;
  const x = String(b.x || '').trim().replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//i, '').replace(/\/.*$/, '');
  if (x && !/^[A-Za-z0-9_]{1,15}$/.test(x)) return L.send(res, 200, { ok: false, error: 'That X handle doesn’t look right.' });
  if (!name || bytes(name) > 32) return L.send(res, 200, { ok: false, error: 'Give it a name of up to 32 characters.' });
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) return L.send(res, 200, { ok: false, error: 'The ticker is 1–10 letters or numbers.' });
  if (L.BANNED.test(name + ' ' + symbol)) return L.send(res, 200, { ok: false, error: 'Pick another name: that one breaks the house rules.' });
  const fid = String(b.face || '');
  if (!/^\d{1,12}$/.test(fid)) return L.send(res, 200, { ok: false, error: 'Make your TikToker first.' });
  let f = null; try { await L.ready(); f = (await L.q('SELECT img, line, look FROM t0_faces WHERE id=$1', [fid]))[0]; } catch {}
  if (!f) return L.send(res, 200, { ok: false, error: 'That TikToker expired. Make a new one.' });
  const face = Buffer.from(f.img), voice = L.clean(f.line, 700);
  try {
    if (!L.MOCK) { const acct = await L.rpc('getAccountInfo', [L.bondingCurveOf(mint), { encoding: 'base64' }]); if (acct && acct.value) return L.send(res, 200, { ok: false, error: 'That token is already launched; its record can’t change.' }); }
  } catch { return L.send(res, 200, { ok: false, error: 'Solana didn’t answer just now. Try again in a moment.' }); }
  try {
    await L.ready();
    const id = L.metaId(mint);
    const prev = await L.q('SELECT mint, status FROM t0_coins WHERE id=$1', [id]);
    if (prev.length && (prev[0].mint !== mint || prev[0].status !== 'pending')) return L.send(res, 200, { ok: false, error: 'Try again: the page will make a new token address.' });
    const look = L.clean(f.look, 500), sq = await T.square(face);
    const shares = L.sharesOf(payer);
    await L.q(`INSERT INTO t0_coins (mint, id, name, symbol, niche, voice, look, xhandle, payer, shares, img, vstyle, face) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (mint) DO UPDATE SET name=EXCLUDED.name, symbol=EXCLUDED.symbol, niche=EXCLUDED.niche, voice=EXCLUDED.voice, look=EXCLUDED.look, xhandle=EXCLUDED.xhandle, vstyle=EXCLUDED.vstyle,
        payer=EXCLUDED.payer, shares=EXCLUDED.shares, img=EXCLUDED.img, face=EXCLUDED.face, created_at=now() WHERE t0_coins.status='pending'`,
      [mint, id, name, symbol, niche, voice, look, x || null, payer, JSON.stringify(shares), sq, vstyle, face]);
    const site = L.origin(req);
    L.send(res, 200, { ok: true, uri: site + '/m/' + id, image: site + '/i/' + mint, studio: L.STUDIO, name, symbol, shares });
  } catch (e) { L.send(res, 200, { ok: false, error: 'Its record didn’t save. Try again.' }); }
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return L.send(res, 204, {});
  if (req.method === 'POST') return post(req, res);
  return get(req, res);
};
