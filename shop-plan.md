# Shop & Cosmetics Plan

*Written 2026‑10‑01. Try the hats in the fitting room: `art-lab/hats.html` (add `?hat=<id>&close` for a close-up, and tick "Game size" to judge them at in-game size).*

This plan for Tile Match combines six research lenses (hats, market, UX, categories, economy, personal) and their critiques. Where the lenses disagreed, I checked the code and picked one answer.

- **Code I read:** `art-lab/hats.js`, `web/js/shop.js`, `painted.js`, `store.js`, `backup.js`, `photos.js`, `puzzle.js`, `web/tools/release.sh`, and the shop parts of `ui.js`, `game.js`, `shoprider.js`, `sw.js` and `style.css`.
- **Line numbers:** checked against the current code.
- **Lens ideas:** ideas the critics cut are gone, and their suggested changes are applied.
- **iOS port:** the SwiftUI/SpriteKit port in `TileMatch/` is out of scope. It has no shop and doesn't share save data with the web version.

**Progress (updated 2026‑10‑01):** Phase 1 shipped as **v30**. Phase 2 and the Phase 3 categories are coded as **v31** (branch `claude/shop-plan-implementation-13cqj5`), checked in desktop Chromium at phone size. Still open: real-device testing, the native-speaker proofread, and the decisions only you can make (her birthday and anniversary in `../private/notes.json`, your notes, her 冬至 tradition, the girl's cap, prices against her balance). See the marks in §7 and the "phase" column of §2.
✅ done · 🟡 partly done or only checked in the desktop browser · ⬜ not started · ❓ waiting on your decision

**Effort scale:** **XS** under 1h · **S** 1–3h · **M** half a day to a day · **L** several days.

## TL;DR

1. ✅ **Add hats as a single head slot.**
   - Move `art-lab/hats.js` to `web/js/hats.js` and store each animal's hat in `shop.hats`.
   - Add a third shop tab (骑手 | 帽子 | 尾迹).
   - The must-ship Phase 1 covers hats in the shop and in the game plus two gifts. That is about **5–7 focused days (L)**, or the weekends of 10‑03, 10‑10 and 10‑17 plus weekday evenings. Aim to release by about 10‑24, a week before Halloween, so the update has reached her phone before the witch hat unlocks on 10‑31.
2. ✅ **Show hats in the game as SVG frames now.** (⬜ still to test on her iPhone)
   - When an animal wears a hat, draw the hatted SVG rider into the 4 frames the game already uses. The bare watercolour sheet loads only if that fails.
   - Watercolour hat sheets are an optional Phase 3 item. S–M now.
3. ✅ **Two gifts, a free beanie at launch ("天冷了") and a witch hat from 10‑31.**
   - Each gift shows **when the app opens**, through the existing retry loop in `maybeShowShopGift`.
   - A dot stays on the shop button until she claims the gift. Gifts can be claimed forever.
   - In Phase 1 this is a simple hard-coded check. S.
4. 🟡 **Hat prices from 250 to 2,000.** (the prices are in; ❓ her balance is still to check)
   - The love numbers 520 (strawberry) and 1314 (top hat) are deliberate. 1314 is an intentional exception to avoiding the digit 4.
   - **Check her coin balance before you fix the prices.**
   - The for-sale total is 7,622 coins. Mystery gifts hand out the commons, so in practice she spends about 6,000–6,400, or roughly 2–3 weeks of play.
   - Nine more hats come free from dates, milestones and the photo album. XS.
5. ✅ **Small shop fixes:**
   - Give affordable cards a cue that isn't only colour (today an affordable card looks like an owned one apart from the price chip).
   - Make the buttons handle `price: null`.
   - Add an `aria-label` to every card.
   - Replace the hard-coded `kind === 'rider' ? … : …` checks with one lookup. S.
6. 🟡 **A `dates.js` for festivals.** (`today()` and `?date=` ✅; the festival list and encrypted dates ⬜)
   - The `?date=` test override works only on localhost and is removed from the address as soon as it is read.
   - Her personal dates and your notes stay encrypted with the existing photo key. M.
7. ❓ **The girl's green cap is your call.** (option A is in for now) Option A or B in §1.1. Phase 1 works with either.
8. ⬜ **Later: decorations on the house as the 4th category.** Free seasonal decor comes first, buyable pieces after. M, Phase 3.

---

## 1. Hats (the headline)

### 1.1 Wearable system design

**Slot decision: one head slot, nothing else.** The game rider is about 84px tall at 375px wide (132·s with s = W/592), and a hat is about 18–20px. That is the only add-on big enough to read during play. Glasses and neck items are cut (see §6).

**Data model** (`shop.js`):

```js
export const HAT_ITEMS = [
  { id: 'nohat', price: 0 },                      // NOT 'none': i18n itemName/itemText are keyed by id only,
  { id: 'beanie', price: null, gift: 'welcome' }, // and the trail list already has 'none'
  { id: 'beret', price: 250 }, /* … see §1.3 … */
  { id: 'witch', price: null, gift: 'halloween', tier: 'seasonal' },
  { id: 'crown', price: 2000, legendary: true },
];
const ITEMS = { rider: RIDER_ITEMS, hat: HAT_ITEMS, trail: TRAIL_ITEMS };
```

- **A hat is owned once, and any animal can wear it.**
  - `shop.hats` is a JSON map such as `{ bunny: 'beanie', capy: 'straw' }`.
  - `shop.hat` returns the current rider's hat if she owns it, or `'nohat'` (always `'nohat'` for the girl).
  - When she switches riders, each animal appears wearing its own hat.
- **Gift items must have `price: null` and a `gift` field.**
  - `owns()` treats `price === 0` as owned by everyone, so a gift hat must never have price 0.
  - `buy()` must return false when `item.gift` is set, because `coins < null` is false.
  - `itemButton` and `itemCard` must check `item.price == null` **before** comparing coins. `shop.coins >= null` is true, so without that check a gift would show a Buy button and the `affordable` class.
- **Generalise `equip()`.**
  - It currently hard-codes `'shop.rider'` / `'shop.trail'`. Rider and trail become `'shop.' + kind`, and hats write into the `shop.hats` map.
  - Setting a hat **must call `emit()`**. Then `refreshShop()` runs, and `makeRider()` rebuilds because its key includes the hat (§1.2).
- **Remember the last animal she rode** in `shop.lastAnimal`. Equipping any rider other than the girl updates it. It drives the girl rules below.

**Anchors.**

- A hat lives inside the head group (`g.p-head > g`), so on the shop stage it follows every pose from `poseAt()` automatically.
- For the game frames, `keyPose()` (today only in `art-lab/bake.html`) never moves the head. The head position is therefore fixed per animal, and the FIT values below hold for all 4 in-game poses.

**Things already on the animals' heads** (from the prototype's `FIT`):

| Animal | Crown (x, y) | Width | Tilt | Its own head thing | What the hat does | Check in the fitting room |
|---|---|---|---|---|---|---|
| Bunny | 47, 46.5 | 30 | −0.05 | bow | Moves the bow onto the hat band at 0.62 scale | The ear-flick trick still plays behind the hat |
| Capybara | 61, 44.8 | 26 | 0.03 | yuzu | Moves the yuzu up to the hat's perch | The yuzu-toss trick now launches from the hat's perch |
| Kitty | 47.5, 46 | 28 | 0.03 | ears | Ears stay out | Wide brims (straw, witch) may cover the ears: check with `?hat=straw&close` |
| Penguin | 48, 51.5 | 29 | 0.05 | tuft | Hides the tuft (in game frames the node is **removed**, see §1.2) | Shows again when the hat comes off (`remove()` undoes it) |
| Panda | 46.5, 46 | 27 | 0 | sprout | Moves the sprout up to the hat's perch | The sprout-spin trick now spins on top of the hat |
| Unicorn | 48.5, 45.5 | 28 | −0.03 | horn, twinkle | Draws the horn and twinkle in front of the hat | Party and witch cones slide back (dx −6 / −5) and lean away (−0.32 / −0.22 rad). The top hat slides back too (dx −6, −0.2 rad). Chef and santa are checked: the horn pokes through them, which reads fine. |

