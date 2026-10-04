// POST /api/film {face, trend}   a test video before launch: the TikToker from /api/face films one trend (5 s, vertical).
// POST /api/film {mint}          the first video of a freshly launched coin (only while it has none).
// POST /api/film {brand, trend}  the house reel on the home page, filmed once from the brand's own creators.
// GET  /api/film?job=N           how a video is doing; when it's done, its URL.
// GET  /api/film?v=N             the MP4 (byte ranges, so phones can play it).
// GET  /api/film?reel=1          the house reel.
// Videos come from the AI Gateway's video models (Seedance first, Wan second), inside the house's daily budget.
const L = require('./_lib');
const T = require('./_tok');
async function serve(req, res, id) {
  const r = await L.q('SELECT mp4 FROM t0_vids WHERE id=$1 AND status=$2', [id, 'done']);
  if (!r.length) { res.statusCode = 404; return res.end(); }
  const buf = Buffer.from(r[0].mp4), size = buf.length, range = String(req.headers.range || '');
  res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
  const m = range.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    let a = m[1] === '' ? size - Number(m[2]) : Number(m[1]), z = m[2] === '' || m[1] === '' ? size - 1 : Math.min(size - 1, Number(m[2]));
    if (a < 0 || a >= size || z < a) { res.statusCode = 416; res.setHeader('Content-Range', 'bytes */' + size); return res.end(); }
    res.statusCode = 206; res.setHeader('Content-Range', `bytes ${a}-${z}/${size}`); res.setHeader('Content-Length', z - a + 1); return res.end(buf.subarray(a, z + 1));
  }
  res.statusCode = 200; res.setHeader('Content-Length', size); return res.end(buf);
}
const view = v => ({ ok: true, job: v.id, status: v.status, trend: v.trend, caption: v.caption, url: v.status === 'done' ? '/api/film?v=' + v.id : null, error: v.status === 'error' ? 'The video didn’t come out. Try again.' : null });
module.exports = async (req, res) => {
  L.setOidc(req);
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'TIKTOKERS’ records are offline.' });
  try {
    await L.ready();
    const qy = L.query(req);
    if (req.method === 'GET') {
      if (qy.v && /^\d{1,12}$/.test(String(qy.v))) return serve(req, res, String(qy.v));
      if (qy.reel) {
        const r = await L.q(`SELECT id, trend, face FROM t0_vids WHERE kind='brand' AND status='done' ORDER BY id`);
        return L.send(res, 200, { ok: true, reel: r.map(v => ({ id: v.id, trend: v.trend, n: Number(v.face), url: '/api/film?v=' + v.id })) }, L.CACHE(30, 600));
      }
      const id = String(qy.job || '');
      if (!/^\d{1,12}$/.test(id)) return L.send(res, 200, { ok: false, error: 'No such video.' });
      let v = (await L.q('SELECT id, mint, kind, trend, caption, model, op, status, polled_at, at FROM t0_vids WHERE id=$1', [id]))[0];
      if (!v) return L.send(res, 200, { ok: false, error: 'No such video.' });
      v = await T.poll(v);
      return L.send(res, 200, view(v));
    }
    if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'POST only.' });
    const b = await L.body(req, 8192);
    if (b.brand != null) {
      const n = Number(b.brand); if (!(n >= 1 && n <= 12)) return L.send(res, 200, { ok: false, error: 'No such creator.' });
      const have = await L.q(`SELECT id, status FROM t0_vids WHERE kind='brand' AND face=$1 AND status<>'error'`, [n]);
      if (have.length) return L.send(res, 200, { ok: true, job: have[0].id, status: have[0].status });
      const img = await fetch(L.origin(req) + '/assets/img/c' + n + '.jpg', { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
      if (!img) return L.send(res, 200, { ok: false, error: 'No such creator.' });
      const jpeg = await T.vertical(Buffer.from(img));
      return L.send(res, 200, await T.film({ jpeg, trend: b.trend, kind: 'brand', face: n, k: { name: 'a TIKTOKERS creator' }, imageUrl: L.origin(req) + '/assets/img/c' + n + '.jpg' }));
    }
    if (b.mint) {
      const mint = String(b.mint);
      if (!L.isAddr(mint)) return L.send(res, 200, { ok: false, error: 'That isn’t a token address.' });
      if (L.limited('first:' + mint, 2, 600000)) return L.send(res, 200, { ok: false, error: 'Its TikToker is already filming.' });
      const k = (await L.q(`SELECT mint, name, symbol, niche, voice, look, face, status, vids FROM t0_coins WHERE mint=$1`, [mint]))[0];
      if (!k || k.status !== 'live') return L.send(res, 200, { ok: false, error: 'It isn’t launched yet.' });
      const any = await L.q(`SELECT id FROM t0_vids WHERE mint=$1 AND status<>'error' LIMIT 1`, [mint]);
      if (any.length) return L.send(res, 200, { ok: true, job: any[0].id, already: true });
      return L.send(res, 200, await T.shift(k, L.origin(req)));
    }
    const face = String(b.face || '');
    if (!/^\d{1,12}$/.test(face)) return L.send(res, 200, { ok: false, error: 'Make your TikToker first.' });
    if (L.limited('film:' + L.ip(req), 3, 3600000)) return L.send(res, 200, { ok: false, error: 'Three test videos an hour. Launch it and your TikToker films on its own.' });
    const f = (await L.q('SELECT id, img, line, look FROM t0_faces WHERE id=$1', [face]))[0];
    if (!f) return L.send(res, 200, { ok: false, error: 'That TikToker expired. Make a new one.' });
    const k = { name: L.clean(b.name, 32), symbol: L.clean(b.symbol, 10).replace(/^\$/, '').toUpperCase(), voice: f.line, look: f.look };
    L.send(res, 200, await T.film({ jpeg: Buffer.from(f.img), trend: b.trend, kind: 'test', face: f.id, k, imageUrl: L.origin(req) + '/api/face?id=' + f.id }));
  } catch (e) { L.send(res, 200, { ok: false, error: 'The camera didn’t start. Try again.', why: String(e && e.message).slice(0, 160) }); }
};
