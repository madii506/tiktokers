// GET /api/board  every coin launched here (newest first) and the latest videos. Read from TIKTOKERS' records, which the
// cycle keeps in step with the chain.
const L = require('./_lib');
const COLS = `mint, slot, name, symbol, niche, payer, born_at, state, mcap_sol, complete, last_trade_at, vault_lamports, vids, vid_at`;
module.exports = async (req, res) => {
  const base = { open: !!L.STUDIO, studio: L.STUDIO || null, hf: L.HF };
  if (!L.dbReady()) return L.send(res, 200, { ok: true, offline: true, infl: [], posts: [], ...base });
  try {
    await L.ready();
    const [infl, posts, solUsd] = await Promise.all([
      L.q(`SELECT ${COLS} FROM t0_coins WHERE status='live' ORDER BY slot DESC LIMIT 500`),
      L.q(`SELECT v.id, v.mint, v.trend, v.caption, v.done_at AS at, i.symbol, i.name FROM t0_vids v JOIN t0_coins i ON i.mint = v.mint WHERE v.status='done' ORDER BY v.id DESC LIMIT 30`),
      L.solPrice().catch(() => null),
    ]);
    L.send(res, 200, { ok: true, infl, posts, solUsd, ...base }, L.CACHE(6, 60));
  } catch (e) { L.send(res, 200, { ok: false, error: 'TIKTOKERS’ records didn’t answer.', ...base }); }
};
