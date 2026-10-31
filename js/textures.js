/* ==========================================================================
   Procedural textures. Everything is painted onto canvases at load time, so
   the game needs no image files. Each generator caches its result.
   ========================================================================== */

window.HH = window.HH || {};

HH.Tex = (function () {
  const cache = {};
  const TAU = Math.PI * 2;

  function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function cached(key, fn) { return cache[key] || (cache[key] = fn()); }

  function rng(seed) {
    let a = (seed * 9301 + 49297) >>> 0 || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function tex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }

  // Clone with its own repeat (shares the image).
  function tiled(t, rx, ry) {
    const c = t.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    return c;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // Tileable fractal value noise, greyscale.
  function noiseCanvas(seed = 1, cells = 8, octaves = 4, size = 256) {
    return cached(`noise${seed}_${cells}_${octaves}_${size}`, () => {
      const r = rng(seed), c = canvas(size), g = c.getContext('2d'), img = g.createImageData(size, size);
      const layers = [];
      for (let o = 0; o < octaves; o++) {
        const n = cells << o, grid = new Float32Array(n * n);
        for (let i = 0; i < grid.length; i++) grid[i] = r();
        layers.push({ n, grid });
      }
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        let v = 0, amp = 0.5, tot = 0;
        for (const { n, grid } of layers) {
          const fx = x / size * n, fy = y / size * n, x0 = fx | 0, y0 = fy | 0;
          const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
          const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
          const a = grid[y0 * n + x0], b = grid[y0 * n + x1], cc = grid[y1 * n + x0], d = grid[y1 * n + x1];
          v += amp * ((a + (b - a) * sx) * (1 - sy) + (cc + (d - cc) * sx) * sy);
          tot += amp; amp *= 0.5;
        }
        const i = (y * size + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = (v / tot) * 255;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return c;
    });
  }

  function grime(g, w, h, { seed = 1, alpha = 0.5, mode = 'multiply', cells = 8, tile = 256 } = {}) {
    const n = noiseCanvas(seed, cells);
    g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = mode;
    for (let y = 0; y < h; y += tile) for (let x = 0; x < w; x += tile) g.drawImage(n, x, y, tile, tile);
    g.restore();
  }

  function stains(g, w, h, r, count, color = '40,25,10') {
    for (let i = 0; i < count; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${color},${0.15 + r() * 0.3})`); gr.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }

  // Soft alpha blob from noise * radial falloff.
  function puff(size, seed, sx = 1, sy = 1, cells = 4) {
    const c = canvas(size * sx, size * sy), g = c.getContext('2d');
    const n = noiseCanvas(seed, cells, 5).getContext('2d').getImageData(0, 0, 256, 256).data;
    const img = g.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const dx = (x / c.width - 0.5) * 2, dy = (y / c.height - 0.5) * 2;
      const fall = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      const nv = n[(((y * 256 / c.height) | 0) * 256 + ((x * 256 / c.width) | 0)) * 4] / 255;
      const i = (y * c.width + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.max(0, Math.min(255, (nv * 1.6 - 0.35) * fall * fall * 255));
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /* ---------------- surfaces ---------------- */
  function wood(seed = 1, base = '#3a2415', planks = 8) {
    return cached(`wood${seed}${base}${planks}`, () => {
      const s = 512, c = canvas(s), g = c.getContext('2d'), r = rng(seed), ph = s / planks;
      for (let i = 0; i < planks; i++) {
        const y = i * ph;
        g.fillStyle = shade(base, (r() - 0.5) * 0.12); g.fillRect(0, y, s, ph);
        for (let k = 0; k < 16; k++) {
          const yy = y + r() * ph, amp = 1 + r() * 3, fr = 0.004 + r() * 0.02, p0 = r() * 6;
          g.beginPath();
          for (let x = 0; x <= s; x += 8) g.lineTo(x, yy + Math.sin(x * fr + p0) * amp);
          g.strokeStyle = r() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(255,220,180,0.06)';
          g.lineWidth = 0.6 + r() * 1.4; g.stroke();
        }
        if (r() < 0.45) {
          const kx = r() * s, ky = y + ph / 2, gr = g.createRadialGradient(kx, ky, 0, kx, ky, 10);
          gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.beginPath(); g.ellipse(kx, ky, 14, 6, 0, 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, y, s, 2);
        g.fillRect(r() * s, y, 2, ph);
      }
      grime(g, s, s, { seed, alpha: 0.4, cells: 16 });
      return tex(c, [1, 1]);
    });
  }

  function damask(g, x, y, s, fill) {
    g.save(); g.translate(x, y); g.fillStyle = fill; g.strokeStyle = fill; g.lineWidth = s * 0.05; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -s * 0.55);
    g.bezierCurveTo(s * 0.32, -s * 0.2, s * 0.26, s * 0.28, 0, s * 0.5);
    g.bezierCurveTo(-s * 0.26, s * 0.28, -s * 0.32, -s * 0.2, 0, -s * 0.55); g.fill();
    for (const m of [1, -1]) {
      g.beginPath(); g.moveTo(0, s * 0.05); g.bezierCurveTo(m * s * 0.55, 0, m * s * 0.6, -s * 0.42, m * s * 0.28, -s * 0.38); g.stroke();
      g.beginPath(); g.arc(m * s * 0.3, -s * 0.32, s * 0.07, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(0, s * 0.22); g.bezierCurveTo(m * s * 0.5, s * 0.35, m * s * 0.45, s * 0.65, m * s * 0.16, s * 0.6); g.stroke();
      g.beginPath(); g.arc(m * s * 0.17, s * 0.58, s * 0.05, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(0, 0, s * 0.06, s * 0.18, 0, 0, TAU); g.fill();
    g.restore();
  }

  function wallpaper(base = '#2a1a1e', accent = '#4a2c30', seed = 3) {
    return cached(`wp${base}${accent}${seed}`, () => {
      const s = 512, c = canvas(s), g = c.getContext('2d'), r = rng(seed);
      g.fillStyle = base; g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 64) { g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(x, 0, 20, s); }
      for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
        const x = col * 128 + (row % 2 ? 64 : 0), y = row * 128;
        damask(g, x, y, 86, accent);
        if (x - 128 < 0) damask(g, x + 512, y, 86, accent);
      }
      stains(g, s, s, r, 14);
      for (let i = 0; i < 9; i++) {
        const x = r() * s, w = 4 + r() * 16, h = 80 + r() * 300;
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, 'rgba(20,10,5,0.35)'); gr.addColorStop(1, 'rgba(20,10,5,0)');
        g.fillStyle = gr; g.fillRect(x, 0, w, h);
      }
      grime(g, s, s, { seed, alpha: 0.45, cells: 8 });
      return tex(c, [1, 1]);
    });
  }

  function stone(base = '#3a3835', seed = 5, rowH = 64) {
    return cached(`stone${base}${seed}${rowH}`, () => {
      const s = 512, c = canvas(s), g = c.getContext('2d'), r = rng(seed);
      g.fillStyle = '#121110'; g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += rowH) {
        let x = -r() * 80;
        while (x < s) {
          const w = 70 + r() * 90;
          g.fillStyle = shade(base, (r() - 0.5) * 0.12);
          g.fillRect(x + 3, y + 3, w - 6, rowH - 6);
          if (x + w > s) { g.fillRect(x + 3 - s, y + 3, w - 6, rowH - 6); }
          x += w;
        }
      }
      grime(g, s, s, { seed, alpha: 0.55, cells: 16 });
      stains(g, s, s, r, 10, '10,14,8');
      return tex(c, [1, 1]);
    });
  }

  function siding(seed = 7) {
    return cached('siding' + seed, () => {
      const s = 512, c = canvas(s), g = c.getContext('2d'), r = rng(seed);
      for (let y = 0; y < s; y += 32) {
        g.fillStyle = shade('#33352f', (r() - 0.5) * 0.06); g.fillRect(0, y, s, 32);
        const gr = g.createLinearGradient(0, y + 24, 0, y + 32);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.7)');
        g.fillStyle = gr; g.fillRect(0, y + 24, s, 8);
      }
      for (let i = 0; i < 30; i++) {
        const x = r() * s, w = 2 + r() * 10, h = 60 + r() * 400, y = r() * s;
        g.fillStyle = `rgba(10,12,8,${0.1 + r() * 0.25})`; g.fillRect(x, y, w, h);
      }
      grime(g, s, s, { seed, alpha: 0.5, cells: 8 });
      return tex(c, [1, 1]);
    });
  }

  function shingles() {
    return cached('shingles', () => {
      const s = 256, c = canvas(s), g = c.getContext('2d'), r = rng(11);
      g.fillStyle = '#0d0e10'; g.fillRect(0, 0, s, s);
      for (let row = 0; row < 9; row++) for (let col = -1; col < 9; col++) {
        const x = col * 32 + (row % 2 ? 16 : 0), y = row * 32 - 8;
        g.fillStyle = shade('#26282d', (r() - 0.5) * 0.08);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y); g.lineTo(x + 30, y + 24);
        g.arc(x + 15, y + 24, 15, 0, Math.PI); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.stroke();
      }
      grime(g, s, s, { seed: 11, alpha: 0.4, cells: 8 });
      return tex(c, [1, 1]);
    });
  }

  function ground() {
    return cached('ground', () => {
      const s = 512, c = canvas(s), g = c.getContext('2d'), r = rng(21);
      g.fillStyle = '#1b1e16'; g.fillRect(0, 0, s, s);
      grime(g, s, s, { seed: 21, alpha: 0.7, cells: 4 });
      grime(g, s, s, { seed: 22, alpha: 0.4, cells: 16, mode: 'overlay' });
      for (let i = 0; i < 1400; i++) {
        const x = r() * s, y = r() * s;
        g.strokeStyle = `rgba(${60 + r() * 40},${70 + r() * 40},${40 + r() * 20},${0.3 + r() * 0.4})`;
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 7); g.stroke();
      }
      for (let i = 0; i < 160; i++) {
        const x = r() * s, y = r() * s;
        g.fillStyle = `rgba(${90 + r() * 70},${40 + r() * 30},${10 + r() * 15},${0.35 + r() * 0.4})`;
        g.beginPath(); g.ellipse(x, y, 2 + r() * 3, 1 + r() * 2, r() * TAU, 0, TAU); g.fill();
      }
      return tex(c, [1, 1]);
    });
  }

  function bark() {
    return cached('bark', () => {
      const c = canvas(128, 256), g = c.getContext('2d'), r = rng(31);
      g.fillStyle = '#1a1612'; g.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '70,60,50'},${0.2 + r() * 0.4})`; g.fillRect(r() * 128, r() * 256, 1 + r() * 4, 30 + r() * 120); }
      return tex(c, [1, 1]);
    });
  }

  function rug() {
    return cached('rug', () => {
      const c = canvas(256, 512), g = c.getContext('2d');
      g.fillStyle = '#4a0f12'; g.fillRect(0, 0, 256, 512);
      g.strokeStyle = '#8a6a32'; g.lineWidth = 6; g.strokeRect(14, 14, 228, 484);
      g.strokeStyle = '#2a0608'; g.lineWidth = 10; g.strokeRect(30, 30, 196, 452);
      for (let y = 70; y < 480; y += 120) {
        g.fillStyle = '#6d2a1c'; g.beginPath(); g.moveTo(128, y - 40); g.lineTo(170, y); g.lineTo(128, y + 40); g.lineTo(86, y); g.closePath(); g.fill();
        g.fillStyle = '#8a6a32'; g.beginPath(); g.arc(128, y, 9, 0, TAU); g.fill();
      }
      grime(g, 256, 512, { seed: 41, alpha: 0.5, mode: 'screen', cells: 8 });
      grime(g, 256, 512, { seed: 42, alpha: 0.6, cells: 4 });
      return tex(c);
    });
  }

  function sheet() {
    return cached('sheet', () => {
      const s = 256, c = canvas(s), g = c.getContext('2d'), r = rng(51);
      g.fillStyle = '#b9b4a6'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 26; i++) {
        const x = r() * s, w = 6 + r() * 26, gr = g.createLinearGradient(x, 0, x + w, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, `rgba(40,35,25,${0.1 + r() * 0.25})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x, 0, w, s);
      }
      stains(g, s, s, r, 8, '90,70,30');
      grime(g, s, s, { seed: 51, alpha: 0.3 });
      return tex(c);
    });
  }

  function doorPanel(base = '#2b1810') {
    return cached('door' + base, () => {
      const c = canvas(256, 512), g = c.getContext('2d');
      g.drawImage(wood(9, base, 1).image, 0, 0, 512, 512, 0, 0, 256, 512);
      g.save(); g.translate(256, 0); g.rotate(Math.PI / 2); g.globalAlpha = 0.4; g.drawImage(wood(9, base, 1).image, 0, 0, 512, 256); g.restore();
      const panel = (x, y, w, h) => {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y); g.lineTo(x + w, y); g.stroke();
        g.strokeStyle = 'rgba(255,210,170,0.12)'; g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.stroke();
      };
      panel(30, 30, 85, 190); panel(141, 30, 85, 190); panel(30, 260, 85, 220); panel(141, 260, 85, 220);
      grime(g, 256, 512, { seed: 61, alpha: 0.35 });
      return tex(c);
    });
  }

  /* ---------------- light, fog, sky ---------------- */
  function glow() {
    return cached('glow', () => {
      const s = 128, c = canvas(s), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      return tex(c);
    });
  }

  function flame() {
    return cached('flame', () => {
      const c = canvas(64, 128), g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 92, 2, 32, 80, 52);
      gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(0.25, 'rgba(255,214,120,1)');
      gr.addColorStop(0.55, 'rgba(255,120,30,0.85)'); gr.addColorStop(1, 'rgba(160,30,0,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(32, 4);
      g.bezierCurveTo(46, 40, 58, 70, 52, 96); g.bezierCurveTo(46, 122, 18, 122, 12, 96);
      g.bezierCurveTo(6, 70, 18, 40, 32, 4); g.fill();
      return tex(c);
    });
  }

  function fog() { return cached('fog', () => tex(puff(256, 71, 1, 1, 3))); }
  function cloud(seed = 81) { return cached('cloud' + seed, () => tex(puff(256, seed, 2, 1, 3))); }

  function moon() {
    return cached('moon', () => {
      const s = 256, c = canvas(s), g = c.getContext('2d'), r = rng(91);
      g.save(); g.beginPath(); g.arc(128, 128, 120, 0, TAU); g.clip();
      const gr = g.createRadialGradient(110, 105, 10, 128, 128, 125);
      gr.addColorStop(0, '#fff8e2'); gr.addColorStop(0.7, '#e9dfbd'); gr.addColorStop(1, '#bfb38c');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 22; i++) {
        const x = 30 + r() * 196, y = 30 + r() * 196, rad = 5 + r() * 26, cg = g.createRadialGradient(x, y, 0, x, y, rad);
        cg.addColorStop(0, 'rgba(120,110,80,0.45)'); cg.addColorStop(1, 'rgba(120,110,80,0)');
        g.fillStyle = cg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      grime(g, s, s, { seed: 91, alpha: 0.25 });
      g.restore();
      return tex(c);
    });
  }

  function windowPane(kind = 'warm') {
    return cached('win' + kind, () => {
      const c = canvas(128, 256), g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 256);
      if (kind === 'warm') { gr.addColorStop(0, '#ffb35a'); gr.addColorStop(0.6, '#d9661c'); gr.addColorStop(1, '#5c1d06'); }
      else if (kind === 'cold') { gr.addColorStop(0, '#5b7397'); gr.addColorStop(1, '#141d2e'); }
      else { gr.addColorStop(0, '#0d1118'); gr.addColorStop(1, '#030406'); }
      g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
      grime(g, 128, 256, { seed: 101, alpha: 0.5, cells: 4, tile: 128 });
      if (kind === 'warm') {
        g.fillStyle = 'rgba(40,10,0,0.6)';
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(40, 120, 18, 256); g.lineTo(0, 256); g.fill();
        g.beginPath(); g.moveTo(128, 0); g.quadraticCurveTo(90, 130, 112, 256); g.lineTo(128, 256); g.fill();
      }
      return tex(c);
    });
  }

  /* ---------------- details ---------------- */
  function cobweb() {
    return cached('cobweb', () => {
      const s = 256, c = canvas(s), g = c.getContext('2d'), r = rng(111);
      g.strokeStyle = 'rgba(225,225,215,0.55)'; g.lineWidth = 1.2;
      const spokes = 7, angles = [];
      for (let i = 0; i < spokes; i++) angles.push((i / (spokes - 1)) * Math.PI / 2 + (r() - 0.5) * 0.08);
      angles.forEach(a => { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 250, Math.sin(a) * 250); g.stroke(); });
      for (let rad = 18; rad < 240; rad += 14 + r() * 10) {
        g.lineWidth = 0.6 + r() * 0.8;
        for (let i = 0; i < spokes - 1; i++) {
          const a0 = angles[i], a1 = angles[i + 1], am = (a0 + a1) / 2, sag = rad * 0.86;
          g.beginPath(); g.moveTo(Math.cos(a0) * rad, Math.sin(a0) * rad);
          g.quadraticCurveTo(Math.cos(am) * sag, Math.sin(am) * sag, Math.cos(a1) * rad, Math.sin(a1) * rad); g.stroke();
        }
      }
      return tex(c);
    });
  }

  function portrait(seed = 1) {
    return cached('portrait' + seed, () => {
      const c = canvas(256, 320), g = c.getContext('2d'), r = rng(seed * 13);
      const bg = g.createRadialGradient(128, 120, 10, 128, 160, 220);
      bg.addColorStop(0, shade(['#4a3a28', '#2e3a30', '#3d2a2e'][seed % 3], 0.05)); bg.addColorStop(1, '#0a0806');
      g.fillStyle = bg; g.fillRect(0, 0, 256, 320);
      g.fillStyle = '#0d0b0a'; g.beginPath(); g.ellipse(128, 330, 120, 110, 0, 0, TAU); g.fill();
      g.fillStyle = '#d4c5a8'; g.beginPath(); g.ellipse(128, 236, 26, 30, 0, 0, TAU); g.fill();
      g.fillStyle = '#1a120c'; const longHair = r() < 0.5;
      g.beginPath(); g.ellipse(128, 118, 50, longHair ? 74 : 58, 0, 0, TAU); g.fill();
      if (longHair) { g.fillRect(80, 120, 96, 110); }
      const face = g.createRadialGradient(118, 125, 4, 128, 135, 58);
      face.addColorStop(0, '#e6d8bd'); face.addColorStop(1, '#8c7a5e');
      g.fillStyle = face; g.beginPath(); g.ellipse(128, 136, 38, 52, 0, 0, TAU); g.fill();
      if (seed % 3 === 2) {
        g.strokeStyle = 'rgba(10,5,2,0.9)'; g.lineWidth = 3;
        for (let i = 0; i < 28; i++) { g.beginPath(); const y = 95 + r() * 85; g.moveTo(88 + r() * 10, y); g.lineTo(168 - r() * 10, y + (r() - 0.5) * 30); g.stroke(); }
      } else {
        g.fillStyle = '#1a100a';
        g.beginPath(); g.ellipse(113, 128, 9, 6, 0, 0, TAU); g.ellipse(143, 128, 9, 6, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8e0cc'; g.fillRect(112, 127, 2, 2); g.fillRect(142, 127, 2, 2);
        g.strokeStyle = '#4a2a20'; g.lineWidth = 2; g.beginPath(); g.moveTo(116, 166); g.quadraticCurveTo(128, 162, 140, 166); g.stroke();
      }
      g.fillStyle = 'rgba(160,110,40,0.25)'; g.globalCompositeOperation = 'multiply'; g.fillRect(0, 0, 256, 320);
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.7;
      for (let i = 0; i < 90; i++) { g.beginPath(); let x = r() * 256, y = r() * 320; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
      const v = g.createRadialGradient(128, 160, 80, 128, 160, 200);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
      g.fillStyle = v; g.fillRect(0, 0, 256, 320);
      return tex(c);
    });
  }

  function clockFace() {
    return cached('clock', () => {
      const s = 256, c = canvas(s), g = c.getContext('2d');
      g.fillStyle = '#16100a'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#cfc2a0'; g.beginPath(); g.arc(128, 128, 112, 0, TAU); g.fill();
      g.strokeStyle = '#2a1d10'; g.lineWidth = 6; g.stroke();
      g.fillStyle = '#20160c'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => {
        const a = i / 12 * TAU - Math.PI / 2; g.fillText(n, 128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88);
      });
      const hand = (a, len, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a - Math.PI / 2) * len, 128 + Math.sin(a - Math.PI / 2) * len); g.stroke(); };
      g.strokeStyle = '#120c06'; hand(11.97 / 12 * TAU, 52, 6); hand(58 / 60 * TAU, 80, 3);
      grime(g, s, s, { seed: 121, alpha: 0.4 });
      return tex(c);
    });
  }

  function ritual() {
    return cached('ritual', () => {
      const s = 512, c = canvas(s), g = c.getContext('2d'), r = rng(131);
      g.strokeStyle = 'rgba(120,8,8,0.85)'; g.lineCap = 'round';
      g.lineWidth = 7; g.beginPath(); g.arc(256, 256, 236, 0, TAU); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.arc(256, 256, 196, 0, TAU); g.stroke();
      g.lineWidth = 6; g.beginPath();
      for (let i = 0; i <= 5; i++) { const a = (i * 2 / 5) * TAU - Math.PI / 2; g.lineTo(256 + Math.cos(a) * 196, 256 + Math.sin(a) * 196); }
      g.stroke();
      g.lineWidth = 3;
      for (let i = 0; i < 26; i++) {
        const a = i / 26 * TAU; g.save(); g.translate(256 + Math.cos(a) * 216, 256 + Math.sin(a) * 216); g.rotate(a + Math.PI / 2);
        g.beginPath(); for (let k = 0; k < 3; k++) { g.moveTo((r() - 0.5) * 14, (r() - 0.5) * 14); g.lineTo((r() - 0.5) * 14, (r() - 0.5) * 14); } g.stroke(); g.restore();
      }
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.6})`; g.beginPath(); g.arc(r() * s, r() * s, 6 + r() * 30, 0, TAU); g.fill(); }
      return tex(c);
    });
  }

  function writing(text = 'GET OUT') {
    return cached('write' + text, () => {
      const c = canvas(1024, 320), g = c.getContext('2d'), r = rng(141);
      g.fillStyle = 'rgba(115,8,6,0.92)'; g.font = 'bold 170px Georgia, serif'; g.textBaseline = 'middle';
      let x = 40;
      for (const ch of text) {
        g.save(); g.translate(x, 140 + (r() - 0.5) * 30); g.rotate((r() - 0.5) * 0.25); g.fillText(ch, 0, 0); g.restore();
        const w = g.measureText(ch).width;
        if (ch !== ' ') for (let d = 0; d < 2; d++) {
          const dx = x + r() * w, len = 30 + r() * 120;
          g.fillRect(dx, 180, 4 + r() * 4, len); g.beginPath(); g.arc(dx + 4, 180 + len, 6, 0, TAU); g.fill();
        }
        x += w + 10;
      }
      return tex(c);
    });
  }

  function crack() {
    return cached('crack', () => {
      const s = 256, c = canvas(s), g = c.getContext('2d'), r = rng(151);
      g.strokeStyle = 'rgba(230,235,240,0.7)';
      for (let i = 0; i < 14; i++) {
        let x = 150, y = 90, a = r() * TAU; g.lineWidth = 0.8 + r() * 1.5; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 8; k++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * 18; y += Math.sin(a) * 18; g.lineTo(x, y); }
        g.stroke();
      }
      for (let rad = 10; rad < 40; rad += 12) { g.beginPath(); g.arc(150, 90, rad, 0, TAU); g.stroke(); }
      return tex(c);
    });
  }

  /* ---------------- the jumpscare face (raw canvas) ---------------- */
  function faceCanvas() {
    return cached('faceCanvas', () => {
      const s = 768, c = canvas(s), g = c.getContext('2d'), r = rng(161);
      g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
      const skin = g.createRadialGradient(384, 300, 40, 384, 400, 420);
      skin.addColorStop(0, '#d9d5c3'); skin.addColorStop(0.45, '#8a8676'); skin.addColorStop(0.85, '#2a2822'); skin.addColorStop(1, '#000');
      g.fillStyle = skin; g.beginPath(); g.ellipse(384, 400, 250, 360, 0, 0, TAU); g.fill();
      for (const m of [-1, 1]) {
        const hx = 384 + m * 170, hg = g.createRadialGradient(hx, 480, 10, hx, 480, 140);
        hg.addColorStop(0, 'rgba(0,0,0,0.7)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = hg; g.fillRect(hx - 140, 340, 280, 280);
        const ex = 384 + m * 100, ey = 300, eg = g.createRadialGradient(ex, ey, 20, ex, ey, 110);
        eg.addColorStop(0, '#000'); eg.addColorStop(0.55, 'rgba(0,0,0,0.95)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = eg; g.save(); g.translate(ex, ey); g.rotate(m * -0.35); g.beginPath(); g.ellipse(0, 0, 105, 80, 0, 0, TAU); g.restore(); g.fill();
        g.shadowColor = '#fff'; g.shadowBlur = 25; g.fillStyle = '#fff';
        g.beginPath(); g.arc(ex + m * -8, ey + 6, 7, 0, TAU); g.fill(); g.shadowBlur = 0;
        g.fillStyle = 'rgba(110,0,0,0.85)';
        for (let d = 0; d < 3; d++) { const dx = ex - 30 + r() * 60, len = 80 + r() * 200; g.fillRect(dx, ey + 40, 3 + r() * 5, len); }
      }
      const mg = g.createRadialGradient(384, 590, 10, 384, 590, 160);
      mg.addColorStop(0, '#000'); mg.addColorStop(0.7, '#1a0000'); mg.addColorStop(1, '#3a0505');
      g.fillStyle = mg; g.beginPath(); g.ellipse(384, 590, 110, 165, 0, 0, TAU); g.fill();
      g.fillStyle = '#cfc6a0';
      for (let i = 0; i < 26; i++) {
        const a = i / 26 * TAU, bx = 384 + Math.cos(a) * 108, by = 590 + Math.sin(a) * 162, len = 22 + r() * 34;
        g.beginPath(); g.moveTo(bx + Math.cos(a + 1.57) * 9, by + Math.sin(a + 1.57) * 9); g.lineTo(bx - Math.cos(a + 1.57) * 9, by - Math.sin(a + 1.57) * 9);
        g.lineTo(bx - Math.cos(a) * len, by - Math.sin(a) * len); g.fill();
      }
      g.strokeStyle = 'rgba(60,10,20,0.6)'; g.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        g.beginPath(); let x = 220 + r() * 330, y = 70 + r() * 140; g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 60; y += r() * 40; g.lineTo(x, y); } g.stroke();
      }
      grime(g, s, s, { seed: 161, alpha: 0.45, cells: 16, tile: 384 });
      const v = g.createRadialGradient(384, 400, 200, 384, 400, 540);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = v; g.fillRect(0, 0, s, s);
      return c;
    });
  }

  return {
    rng, tiled, noiseCanvas,
    wood, wallpaper, stone, siding, shingles, ground, bark, rug, sheet, doorPanel,
    glow, flame, fog, cloud, moon, windowPane,
    cobweb, portrait, clockFace, ritual, writing, crack, faceCanvas
  };
})();
