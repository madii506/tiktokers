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
  "A pigeon in a tiny tailored suit giving a big sales pitch on a conference stage, spotlight on it, giant blank glowing screen behind it",
  "A dachshund salesman in a striped suit shouting into a megaphone on a busy city street, people walking by",
  "A crab in a business suit shouting into a phone on a busy stock trading floor, glowing monitors behind it",
  "A cat influencer holding a plain shiny product box toward the camera in an unboxing video, ring light, cozy room",
  "A llama hosting a late-night TV infomercial, pointing at a shiny gadget on a table, bright studio lights",
  "An owl marketing director with glasses at a whiteboard covered in colorful sticky notes, explaining the plan to the camera",
  "A bulldog in sunglasses posing like a supermodel at a glamorous photoshoot with flashing cameras",
  "A parrot in a headset running a call center desk, talking excitedly, rows of desks behind it",
  "A capybara construction worker in a yellow hard hat and hi-vis vest typing on a laptop on a building site at sunset",
  "A small sleek humanoid robot foreman in an orange hard hat holding a tablet and directing a busy team on a glowing construction site at night",
  "A beaver engineer in a yellow hard hat and hi-vis vest building a tall tower out of plain gold coins with tiny tools",
  "A raccoon welder in a welding mask and hi-vis vest welding a giant plain gold coin, bright sparks flying in a dark workshop",
  "A crew of ants in tiny yellow hard hats carrying a giant plain gold coin across a wooden workbench",
  "A golden retriever site manager in a white hard hat holding a coffee and a walkie-talkie at a busy construction site in the morning",
  "A frog in a hi-vis vest and yellow hard hat driving a tiny excavator digging into a big pile of plain gold coins",
  "An owl engineer in a yellow hard hat studying blueprints at a desk with three glowing monitors at night",
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
