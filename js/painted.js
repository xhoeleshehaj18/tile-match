// Watercolour riders. Each shop animal is painted with p5.brush (art-lab/bake.mjs, from the same
// drawing as the shop's SVG riders in animals.js) into one sheet of frames: the four poses the game
// already switches between (plain, blink, idle move, both), each in three "boil" variants, so the
// ink lines shimmer like hand-drawn animation. A sheet is only downloaded for the rider in use; until
// it arrives, or if it can't, the drawn frames from riders.js stand in.

import { surface } from './art.js';
import { frameAt } from './riders.js';

/** The painted box in design units (the game's rider space is 100 × 140; this adds room around it
 *  for boiling lines and ears, none below, so the wheels still sit on the bottom edge), its pixels
 *  per unit in the sheet, and how the frames are laid out. */
export const SHEET = { x0: -8, y0: -10, w: 116, h: 150, px: 3, cols: 6, boils: 3, quality: 0.86 };
export const PAINTED = ['bunny', 'capy', 'kitty', 'penguin', 'panda', 'unicorn'];
const BOIL_FPS = 8;

const sheets = new Map();
function loadSheet(id) {
  if (!sheets.has(id)) {
    sheets.set(id, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { sheets.delete(id); reject(new Error(`riders/${id}.webp`)); };
      img.src = `riders/${id}.webp`;
    }));
  }
  return sheets.get(id);
}

/**
 * The painted frames of rider `id`, `height` tall like riderFrame() (so its 140 design units), or
 * null for a rider that isn't painted. Each is a bit wider and taller than riderFrame()'s but
 * centred the same and standing on the same bottom edge, so it draws in the same place.
 */
export async function paintedFrames(id, height) {
  if (!PAINTED.includes(id)) return null;
  const img = await loadSheet(id);
  const s = height / 140, fw = SHEET.w * SHEET.px, fh = SHEET.h * SHEET.px;
  const frames = [];
  for (let i = 0; i < 4 * SHEET.boils; i++) {
    const [c, ctx] = surface(SHEET.w * s, SHEET.h * s);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (i % SHEET.cols) * fw, Math.floor(i / SHEET.cols) * fh, fw, fh, 0, 0, c.w, c.h);
    frames.push(c);
  }
  return frames;
}

/** The frame to show at `t`: the pose from frameAt(), and for painted frames the boil variant. */
export function pickFrame(frames, id, t, seed = 0) {
  const f = frameAt(id, t, seed);
  if (frames.length === 4) return frames[f];
  return frames[f * SHEET.boils + (Math.floor((t + seed) * BOIL_FPS) % SHEET.boils)];
}