**Perch and pin.** Every hat except the halo defines both `perch` and `pin`. The halo has `perch: null` and no `pin`. `wearHat` skips the carry when the spot is missing, so under the halo the yuzu, sprout and bow stay where they normally are.

**The girl's green cap is your call.** The girl has no SVG and no painted sheet. She is drawn only on canvas (`riders.js girl()`, cap colour `#2C9A4E`), and her shop line already mentions the cap ("Cap on, off she goes!" / "戴好帽子，出发！"). The two options:

| Option | What she sees | Cost |
|---|---|---|
| A. Hats are for the animals only | The girl keeps her cap, and her line stays true. In the 帽子 tab, the stage shows an animal instead (rules below). | XS on top of Phase 1 |
| B. Her cap swaps for the chosen hat | A cap-less `girl()` path, plus every hat drawn again in canvas, plus rewording her line while she wears another hat | L |

A third idea, turning her cap into a hat the animals can wear, is excluded by the no-green-hat rule. Whichever option you pick, never write 绿帽 anywhere in the copy.

**Rules for hats while she rides the girl** (Phase 1; these work with A, and B can be added later):

- **Model animal.** In the 帽子 tab, the stage and the hat thumbs use her model animal: `shop.lastAnimal`, or the bunny as a try-on if she has never ridden an animal.
- **Buying or picking a hat while on the girl:**
  - If she owns the model animal, the hat goes onto it in `shop.hats`, and a one-line note says the hat is on that animal and appears when she rides it.
  - If the model is only the try-on bunny, the hat is bought but not assigned. The note asks her to choose an animal to wear it.
- **Gift popup when she owns no animal:** it shows the hat on the try-on animal and says the hat is waiting for her.

**Reduced motion is mostly handled already.** Your brief said the prototype ignores `prefers-reduced-motion`. The current `hats.js` already returns early from `animate()` when it is set: pompoms hang still and propellers stop. Three things remain:

1. The Phase 2 reactions (§1.4) must go through `animate()` too.
2. The try-on "drop onto the stage" must check `REDUCED`, as `ShopRider.trick` does.
3. Done in the prototype: under reduced motion the crown's twinkle rests as a small still sparkle (scale 0.6) instead of a full-size star. The game frames strip it anyway (§1.2).

### 1.2 Rendering the hats in the game

The lenses disagreed here. I compared four options against the code:

