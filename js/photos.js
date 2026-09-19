// Couple photos for photo breaks. They're added only by the site owner (tools/photos.mjs) and stored
// AES-GCM encrypted; the key travels in the private link (?k=...) and is remembered on the device.
// There is deliberately no way to upload photos from inside the game.

function fromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
}

class Photos {
  constructor() {
    this.entries = [];
    this.key = null;
    this.recent = [];
    this.ready = null; // Promise of the next decoded photo URL
    this.loaded = this.init();
  }

  async init() {
    // The key arrives in the private link. It's kept in the address (?k=) as well as in storage,
    // because a Home Screen web app starts from that address with storage of its own.
    const m = (location.search + location.hash).match(/k=([A-Za-z0-9_-]{20,})/);
    if (m) {
      localStorage.setItem('photoKey', m[1]);
      if (!location.search.includes('k=')) history.replaceState(null, '', `${location.pathname}?k=${m[1]}`);
    }
    const k = localStorage.getItem('photoKey');
    try {
      const res = await fetch('photos/index.json', { cache: 'no-cache' });
      this.entries = (await res.json()).photos ?? [];
    } catch {
      this.entries = [];
    }
    if (k && this.entries.length && crypto.subtle) {
      try {
        this.key = await crypto.subtle.importKey('raw', fromB64url(k), 'AES-GCM', false, ['decrypt']);
      } catch {
        this.key = null;
      }
    }
    this.prepareNext();
    if (this.available) setTimeout(() => this.cacheAll(), 4000);
  }

  /** Quietly downloads every photo once, so photo breaks work offline and on slow connections. */
  async cacheAll() {
    for (const e of this.entries) {
      try { await fetch('photos/' + e.f); } catch { return; }
    }
  }

  get available() { return !!this.key && this.entries.length > 0; }

  pick() {
    const fresh = this.entries.filter(e => !this.recent.includes(e.f));
    const pool = fresh.length ? fresh : this.entries;
    const e = pool[Math.floor(Math.random() * pool.length)];
    this.recent.push(e.f);
    if (this.recent.length > Math.max(0, Math.min(5, this.entries.length - 1))) this.recent.shift();
    return e;
  }

  async load(entry) {
    const res = await fetch('photos/' + entry.f);
    const buf = new Uint8Array(await res.arrayBuffer());
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, this.key, buf.slice(12));
    const url = URL.createObjectURL(new Blob([plain], { type: entry.t || 'image/jpeg' }));
    const img = new Image();
    img.src = url;
    await img.decode(); // decoded ahead of time so showing it never stutters
    return img;
  }

  prepareNext() {
    if (!this.available) { this.ready = null; return; }
    this.ready = this.load(this.pick()).catch(() => null);
  }

  /** A decoded photo (HTMLImageElement) or null when there are none. */
  async next() {
    await this.loaded;
    if (!this.available) return null;
    const img = await this.ready;
    this.prepareNext();
    return img;
  }
}

export const photos = new Photos();
