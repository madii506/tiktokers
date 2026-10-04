// POST /api/face {line}  make a TikToker from one line: a fictional adult creator's vertical portrait (FLUX through
//   Vercel's AI Gateway), screened first: never a real person, never a minor, nothing sexual. Kept for two days.
// GET  /api/face?id=N    that portrait.
const L = require('./_lib');
const T = require('./_tok');
module.exports = async (req, res) => {
  L.setOidc(req);
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'TIKTOKERS’ records are offline.' });
  try {
    await L.ready();
    if (req.method === 'GET') {
      const id = String(L.query(req).id || '');
      const r = /^\d{1,12}$/.test(id) ? await L.q('SELECT img FROM t0_faces WHERE id=$1', [id]) : [];
      if (!r.length) { res.statusCode = 404; return res.end(); }
      res.statusCode = 200; res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.end(Buffer.from(r[0].img));
    }
    const b = await L.body(req, 8192), line = L.clean(b.line, 300);
    if (line.length < 8) return L.send(res, 200, { ok: false, error: 'Describe your TikToker in one line first.' });
    if (L.limited('face:' + L.ip(req), 6, 3600000)) return L.send(res, 200, { ok: false, error: 'Six TikTokers an hour from here. Try again soon.' });
    const f = await T.makeFace(line);
    if (!f.ok) return L.send(res, 200, f);
    const r = await L.q('INSERT INTO t0_faces (img, line, look, ip) VALUES ($1,$2,$3,$4) RETURNING id', [f.img, line, f.look, L.ip(req)]);
    await L.q(`DELETE FROM t0_faces WHERE at < now() - interval '2 days' AND id NOT IN (SELECT face FROM t0_vids WHERE face IS NOT NULL AND kind='brand')`).catch(() => {});
    L.send(res, 200, { ok: true, face: r[0].id, url: '/api/face?id=' + r[0].id, niche: f.niche, handle: f.handle });
  } catch (e) { L.send(res, 200, { ok: false, error: 'It didn’t come out. Try again.' }); }
};