| Option | Verdict | Why |
|---|---|---|
| a. Draw a hat sprite on top of today's painted sheets | **Rejected** | The bow, yuzu, sprout, tuft and horn are painted into the sheets, so hide/lift/carry can't work. The unicorn's horn would end up behind the hat. Fixing that means 5 bare re-bakes, front-part sprites, per-frame anchors and matching the line shimmer. |
| b. Bake every animal+hat combo up front | **Not now; a Phase 3 option** | About 126 sheets (6 animals × 21 hats) at about 210 KB each, roughly 26 MB. **She would never download that.** `paintedFrames` loads `riders/<id>.webp` only for the rider in use, and `sw.js` doesn't precache riders. The cost is yours: repo size, bake time (`bake.mjs` already automates it with puppeteer, so this is machine time) and re-baking whenever a hat drawing changes. |
| **c. Draw the hatted SVG into frames** | **Phase 1** | No new assets. The game rider looks exactly like the one she tried on in the shop. |
| d. Bake only the combos she owns | **A Phase 3 option** | Fewer sheets than (b), but you need to know what she bought (her bug report will show the worn hat, §2 #14) and ship a release after each purchase. Until then she sees (c). |

**How (c) works.** It goes in `hatFrames(id, hat, h)` in `hats.js`, fed through the existing `use(frames)` path in `game.js makeRider()` (~522):

1. Build the rider with `renderSVG(id, { style: 'rich' })` and call `wearHat(r, id, hat, { lod: 'small' })`. `hats.js` imports `./animals.js`, which resolves inside `web/js`, so no import paths change.
2. For each of the 4 key poses, call `r.pose(...)`. Move `keyPose()` from `art-lab/bake.html` into `animals.js` and export it, so the bake and the game share it.
3. **Static-frame clean-up:**
   - Strip `anim` groups at `lod: 'small'`, or give them a fixed rest transform. Don't rely on `hat.animate(fixedT)`, because it returns early under reduced motion and would leave the crown's twinkle as a full-size star.
   - **Remove** hidden nodes such as the penguin's tuft instead of setting `style.display`. `XMLSerializer` writes that out as a style attribute into the SVG image.
4. Set the viewBox to `-8 -10 116 150` (the `SHEET` box). The frame is then centred and grounded exactly like the painted frames.
5. Turn the SVG into an image:
   - `XMLSerializer` → `Blob('image/svg+xml')` → `URL.createObjectURL` → `img.decode()` → `drawImage` into a `surface()`, then revoke the URL.
   - The CSP `img-src` allows `blob:`. Nothing reads pixels back, so tainting isn't a concern.
   - **Test on her iPhone's iOS version** early, including the `feGaussianBlur` filters of the rich style.
6. **Order the sources so the bare sheet can never overwrite hat frames.** Today `makeRider()` always calls `paintedFrames(id, h).then(use)`, and `use()` only checks that `riderKey` matches. A late bare sheet would replace the hatted frames. Change it to this:

   ```js
   const hat = shop.hat;                            // 'nohat' for the girl or a bare head
   const key = `${id}:${hat}:${h}`;
   // ... use(riderFrames(id, h)) at once, as today ...
   const bare = () => paintedFrames(id, h).then(f => f && use(f)).catch(() => {});
   if (hat === 'nohat') bare();
   else hatFrames(id, hat, h).then(use).catch(bare); // the bare sheet only when hat frames fail
   ```

7. `pickFrame()` already handles 4-frame lists. `refreshShop()` can also hop when the hat changes (compare `riderKey`, not only `riderId`).

The trade-off: a hatted rider in the game has the clean ink look of the shop stage instead of watercolour, and no line shimmer. She'll recognise it as the rider she dressed up, so this can stay indefinitely.

**The watercolour port (Phase 3, optional).**

1. Port each hat into the `animals.js` scene graph as a child of the head, using the node types the kit already uses (`solid`, `cloud`, `shape`, `line`).
2. Add `?hat=` to `bake.html` and a combo loop to `bake.mjs`.
3. Choose (b) or (d) at that point.
4. `paintedFrames(id, h, hat)` tries the combo sheet first and falls back to (c).
5. Before any new sheets ship, move rider sheets into a persistent cache (§2 #15).

**Simplifying for the game size (`lod: 'small'`).** At about 18–20px wide:

| Reads fine | Needs simplifying |
|---|---|
| Beanie (the ribbing disappears, which is fine), beret (keep the stalk), party, witch, santa, straw (after the recolour), chef (with its band), daisy crown (after the recolour), duckling, halo, nightcap, graduation cap | **Top hat**: `scale` 0.95 in game, because at 0.86 it reads as a dark block |
| | **Tiger**: the 王 is already enlarged and bolder in the prototype; at game size also drop the side stripes |
| | **Strawberry**: 4–5 larger seeds or none, because 8 small seeds blur into speckle |
| | **Crown**: drop the two small band gems and strip the twinkle group |
| | **Propeller**: blades at rest; the spin is shop-only |
| | **New hats** (see the fitting table in §1.3): 冬至 hat at most 3 balls or dumplings and no steam; goat headband without the 福 charm; cake without sprinkles; pumpkin face reduced to a grin line |

**Colour fixes for cultural reasons** (already done in the prototype, so the port inherits them):

- **Daisy crown.** The band is now a pink ribbon, green stays only in the four small leaves, and the three big daisies are yellow, pink and peach. Lone white flowers on the head suggest mourning, and no hat may read as green.
- **Straw hat.** Its flower is now yellow instead of white, by the same rule.
- **Chef hat.** Now has a pink band. All-white headwear reads as mourning (孝帽).
- **Strawberry.** The small calyx leaves and stem stay green, as on a real strawberry. Keep them small so the hat reads red.

### 1.3 Hat catalog

**Tiers:** common / rare / seasonal / legendary, as in the prototype. "≈ levels" is the price ÷ 65 coins per level. **Names live only in `i18n.js`** (`itemName` / `itemText`). The web copy of `hats.js` drops its `name` field, so names aren't stored twice. A native speaker proofreads all new zh copy (§4).

| # | Hat | id | Look | Idle (shop) | Trick reaction (shop, Phase 2) | Price / unlock | Tier | At game size |
|---|---|---|---|---|---|---|---|---|
| 0 | No hat 不戴帽子 | `nohat` | Bare head | – | – | Free | – | – |
| 1 | Knit beanie 毛线帽 | `beanie` | Pink rib knit, cream pompom | Pompom wobbles | Pompom swings wide, then settles | **Welcome gift** at launch ("天冷了"), `price: null`, never on sale | common | Fine |
| 2 | Beret 贝雷帽 | `beret` | Red beret with a stalk, tilted | – | On a flip it slides to a jauntier angle, then back | 250 (≈4) | common | Fine |
| 3 | Daisy crown 雏菊花环 | `flowers` | **Pink ribbon band**, four small leaves, three big daisies in **pink, yellow, peach** | – | On a hop, one petal floats down and fades | 300 (≈5) | common | Fine after recolour |
| 4 | Party hat 派对帽 | `party` | Lilac cone, pink dots, gold bands, gold pompom | Pompom wobbles | A small confetti puff from the tip | 330 (≈5) | common | Fine |
| 5 | Straw sun hat 草帽 | `straw` | Wide brim, pink band and ribbon, **pink or yellow flower** (was white) | Ribbon wobbles | On a wheelie the ribbon streams; on a flip the hat lifts and drops back | 360 (≈6) | common | Fine after recolour |
| 6 | Chef's hat 厨师帽 | `chef` | Puffy top **plus a pink band or cherry** | – | The puff squashes and springs back | 380 (≈6) | common | Fine after the band |
| 7 | Strawberry hat 草莓帽 | `strawberry` | Red cap, seeds, small leafy top, stem | – | Leaves flutter | **520** 我爱你 (≈8) | rare | Fewer seeds |
| 8 | Duckling bucket hat 小黄鸭渔夫帽 | `duck` | Yellow bucket hat with eye, cheek, beak and two hair tufts | – | The duckling blinks and its beak opens | 600 (≈9) | rare | Fine (eye and beak carry it) |
| 9 | Propeller cap 竹蜻蜓帽 | `propeller` | Rainbow panels, peak, propeller | Propeller spins | Spins faster, and the hop gets extra hang time | 680 (≈10) | rare | Blades at rest |
| 10 | Tiger-head hat 虎头帽 | `tiger` | Orange, round ears, stripes, bold 王, cream band | – | Ears flick | 888 (≈14) | rare | No side stripes |
| 11 | Tiny top hat 迷你礼帽 | `tophat` | Plum top hat, pink band, gold heart | – | **Magic trick:** on a flip a small heart pops out of the top | **1314** 一生一世 (≈20) | rare | Scale 0.95 |
| 12 | Little crown 小皇冠 | `crown` | Gold crown, three jewels, a heart | A star twinkles every 2.2s | The twinkle bursts into three sparkles | 2000 ★ (≈31, about 5–7 days), full-width card | legendary | No band gems, no twinkle |
| 13 | Halo 光环 | `halo` | Gold ring floating above the head | Bobs | Turns once on its axis and glows | **Earned:** finish the photo album, a multi-month goal; copy says 主角光环 ("main-character halo") | legendary | Fine |
| 14 | Witch hat 女巫帽 | `witch` | Purple, crooked tip, orange band, buckle, star | – | Floats up, spins once, lands | **Gift from 2026‑10‑31** | seasonal | Fine |
| 15 | Santa hat 圣诞帽 | `santa` | Red with a white cuff; the floppy tip wobbles | Tip wobbles | The tip whips around, with a tiny jingle | **Gift from 2026‑12‑24** | seasonal | Fine |
| 16 | 冬至 hat *(new)*: **dumpling hat 饺子帽** (`jiaozi`) or **tangyuan hat 汤圆帽** (`tangyuan`) | `jiaozi` / `tangyuan` | A small coloured bowl with warm cream dumplings with blush faces, or pink, cream and yellow tangyuan; never all white | Wisp of steam | The dumplings or tangyuan hop in the bowl | **Gift on 冬至 2026‑12‑22**, the version that matches her family's tradition (§5). If tangyuan suits 元宵 better, it can move to 2027‑02‑20 instead. | seasonal | Max 3 pieces, no steam |
| 17 | Goat-horn headband 羊角头箍 *(new)* | `goat` | Cream curled horns on a pink-gold band with a small 福 charm. Not red goat imagery, because 2027 is 丁未 and 红羊 carries bad associations; not 喜羊羊, which is trademarked | – | Horns wiggle | **Gift on 春节 2027‑02‑06** | seasonal | No 福 charm |
| 18 | Cake hat 蛋糕帽 *(new)* | `cake` | Two-tier pink cake, one candle | Candle flame flickers | The flame flares, puffs out and relights | **Her birthday** (personal date, §5) | seasonal | No sprinkles |
| 19 | Nightcap 睡帽 *(new)* | `nightcap` | Pale blue, droopy tip, moon pompom | Tip wobbles | The droopy tip flops | **Earned:** a 7-day daily streak | rare | Fine |
| 20 | Graduation cap 学士帽 *(new)* | `gradcap` | Navy mortarboard, gold tassel | Tassel swings | The tassel flips sides | **Earned:** reach level 100 | rare | Fine (tassel at rest) |
| 21 | Pumpkin cap 南瓜帽 *(new)* | `pumpkin` | Small orange pumpkin, brown curly stem, one small leaf, smiley face | – | Grins (the face scales) | **Gift from 2027‑10‑31**, so Halloween has a new gift next year too | seasonal | Grin line only |

**Fitting the new hats.** Before shipping any new hat, do a fitting-room pass with `?hat=<id>&close` on all 6 animals. Each new hat defines `perch`, `pin` and an `lod: 'small'` variant:

| New hat | `perch` (yuzu, sprout) | `pin` (bunny's bow) | Per-animal rules to settle in the fitting room |
|---|---|---|---|
| 冬至 hat | Bowl rim, so the yuzu sits among the dumplings | Bowl side | Unicorn: the bowl shifts back so the horn stays clear |
| Goat headband | `null`, like the halo: a headband has no top, so the yuzu and sprout stay on the head | Band side | The horns sit exactly where the bunny's, kitty's and panda's ears and the unicorn's horn are. Add `per` overrides that move the horns to the temples in front of the ear roots at about 0.8 scale. On the unicorn, either curl them low at the temples or hide them (band and charm only) with its own horn lifted in front. |
| Cake | Top tier beside the candle | Lower tier front | Unicorn: shift back and lean away like party/witch, so the candle doesn't cross the horn |
| Nightcap | Top, like santa | Band | Unicorn: check the floppy tip against the horn |
| Graduation cap | On the board | Band | Unicorn: check the board against the horn base; nudge it up if they overlap |
| Pumpkin cap | Beside the stem | Side | Unicorn: check the stem against the horn |

The existing tall hats on the unicorn (chef, top hat, santa) are already checked.

**Not built:** a frog hat or any green hat; an all-white hat; a hat version of the girl's green cap under any name.

**About the halo.** On a pet it can read as "passed away". Making it earned rather than bought, and calling it 主角光环 ("main-character halo"), frames it as an achievement. If she reads it as an angel, rework it into a star tiara 星星发箍 with the same id and tier.

### 1.4 Signature delight moments

**Phase 1 (no new animation code):**

1. **The idles already in `animate()`:** pompom wobble, propeller spin, halo bob, crown twinkle, santa tip. All of them follow reduced motion.
2. **Head things keep their jobs.** The capybara tosses its yuzu off the top of the straw hat, the panda's sprout spins on top of the beanie's pompom, and the bunny's bow is pinned to the hat band. These come for free, because the existing tricks still target `part('yuzu')` / `part('sprout')`, and `wearHat` only moved them.
3. **Each animal remembers its own hat.** Switching riders in the shop or in the game shows each one dressed as she left it.
4. **The ride home in a hat.** The rider wears its hat through the win ride to the house.
5. **Halloween morning.** When she opens the app on or after 10‑31, the gift popup shows every animal she owns wearing the witch hat at once, using live SVG. If she owns no animal, it shows the try-on bunny and says the hat is waiting for her.

**Phase 2: `react(kind)` on the object `wearHat()` returns.** It records a kick, and `animate()` lets the kick fade out. No GSAP is needed, and because `animate()` returns early under reduced motion, the reactions do too.

6. **Trying on.** Picking a hat card drops the hat onto the stage rider, which squashes, settles and does the small hop `preview.hop(0.7)` already plays. Under `REDUCED` the hat simply appears, as `ShopRider.trick` does. If she doesn't own it yet, the big button shows the price, or "≈N levels" (that logic exists in `itemButton`).
7. **The top-hat magic trick.** On a flip, a tiny heart pops out of the top hat. This is the best "aww" for the cost.
8. **Propeller hang time.** A hop in the propeller cap goes about 20% higher and floats down.
9. **Birthday.** The cake hat's candle is lit on the ride home (scheduled by her real date, §7).

---

## 2. Shop UI/UX improvements

| # | Problem | Fix | File / function | Effort · phase |
|---|---|---|---|---|
| 1 | Only two tabs | Three-way `segmented` (骑手 \| 帽子 \| 尾迹), with the item lists from `ITEMS[kind]` | `ui.js shopPage` (~832), `segmented` (118) | ✅ S · P1 |
| 2 | `kind === 'rider' ? shop.rider : shop.trail` is repeated in `shopPage`, `itemButton`, `itemCard` and `equip()` | Add `shop.current(kind)` and use one lookup everywhere | `shop.js`, `ui.js` | ✅ S · P1 |
| 3 | The stage can't show a hat | `preview.show(rider, trail, hat)`. ShopRider calls `wearHat` and runs `hat.animate(t, p)` after posing. In the 帽子 tab, a girl rider is replaced by the model animal (§1.1). | `ui.js startPreview` (~984), `shoprider.js` | ✅ S · P1 |
| 4 | `itemButton` / `itemCard` would treat `price: null` as affordable (`shop.coins >= null` is true) | Check `item.price == null` first; gift cards show the date teaser, "Open", or owned | `ui.js itemButton`, `itemCard` | ✅ XS · P1 |
| 5 | Too-expensive cards are already dimmed (`style.css:393` `.locked .thumb-art`, `:400` `.locked .card-price`), but an **affordable** card looks like an owned-but-unworn one apart from the price chip, and the difference is colour only | Add `.item-card.affordable` with a soft gold ring **plus a non-colour cue**: the price chip reads "● 250 · 买 Buy", or a small "+" badge. Leave `.locked` as it is. | `style.css` (~393–400) | ✅ XS · P1 |
| 6 | Cards are `<button>`s with only a canvas/SVG and a price chip, and no accessible name; hats add about 22 more | `aria-label` from `L.itemName(id)` plus the state: worn, owned, price, or gift date (e.g. "毛线帽, 正在戴" / "Knit beanie, wearing") | `ui.js itemCard` | ✅ S · P1 |
| 7 | Hat thumbs need art | **P1:** the hat alone (its kit SVG in a small viewBox around the crown origin), rasterised once through the `hatFrames` image path, key `hat:${id}:${u}`. **P2:** head close-ups of the model animal (viewBox `2 -6 96 96`, as in the prototype's `&close`), key `hat:${id}:${u}:${modelAnimal}`; rider thumbs show each animal in its own saved hat, key `rider:${id}:${u}:${hats[id]}`. | `ui.js thumb` (~927) | S · P1 ✅, M · P2 ✅ |
| 8 | About 22 full `renderSVG` riders as thumbs, each with an `feGaussianBlur` per solid plus clipPaths, would make the grid and stage stutter on her iPhone | Rasterise each thumb once to an image (same path as `hatFrames`), or use style `'flat'` for thumbs. Build them lazily, as cards scroll into view or at idle time, and test on her phone model. | `ui.js thumb` | ✅ S · P2 (`snapshot()` + `lazyThumb()`) |
| 9 | The block above the grid is the segmented control, the stage canvas (already `H = 136·u` px), the name, the description and the button. Together that is about 370px of the ~478px menu body at 375×667, so the grid starts below the fold. | Put the name, action button and a one-line caption on the stage, shrink the canvas, and make the whole block sticky at about 150px | `ui.js shopPage`, `style.css` | ✅ M · P2 (block is ~225px with the tabs) |
| 10 | Nothing marks new items | A `shop.seen` list, a "new" dot on the 帽子 tab and the menu shop button (same pattern as the daily dot at ~665/~2326), and a "New" ribbon on unseen cards. Each dot carries visually hidden text ("新" / "new"). | `shop.js`, `ui.js`, `game.js`, `style.css` | ✅ S · P2 |
| 11 | The gift popup handles only the starter gift, and only when the shop exists | **P1:** a hard-coded check for the beanie and witch hat. **P2:** a queue, where `shop.grant(kind, id, reason)` queues `{kind, id, reason, noteId}`. Both show **on app open**, through the retry loop `maybeShowShopGift` already has (it waits while `anyOpen`, `breakKind`, `welcomeWaiting`, `game.drag` or `game.finishing`, re-checking every 2.5s). A dot stays on the shop button while a gift is unclaimed. Priority order is below. | `ui.js maybeShowShopGift` (~1114), `shop.js` | S · P1 ✅, M · P2 ✅ |
| 12 | Gift hats have no "claim" state | Gift card states: a teaser ("10.31") before the date, "Open" after it, owned after claiming. Free and never expires. | `ui.js itemCard`, `itemButton` | ✅ S · P1 |
| 13 | The legendary card is marked only by a ribbon | Make the crown card full width in the grid | `style.css .shop-grid` | ✅ XS · P1 |
| 14 | Bug reports don't include the hat | Add `hat: shop.hat` next to `rider` and `trail` | `game.js` (~1957) | ✅ XS · P1 |
| 15 | `sw.js` caches `riders/*.webp` in the versioned `CACHE`, and `activate()` deletes it on every release, so each release re-downloads the sheet she wears | A persistent `'tile-match-riders'` cache, kept across updates like `PHOTOS`, with content-versioned filenames (`riders/bunny.<hash>.webp`) so changed art still refreshes | `sw.js`, `painted.js` | ✅ S · P2 (`tools/riders.mjs` names the sheets) |

**Panel priority on app open** (proposed; each waits for the ones above it to close, using the existing retry loop):

1. During play: nothing pops during a drag or the win ride (`game.drag`, `game.finishing`).
2. The result panel and chest that end a level.
3. The break panel (`breakKind`).
4. The first-run welcome (`welcomeWaiting`).
5. The daily panel or any other open menu (`anyOpen`).
6. The starter shop gift (existing, once).
7. Queued hat gifts, oldest first, one at a time.

**Scaling to 4+ categories.** Keep the segmented control for 3 kinds. At 4 or more, switch to a sideways-scrolling chip rail that keeps the active chip in view. Give each kind one entry in a registry, so a new category adds no new `if`s:

```js
// shop.js / ui.js
KINDS = {
  rider: { items, current, preview: (stage, id) => stage.setRider(id), thumb: riderThumb },
  hat:   { items, current, preview: (stage, id) => stage.setHat(id),   thumb: hatThumb },
  trail: { items, current, preview: (stage, id) => stage.setTrail(id), thumb: trailBits },
  // decor (Phase 3): preview shows a small house corner on the stage
};
```

**Card order is fixed:** "No hat", then everything for sale by price, then a **礼物 Gifts** row (claimable gifts first, then the next upcoming one as a teaser). Cards never move after a purchase.

**Shop at 375px after Phase 2:**

```
┌───────────────────────────────────────┐
│ ←  商店 Shop                 ● 1,240  │  header + coin chip
├───────────────────────────────────────┤
│ ╭───────────── sticky stage ───────╮  │  whole block ~150px
│ │          (bunny in beanie,       │  │  (was ~370px: tabs + stage
│ │           pompom wobbling)       │  │   + name + text + button)
│ │ 毛线帽 Knit beanie   [ 戴上 Wear ]│  │  name + action on the stage
│ ╰──────────────────────────────────╯  │
│ [ 骑手 ] [ 帽子 • ] [ 尾迹 ]          │  sticky under the stage
├───────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐      │
│ │  (  )  │ │ beanie │ │ beret  │      │  head close-up thumbs (P2;
│ │ 不戴   │ │   ✓    │ │●250 买 │      │  P1 shows the hat alone)
│ └────────┘ └────────┘ └────────┘      │  ✓ worn · gold ring + 买 = affordable
│ ┌────────┐ ┌────────┐ ┌────────┐      │
│ │ daisy  │ │ party  │ │ straw  │      │
│ │ ● 300  │ │ ● 330  │ │ ● 360  │      │  dimmed = not yet
│ └────────┘ └────────┘ └────────┘      │
│ ┌───────────────────────────────────┐ │
│ │ ★ 小皇冠 Little crown      ● 2000 │ │  legendary, full width
│ └───────────────────────────────────┘ │
│ 礼物 Gifts                            │
│ ┌────────┐ ┌────────┐ ┌────────┐      │
│ │ witch  │ │ santa  │ │   ?    │      │  teaser shows the date,
│ │ 10.31  │ │ 12.24  │ │  生日  │      │  "Open" once it arrives
│ └────────┘ └────────┘ └────────┘      │
└───────────────────────────────────────┘
```

---

## 3. Other cosmetic categories

Ranked by visibility × delight ÷ effort:

| Rank | Category | Visibility | Delight | Effort | Verdict |
|---|---|---|---|---|---|
| 1 | **House decor 门前装饰** | Every level (the house is in the scenery) | High, and seasonal decor needs no shop | M | **Phase 3; seasonal pieces can come earlier** |
| 2 | **Match pops 消除特效** | Every match | Medium-high | S–M | Phase 3 |
| 3 | **Tile styles 方块样式** | The whole board | Medium; affects readability | M | Phase 3, at most 2–3 styles |
| 4 | **Arrival flourish 到家庆祝** | Every win | Medium-high | S–M | Phase 3 |
| – | Coin-chip skins, fever colour themes | Low | Low | S | Skip |
| – | Sound packs | Muted whenever her silent switch is on (`audioSession 'ambient'`) | Low | M | Skip |
| – | Glasses, neck items, scooter paint, HUD themes, emoji companions | – | – | – | **Cut** (§6) |

**1. House decor.**

- **Where:** `Art.house(height)` (`art.js`, a 90×80 design space) gains a `decor` argument. `layout()` draws the house into the static scenery (`game.js` ~388), so decor costs nothing per frame.
- **When the date changes:** pick the decor when a level starts. If the date rolls over mid-session (on `visibilitychange`), redraw only the house region of `bg`, or rebuild `bg` alone. **Never re-run `layout()` for this.** It also rebuilds the board, tiles and emoji sprites and promotes ImageBitmaps.
- **Size:** the house is about 50×44px, so only bold silhouettes of 8px or more will read.
- **Seasonal, free and automatic:**
  - pumpkin by the door, 10‑28 to 11‑01
  - snow on the roof and a wreath, 12‑20 to 12‑26
  - red lanterns and an **upright** 福 on the door, 02‑05 to 02‑20. Many families avoid an upside-down 福 on the main door, because there it "pours out" the blessings. If you use a 倒福 at all, put it somewhere else, such as a rice jar by the door.
  - a lantern and a rabbit for Mid-Autumn
- **Buyable and permanent:**
  - flower box (300)
  - string lights (500)
  - a mailbox with a letter (600): tapping it opens a note from you (§5)
- **Ids** must not clash with any existing item id.

**2. Match pops.**

- **Where:** `burst()` (~1654) emits `leafSprite`. Choose the sprite from `shop.pop` and add `Art.petal/heart/star/snowflake`. `leafSprite` is already rebuilt on resize (the `fields` list at ~506).
- **Set:** leaves (default), petals, hearts, stars, plus a free snowflake pop in December and red-paper confetti during LNY.
- **Prices:** 300–600.
- **Ids:** `pop-petal` and so on, because `hearts` and `petals` are already trail ids. Keep the shapes visibly different from the trails.
- **Count:** same particle count as today.

**3. Tile styles.**

- **Where:** `Art.tile(w, h, style)` already takes a style. Add `cream`, `strawberry-milk` and `jelly`; the lit and flash sprites derive from the base tile.
- **Gotcha:** clear the `fragSprites` cache whenever the style changes, because the pieces are cut from the tile.
- **Readability:** every style must keep strong contrast against the 60 emoji kinds. Test the "sweet" and "Falling" daily themes too.
- **Price:** 500–900.

**4. Arrival flourish.**

- **When:** `win()` (~1846) rides for 0.8s, fades by about 1.05s and shows the result at 1.7s. Use the 0.8–1.05s window.
- **What:** the door opens and two hearts puff from the chimney. On festival days, a small firework or lantern instead. Reduced motion shows a still frame.
- **Cost:** start free and seasonal. Sell more only if she notices it.

---

## 4. Economy & unlocks

**Today:**

- Riders 7,700 + trails 3,850 = **11,550**.
- About 65 coins per level, ~300–400 a day, ~2,100–2,800 a week.

**Check her balance before fixing prices.** The bug-report diagnostics already carry `coins`, `earned`, `rider` and `trail` (`game.js` ~1957). Look at her latest report, or ask her.

- **If she has thousands banked,** she could buy half the hats on the first day. Either raise the common prices (to about 300–600, keeping 520, 888 and 1314 as they are) or add more for-sale hats.
- **If she is still saving for riders,** the ladder below works as it is.

**Hat price ladder (for sale):**

| Price | Hat | ≈ levels | Why |
|---|---|---|---|
| 250 | Beret | 4 | Same as the first trail: something within reach on day one |
| 300 / 330 / 360 / 380 | Daisy, party, straw, chef | 5–6 | A steady run of commons |
| **520** | Strawberry | 8 | 520 = 我爱你 |
| 600 / 680 | Duckling, propeller | 9–10 | |
| **888** | Tiger | 14 | 8 = 发, a lucky number |
| **1314** | Top hat | 20 | 1314 = 一生一世 ("a lifetime"); an intentional exception to avoiding 4 |
| 2000 ★ | Crown | 31 | The legendary goal, about 5–7 days on its own |
| **7,622** | All for sale | ~117 | About 3–3.5 weeks at 300–400 a day |
| **≈6,000–6,400** | What she actually spends | ~92–98 | Over those ~117 levels she passes 4–5 mystery-gift levels, which hand out the five commons for free (1,240–1,620 coins' worth). That leaves about 2–3 weeks of goals. |

New prices otherwise avoid the digit 4. Existing prices (400 and so on) stay as they are.

**Unlocks without coins.** All are free, all stay claimable forever, and none are random:

| Hat | Trigger | How it's detected | Where · phase |
|---|---|---|---|
| Beanie | First app open after the update | `shop.claimed` has no `welcome` | `shop.js` · P1 |
| Witch | Date ≥ 2026‑10‑31 | `dates.js today() >= '2026-10-31'`, hard-coded in P1 | `ui.js` gift check · P1 |
| 冬至 hat / Santa / Goat / Pumpkin | Date ≥ the festival date | `FESTIVALS` in `dates.js` | `dates.js` + gift queue · P2/P3 |
| Cake | On or after her birthday each year | The personal date, encrypted (§5) | `dates.js` + notes · by her date (§7) |
| Nightcap | Daily streak ≥ 7 | `Daily.streak` after `Daily.record` | `game.js` daily-win path · P2 |
| Graduation cap | Level 100 cleared | `game.level > 100` after the win | `game.js win()` · P2 |
| Halo | The photo album is complete | `photos.entries.length > 0 && puzzle.album.length >= photos.entries.length`, checked after `puzzle.award()` and in the migration. **Never revoked.** `photos.entries` is `[]` whenever `photos/index.json` can't be loaded (`photos.js` `init()`), so the length guard matters. Adding photos before she finishes moves the goal. 26 photos × 12 pieces is roughly 300 levels, a multi-month goal. | `puzzle.js` caller · P2 |
| **Mystery gift 神秘礼物** | Every 25th level (25, 50, 75, 125…; level 100 gives the graduation cap) | Wraps the existing `milestone` chest (+40 stays). It gives the **cheapest common hat she doesn't own yet**, with a note from you. Never the love-number hats (520, 1314), the tiger or the crown. Once she owns all five commons, it gives 300 coins. | `shop.levelCoins` / `game.js` · P2 |

**Coin bookkeeping:**

- `shop.add(n)` always increases `coins.earned`.
- `shop.grant(kind, id, reason)` adds to `shop.owned` and queues the popup without touching coins.
- Fallback coins from the mystery gift go through `shop.gift(n)`, which increases only `coins`.

**Migrating existing saves** (one function in `shop.js`, run once on first load):

1. **`backup.js` KEYS:** append at the very end, after `'big.gravitySeen'`, in the order the keys ship: `'shop.hats', 'shop.claimed', 'shop.lastAnimal'` (P1), then `'shop.seen'` (P2). The `?s=` address backup is read by position, so never insert or reorder.
2. **Model animal:** if her current rider is an animal, set `shop.lastAnimal` to it. Otherwise leave it unset, so the try-on bunny is used.
3. **Welcome gift:** queue the beanie.
4. **Don't flood her with "new" (P2):** fill `shop.seen` with every existing rider and trail id first, so only hats show as new.
5. **Past achievements (P2):** if she already has the album (guarded rule above), level 100 or a 7-day streak, grant those hats then, one popup at a time.
6. **Past chests:** mystery gifts start from her next multiple of 25. Don't hand out old ones.
7. **Unchanged:** `shop.owned`, `shop.rider`, `shop.trail` and coins stay as they are. `'shop.' + kind` reads the same keys as before.
8. **`sw.js`:** add `'js/hats.js', 'js/dates.js'` to the APP list by hand, then run **`web/tools/release.sh`**. It bumps `VERSION` in `js/version.js`, `version.json`, and `CACHE` and `BUILD` in `sw.js` in one go (v29 → v30).
9. **i18n:** about 21 hats × name and text × 2 languages, plus tab, gift, teaser, "no hat", girl-rule and greeting strings. Ids must not repeat across kinds (`nohat`, `pop-*`).
   - `i18n.js` is the single source for names.
   - A native speaker should proofread the new zh copy before release, especially the wordplay (主角光环, 天冷了, 端午安康). Pick someone other than her, to keep the surprise.

---

## 5. Personal & seasonal touches

**`web/js/dates.js` (new; minimal in P1, full list in P2):**

```js
import { todayKey } from './levels.js';

// Festivals: public, in plain sight. `days` = how long the popup/decor shows (items never expire).
export const FESTIVALS = [
  { d: '2026-10-31', id: 'halloween', gift: 'hat:witch',   decor: 'pumpkin',  days: [-3, 1] },
  { d: '2026-12-22', id: 'dongzhi',   gift: 'hat:jiaozi',  decor: 'steam',    days: [0, 0] },  // or 'hat:tangyuan': her family's tradition
  { d: '2026-12-24', id: 'christmas', gift: 'hat:santa',   decor: 'snow',     days: [-4, 2] },
  { d: '2027-02-06', id: 'lny',       gift: 'hat:goat',    decor: 'lanterns', days: [-1, 14] }, // 除夕 is 02-05
  { d: '2027-02-14', id: 'valentine', note: true },                           // falls inside LNY week
  { d: '2027-02-20', id: 'lantern',   decor: 'lanterns' },                    // 元宵; the tangyuan hat can live here instead
  { d: '2027-05-20', id: '520',       note: true },
  { d: '2027-06-09', id: 'duanwu' },                                          // copy: 端午安康, not 快乐
  { d: '2027-08-08', id: 'qixi',      note: true },
  { d: '2027-09-15', id: 'midautumn', decor: 'moon' },
  { d: '2027-10-31', id: 'halloween', gift: 'hat:pumpkin', decor: 'pumpkin',  days: [-3, 1] },
];

// Her dates (birthday, anniversary, first met) do NOT live here: they sit in the encrypted
// notes bundle, read with the photo key she already has, so the public site never carries them.

// `?date=YYYY-MM-DD` is honoured only on a local dev host, and is always stripped from the
// address at once: backup.js keeps other query params, and a Home Screen icon reopens the
// address it was added from, so a leftover ?date= would otherwise pin the date forever.
const DEV = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(location.hostname);
let override = null;
{
  const url = new URL(location.href);
  const q = url.searchParams.get('date');
  if (DEV && /^\d{4}-\d{2}-\d{2}$/.test(q ?? '')) override = q;
  if (url.searchParams.has('date')) {
    url.searchParams.delete('date');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
}
/** Today as YYYY-MM-DD (the dev override is never saved). */
export const today = () => override ?? todayKey();
```

To test dates on an iPhone, use Safari in the iOS Simulator, which reaches `localhost:8080`. Her own phone always uses the real date.

**Where we are on the calendar.** Today is National Day, Thursday 2026‑10‑01. Mid-Autumn 2026 (09‑25) has passed. The 10‑24 ship date is 23 days away, and Halloween is 30 days away.

**冬至 and 元宵 traditions.** 冬至 food is regional: northern families eat 饺子 and southern ones 汤圆. 汤圆 is tied even more strongly to 元宵 (2027‑02‑20). Find out which tradition she grew up with, then do one of these:

- ship the dumpling hat for 冬至, or
- ship the tangyuan hat for 冬至, or
- give 冬至 the dumpling hat and move the tangyuan hat to 元宵.

**Notes from you, private.**

- **Tool:** add `web/tools/notes.mjs` next to `web/tools/photos.mjs`. The script holds no secrets.
- **Plaintext:** the notes and her dates live **outside `web/`**, which is published. A `private/` folder at the project root works, as long as it is never published or pushed anywhere public.
- **Encryption:** each note is encrypted with the same AES-GCM photo key (`?k=` / `localStorage 'photoKey'`, files stored as iv(12) + ciphertext) into `web/notes/<id>.bin`. Her personal dates go in the same bundle.
- **No key:** if the key is missing, the notes and personal dates switch off quietly.
- **In the popup:** a gift's `noteId` shows your note, in her language.

**"Send a heart back."** The gift popup gets a small button she taps herself, which sends you a one-line message along the lines of "she opened the witch hat 💗".

- Use a new `report.ping()`, not `report.send()`. The bug-report path copies diagnostics to her clipboard and shares the rate-limit queue (`MIN_GAP` 15s, `MAX_PER_HOUR` 8).
- Nothing is sent unless she taps.

**Copy and culture:**

- Bilingual greetings: 万圣节快乐, 冬至快乐, 圣诞快乐, 新年快乐, 元宵节快乐, 端午安康 (not 快乐), 七夕快乐, 中秋快乐. A native speaker proofreads them (§4).
- Gifts are never shoes, umbrellas, pears or clocks (鞋/伞/梨/钟).
- No green hats; no all-white headwear or lone white flowers (the daisy and straw flowers are recoloured, the chef hat has a band, the dumplings are cream with blush); no 红羊 or 喜羊羊 imagery for 2027; an upright 福 on the house door.
- Valentine's 2027 falls on 初九, the 9th day of the new year, so keep it a note, not a second gift popup.

**Birthday morning.** The cake hat arrives with your note, there is a candle on the house roof, and the result screen shows her rider wearing the cake hat.

- **Timing:** this work is scheduled by her real birthday, not by phase (§7).
- **Fallback if the notes tooling isn't ready:** ship the cake hat in a release timed just before her birthday, as a gift that's "available now". The public code then never carries the date.
- **The anniversary:** same approach.

---

## 6. Things deliberately NOT to do (and why)

| Don't | Why |
|---|---|
| Gacha, loot boxes, random chests | A gift should feel chosen. The mystery gift is deterministic and comes with your note. |
| Time-limited items or countdown timers | Missing the witch hat because she was busy would sting. Popups and decor have windows; items never expire. |
| A rotating "today's pick" shop | FOMO by another name, and it hides items |
| Bundles or discounts | There's one shopper; a discount makes full price feel like a loss |
| ×2 coin "Gift Days" | Inflates the economy and makes normal days feel worse. Dates bring items and notes, not multipliers. |
| Glasses or neck slots | Unreadable at ~84px rider height, and they clash with the bow, yuzu and sprout |
| Scooter paint, HUD themes, emoji companions | Low visibility or clutter for their cost; the critics cut them |
| Porting the girl into the scene graph | Several days of work. If you choose option B (§1.1), a cap-less canvas `girl()` path is the smaller route. |
| Green hats, any copy saying 绿帽, or a wearable version of the girl's cap | 戴绿帽子 means being cheated on. The duckling replaced the frog for this reason. |
| All-white headwear, lone white flowers | Mourning associations; hence the daisy and straw recolours, the chef-hat band and the cream dumplings |
| Selling the halo | A bought halo on a pet reads as "it died". Earned 主角光环, or a star tiara instead. |
| Love-number hats in mystery gifts | 520 and 1314 should be things she chooses to buy |
| An "undo" toast after buying | Buying is already two taps (pick the card, then Buy), and an undo makes the coin history messy |
| Re-sorting the grid after a purchase | Cards jumping around breaks her sense of where things are |
| Baking all ~126 watercolour combos (6 animals × 21 hats) before the SVG frames have proven themselves | About 26 MB in your repo, bake time, and re-bakes whenever a hat drawing changes. She would only download the sheet she wears, so the cost is yours, not hers. |
| Re-running `layout()` to swap house decor | It rebuilds the board, tiles, emoji sprites and ImageBitmaps just to change the house |

---

## 7. Phased roadmap

### Phase 1: release by about 10‑24, a week before the 10‑31 witch hat (about 5–7 focused days: 3 weekends plus evenings)

- **Weekend of 10‑03/04 (riskiest first): hats in the game.** ✅ (done 10‑01, except the iPhone test)
  1. ✅ `web/js/hats.js`, ported from `art-lab/hats.js`. No import changes are needed.
     - ✅ `lod: 'small'` simplifications (top hat 0.95, strawberry 4 big seeds, tiger without side stripes, crown without band gems or twinkle).
     - ✅ Remove the duplicated `name` field, since names live in `i18n.js`.
  2. ✅ `keyPose` moves into `animals.js` (`bake.html` now imports it).
  3. ✅ `hatFrames()`: strip anim groups, remove hidden nodes, SVG → blob image.
  4. ✅ `game.js makeRider()`: the key gains the hat, and hat frames are ordered before the bare sheet (§1.2).
  5. ⬜ **Test the blob-SVG path on her iPhone's iOS version now.** It works in the desktop browser at phone size; not yet tried on iOS Safari or the Simulator.
- **Weekend of 10‑10/11: the shop.** ✅
  1. ✅ `shop.js`:
     - ✅ `HAT_ITEMS`, `ITEMS.hat` and the `shop.hats` map.
     - ✅ `shop.lastAnimal` and `current(kind)`. There is no one-off migration: `shop.model` falls back from the current rider to `lastAnimal`, then to her first owned animal, then to the try-on bunny.
     - ✅ `'shop.' + kind` equip, with `emit()` when a hat is set.
     - ✅ `price: null` gifts, and the `item.gift` guard in `buy()`.
  2. ✅ `ui.js`:
     - ✅ Three-way `segmented`.
     - ✅ The stage wears the hat (`preview.show(rider, trail, hat)`; ShopRider calls `wearHat` and the existing `animate()`).
     - ✅ The girl and model-animal rules (option A).
     - ✅ Hat-alone thumbs, rasterised once.
     - ✅ Null-price handling in `itemButton` / `itemCard`, gift card states, and `aria-label`s.
  3. ✅ `style.css`: `.affordable` with its non-colour cue, gift cards, and the full-width legendary card.
  - ✅ Extra: coin amounts below 10,000 show without a comma (in the shop and the top-bar coin count), so 1314 doesn't read as "1,314".
- **Weekend of 10‑17/18: gifts and release prep.** 🟡 (only the proofread is left)
  1. ✅ Minimal `dates.js` (`today()` with the dev-only, self-stripping `?date=`).
  2. ✅ The beanie and witch gifts through a hard-coded check in the `maybeShowShopGift` retry loop on app open, plus the gift dot on the shop button.
  3. ✅ Add `hat` to the diagnostics (~1957).
  4. 🟡 `backup.js` KEYS appended ✅; `sw.js` APP list ✅; i18n strings ✅; native-speaker proofread ⬜.
- **Evenings 10‑19 to 10‑23: test and release.** 🟡
  1. Tests:
     - 🟡 `?date=2026-10-31` on localhost ✅, in the Simulator ⬜. Old save ✅ (restored backup, with `shop.claimed` cleared to replay the gifts). Fresh save ⬜.
     - 🟡 A girl rider ✅ (she keeps her cap, and the hat tab shows the bunny with the note). A girl-only save and a save with no animals on 10‑31 ⬜.
     - ⬜ Reduced motion.
     - ⬜ VoiceOver reading the cards (the `aria-label`s are in place).
     - 🟡 375×812 ✅; 375×667 ⬜.
     - ⬜ Her phone model with the real date.
  2. 🟡 `web/tools/release.sh` has been run (v29 → v30) ✅. Not committed or deployed yet ⬜. If more changes go in before you ship, run it again.

### Phase 2: November to mid-December (before 冬至 on 12‑22; about 5–7 focused days)

Date-bound items come first. If time runs short, items 6–7 slide into January.

**Status (v31):** all seven items ✅ in code. ⬜ Still to do by hand: fitting-room passes on a phone, the proofread, writing `../private/notes.json` (her birthday and anniversary as YYYY-MM-DD, your notes) and running `node tools/notes.mjs`, and testing on her iPhone. Decisions taken where the plan left a choice:
- 冬至 gives the **dumpling** hat and 元宵 the **tangyuan** hat (the third option in §5), so both traditions get theirs. Swap the two `gift` lines in `js/dates.js` if hers is the other way.
- Notes and her dates are **one** encrypted bundle, `notes/notes.bin`, not a file per note: simpler, and it gives away nothing more.
- Mystery gifts and level 100 count on the Big board too (by its own level), once per level.
- The cake hat's card only appears once her birthday is known (from the bundle); until then it's hidden, so the public site never hints at the date.

1. **By 12‑20:**
   - The 冬至 hat (dumpling or tangyuan, per her tradition) and the santa hat, each with a fitting-room pass on all 6 animals.
   - The generalised gift queue (`shop.grant()`) with the panel priority order.
   - The full `FESTIVALS` list.
   - Snow on the roof, redrawing only the house.
2. **If her birthday or anniversary is before February:** `web/tools/notes.mjs`, `web/notes/*.bin`, personal dates in the encrypted bundle, and the cake hat with its fitting pass. If either date falls before mid-November, pull this into Phase 1 or use the timed-release fallback (§5).
3. `react()` reactions and the try-on drop (gated on `REDUCED`), the top-hat heart, and propeller hang time.
4. Head close-up thumbs and rider thumbs in their saved hats, with the corrected keys, rasterised lazily and tested on her phone.
5. Sticky compact stage; "new" dots via `shop.seen`, with hidden text.
6. The persistent `'tile-match-riders'` cache with content-versioned sheet names.
7. Achievements: nightcap, graduation cap, halo (guarded rule). Mystery gifts every 25 levels (commons only). `report.ping()` and "send a heart back".

### Phase 3: January to February 2027 and beyond

**Status (v31):** ✅ goat headband (with the ear and horn overrides; no horns on the unicorn), LNY lanterns with an upright 福, the Valentine's/520/七夕 notes (they need your text in the bundle), the tangyuan hat on 元宵, the cake hat and anniversary note, house decor as a category with the mailbox note, the chip rail, match pops, 3 tile looks, the arrival flourish, and the pumpkin cap for Halloween 2027. ⬜ Not done: the optional watercolour port (needs `art-lab/`, not in this repo) and the girl's cap (your call).

1. Goat-horn headband (after its fitting pass, with the ear and horn overrides) and LNY lanterns with an upright 福, shipped in late January for 02‑05. Valentine's note on 02‑14. Lantern Festival on 02‑20, with the tangyuan hat if it moved there.
2. Cake hat and anniversary touches, if her dates fall in February or later.
3. House decor as a shop category with buyable pieces (mailbox note, flower box, string lights). Switch to the chip rail once there are 4 tabs.
4. Match pops, then 2–3 tile styles if the pops go down well. Arrival flourish.
5. **Optional:** the watercolour port of the hats (scene graph, `bake.html ?hat=`, `bake.mjs` loop, then option b or d from §1.2).
6. Whatever you decide on the girl's cap (§1.1).
7. 520, 端午, 七夕 and 中秋 2027 notes. Pumpkin cap for Halloween 2027.

---

## Appendix: sources and references

- **Lens reports and critiques:** hats, market, UX, categories, economy, personal. Cut ideas are dropped, suggested changes applied, and conflicts settled in §1.2 (game rendering), §1.1 (girl, slots), §2 (tabs, gifts), and §4 (seasonal and chest unlocks).
- **Prototype:**
  - `art-lab/hats.js`: HATS (perch/pin per hat; the halo has `perch: null` and no `pin`), FIT (with per-hat unicorn offsets for party, witch and top hat), `kit()`, `wearHat()`, and `animate()` with the reduced-motion check.
  - `art-lab/hats.html`: the fitting room, `?hat=<id>&close` for a head close-up, served at `http://localhost:8090/art-lab/hats.html`.
- **Code read for this plan:**
  - `web/js/shop.js`: `owns`, `buy`, `equip`, `add`, `emit`, `giveStarterGift`, `levelCoins`
  - `web/js/painted.js`: `SHEET`, `paintedFrames`, `pickFrame`
  - `web/js/store.js`
  - `web/js/backup.js`: KEYS can only be appended to; `replaceState` keeps other query params
  - `web/js/game.js`: `makeRider` ~522, `refreshShop` ~546, house ~388, sprite fields ~506, `burst` ~1654, `win` ~1846, diagnostics ~1957
  - `web/js/ui.js`: `segmented` 118, `shopPage` ~832, `itemButton`, `itemCard`, `thumb` ~927, `startPreview` ~984, `maybeShowShopGift` ~1114 (retry loop)
  - `web/js/shoprider.js`: `SPECIAL`, `REDUCED`, the pointerdown trick
  - `web/js/photos.js`: `entries` is `[]` when `photos/index.json` can't be loaded
  - `web/js/puzzle.js`: `album`, `award()` → `completed`
  - `web/js/i18n.js`: the girl's line (`'Cap on, off she goes!'` / `'戴好帽子，出发！'`)
  - `web/sw.js`: `CACHE` v29, `PHOTOS` kept across updates, APP list
  - `web/style.css`: `.item-card.locked` dimming (393, 400), the reduced-motion block (~410)
  - `web/tools/release.sh`: bumps VERSION, `version.json`, CACHE and BUILD; `web/tools/photos.mjs`
  - `web/js/art.js`: `tile`, `house`, `leaf`
  - `web/js/levels.js`: `DAILY_THEMES`, `todayKey`
- **Asset sizes checked:** `web/riders/*.webp` are 177–248 KB; there is no girl sheet; there are 26 album photos.
- **Out of scope:** the iOS port in `TileMatch/` (no shop, separate save data).
- **Cultural notes:**
  - 戴绿帽子 (green hat)
  - white headwear and white flowers (mourning)
  - 4 and 伞/梨/钟/鞋 as couple gifts
  - 丁未 / 红羊 and the 喜羊羊 trademark for 2027
  - 端午安康
  - love numbers 520 / 1314
  - 冬至 饺子 (north) vs 汤圆 (south), and 汤圆 at 元宵
  - an upright 福 on the main door
- **2026–27 dates:**
  - 冬至 2026‑12‑22 (04:50 Beijing time)
  - 春节 2027‑02‑06 (除夕 02‑05), 元宵 2027‑02‑20, 02‑14 is 初九
  - 端午 2027‑06‑09, 七夕 2027‑08‑08, 中秋 2027‑09‑15
  - Mid-Autumn 2026 was 09‑25