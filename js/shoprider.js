// The shop's rider as live SVG (animals.js drawn by svgrider.js). Its idle motion is poseAt(), a
// pure function of time; tricks are GSAP timelines layered on top: anticipation before a move,
// squash and stretch, the head lagging and settling, happy "^ ^" eyes, and each animal's own flourish.
// GSAP is only fetched when the shop opens; until it has loaded the rider just idles.

import { poseAt, ANIMALS } from './animals.js';
import { renderSVG } from './svgrider.js';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let gsapLoading = null;
function loadGsap() {
  gsapLoading ??= new Promise((resolve, reject) => {
    if (window.gsap) { resolve(window.gsap); return; }
    const s = document.createElement('script');
    s.src = 'js/lib/gsap.min.js';
    s.onload = () => resolve(window.gsap);
    s.onerror = () => { gsapLoading = null; reject(new Error('gsap')); };
    document.head.append(s);
  });
  return gsapLoading;
}

export const isAnimal = id => id in ANIMALS;

/** Each animal's flourish during a trick, added to the trick's timeline. */
const SPECIAL = {
  bunny: (R, tl) => tl.to(R.part('earBack'), { r: -0.5, duration: 0.18, ease: 'power2.out' }, 0.1)
    .to(R.part('earFront'), { r: 1.5, duration: 0.18, ease: 'power2.out' }, 0.12)
    .to([R.part('earBack'), R.part('earFront')], { r: 0, duration: 0.9, ease: 'elastic.out(1.1, 0.35)' }, 0.6),
  capy: (R, tl) => tl.to(R.part('yuzu'), { y: -34, r: 6.2, duration: 0.45, ease: 'power2.out' }, 0.1)
    .to(R.part('yuzu'), { y: 0, r: 6.28, duration: 0.4, ease: 'power2.in' }, 0.55)
    .fromTo(R.part('yuzu'), { sx: 1.35, sy: 0.7 }, { sx: 1, sy: 1, r: 6.28, duration: 0.6, ease: 'elastic.out(1.2, 0.3)', immediateRender: false }, 0.95)
    .set(R.part('yuzu'), { r: 0 }),
  kitty: (R, tl) => tl.to(R.part('earFront'), { r: 0.5, duration: 0.1, yoyo: true, repeat: 3 }, 0.05),
  penguin: (R, tl) => tl.to(R.part('arm'), { r: -0.9, duration: 0.09, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0.05),
  panda: (R, tl) => tl.to(R.part('sprout'), { r: Math.PI * 2, duration: 0.8, ease: 'back.out(1.6)' }, 0.1).set(R.part('sprout'), { r: 0 }),
  unicorn: (R, tl) => tl.to(R.part('horn'), { sx: 1.25, sy: 1.25, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.2),
};

export class ShopRider {
  /** Animal `id`, `height` CSS pixels for its 140 design units, in a new absolutely placed element. */
  constructor(id, height) {
    this.id = id;
    this.height = height;
    this.r = renderSVG(id, { style: 'rich', size: (height * 100) / 140 });
    this.el = document.createElement('div');
    this.el.className = 'shop-rider';
    this.el.append(this.r.svg);
    this.act = {};
    this.happy = 0;
    this.busy = false;
    // tapping the rider on the stage makes it show off
    this.el.addEventListener('pointerdown', () => this.trick(['hop', 'flip', 'wheelie'][Math.floor(Math.random() * 3)]));
    loadGsap().catch(() => {});
  }

  /** The acting layer for one part, which GSAP tweens and pose() adds to the idle pose. */
  part(name) {
    return (this.act[name] ??= { x: 0, y: 0, r: 0, sx: 1, sy: 1 });
  }

  /** Puts its feet at (x, bottom) in the stage and poses it for time `t`. */
  pose(t, x, bottom) {
    const w = (this.height * 100) / 140;
    this.el.style.transform = `translate(${x - w / 2}px, ${bottom - this.height}px)`;
    const p = poseAt(this.id, t);
    for (const [name, a] of Object.entries(this.act)) {
      const q = (p[name] ??= {});
      q.x = (q.x ?? 0) + a.x; q.y = (q.y ?? 0) + a.y; q.r = (q.r ?? 0) + a.r;
      q.sx = (q.sx ?? 1) * a.sx; q.sy = (q.sy ?? 1) * a.sy;
    }
    if (this.happy > 0.5) {
      // happy eyes: the closed "‿" flipped over into "^"
      p.eyeOpen = { a: 0 };
      p.eyeShut = { a: 1, sy: -1, y: -1.2 };
      if (p.lashes) p.lashes.a = 0;
    }
    this.r.pose(p);
  }

  /** A trick: 'hop' (small, `k` scales it), 'flip' or 'wheelie'. Does nothing while one is playing. */
  trick(kind = 'hop', k = 1) {
    const gsap = window.gsap;
    if (!gsap || this.busy || REDUCED) return;
    this.busy = true;
    const rider = this.part('rider'), head = this.part('head'), body = this.r.svg, u = this.height / 140;
    const tl = gsap.timeline({ onComplete: () => { this.busy = false; } });
    this.tl = tl;
    tl.set(this, { happy: 1 }, 0);
    // anticipation: a squash down before anything leaves the ground
    tl.to(rider, { sx: 1.12, sy: 0.84, duration: 0.12, ease: 'power2.out' }, 0);
    if (kind === 'wheelie') {
      tl.to(body, { rotation: -16, transformOrigin: '16% 91%', duration: 0.28, ease: 'back.out(2)' }, 0.1)
        .to(rider, { sx: 0.96, sy: 1.06, r: -0.08, duration: 0.25 }, 0.1)
        .to(body, { rotation: -12, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.38)
        .to(body, { rotation: 0, duration: 0.22, ease: 'power2.in' }, 1.1)
        .to(rider, { sx: 1.14, sy: 0.86, r: 0, duration: 0.08 }, 1.3)
        .to(rider, { sx: 1, sy: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' }, 1.38);
    } else {
      const flip = kind === 'flip';
      // the shop's stage is short: jump just high enough to read, and keep the flip inside it
      const up = (flip ? 30 : 18 * k) * u;
      tl.to(body, { y: -up, duration: 0.42, ease: 'power2.out' }, 0.12)
        .to(rider, { sx: 0.9, sy: 1.14, duration: 0.14, ease: 'power2.out' }, 0.12)
        .to(rider, { sx: 1, sy: 1, duration: 0.3, ease: 'sine.inOut' }, 0.26)
        .to(body, { y: 0, duration: 0.38, ease: 'power2.in' }, 0.54)
        .to(rider, { sx: 1.18, sy: 0.8, duration: 0.07, ease: 'power1.out' }, 0.92)
        .to(rider, { sx: 1, sy: 1, duration: 0.8, ease: 'elastic.out(1.2, 0.32)' }, 0.99);
      if (flip) tl.to(body, { rotation: -360, transformOrigin: '50% 62%', duration: 0.78, ease: 'power1.inOut' }, 0.14).set(body, { rotation: 0 });
      // the head lags on the way up and nods on landing
      tl.to(head, { y: 2, r: 0.06, duration: 0.2 }, 0.12).to(head, { y: -2, r: -0.04, duration: 0.3 }, 0.5)
        .to(head, { y: 0, r: 0, duration: 0.7, ease: 'elastic.out(1, 0.35)' }, 0.95);
    }
    if (kind !== 'hop' || k >= 1) SPECIAL[this.id]?.(this, tl);
    tl.set(this, { happy: 0 }, '+=0.25');
  }

  remove() {
    this.tl?.kill();
    this.el.remove();
  }
}
