// GET /api/slop?n=N  the house's AI-slop TikTokers (made with FLUX once, kept): animals and oddballs doing influencer things.
const L = require('./_lib');
const SLOP = [
  null,
  'A capybara wearing a tiny bucket hat filming a get-ready-with-me in front of a ring light, holding a lip gloss, bedroom with pink LED strip lights',
  'A golden retriever in a navy suit and tie reading the evening news at a TV news desk, dead serious, bright studio lights',
  'A cat chef in a tiny white chef hat cooking a steaming bowl of ramen in a small cozy kitchen, filming itself for TikTok',
  'A frog DJ wearing big headphones and sunglasses at a neon nightclub booth, crowd with hands in the air behind it',
  'A giant shrimp lounging in a rooftop hot tub with sunglasses and a coconut drink at sunset, city skyline behind',
  'A horse in a tailored business suit walking through a bright airport terminal pulling a carry-on suitcase, day-in-my-life vlog',
  'A baby penguin hosting a podcast with a big studio microphone and headphones in a cozy studio with warm lights',
  'A raccoon doing a mukbang, eating a huge pile of french fries at a table lit by a ring light, cheeks full',
  'A hamster lifting a tiny barbell in a miniature gym, sweatband on its head, intense focus, mirror behind it',
  'A goat doing an outfit check in a designer puffer jacket and sneakers on a city street, posing for the camera',
];
const KEEP = ' Photorealistic, viral AI TikTok video still, vertical 9:16 phone framing, subject centered, funny and absurd, sharp detail, no text, no letters, no captions, no logos, no watermark.';
module.exports = async (req, res) => {
  L.setOidc(req);
  const n = Number(L.query(req).n);
  if (!(n >= 1 && n < SLOP.length) || !L.dbReady()) { res.statusCode = 404; return res.end(); }
  try {
    await L.ready();
    let r = (await L.q('SELECT img FROM t0_brand WHERE n=$1', [100 + n]))[0];
    if (!r && !L.limited('slop', 30, 3600000)) {
      const p = await L.photo(SLOP[n] + '.' + KEEP, null, 55000, '768x1344');
      if (!p.ok) return L.send(res, 200, { ok: false, error: p.error });
      const img = await require('sharp')(p.buf).resize(720, 1280, { fit: 'cover', position: 'attention' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
      await L.q('INSERT INTO t0_brand (n, img) VALUES ($1,$2) ON CONFLICT (n) DO UPDATE SET img=EXCLUDED.img, at=now()', [100 + n, img]); r = { img };
    }
    if (!r) return L.send(res, 200, { ok: false, error: 'not made yet' });
    res.statusCode = 200; res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable'); return res.end(Buffer.from(r.img));
  } catch (e) { return L.send(res, 200, { ok: false, error: String(e && e.message).slice(0, 200) }); }
};
