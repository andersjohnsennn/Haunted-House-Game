/* ==========================================================================
   The Master of the House: the host's photo painted as an old oil portrait
   in a gilded frame with a brass name plaque. It hangs in the entrance hall,
   and it appears on the nearest wall when the host leads a toast.

   The photo comes from the setup screen ("Master of the House"), or from a
   file in the game folder: img/host.jpg or img/host.png.
   ========================================================================== */

window.HH = window.HH || {};

HH.HostPortrait = (function () {
  const W = 1.5, H = 1.9, FW = 0.16;
  let paintCanvas = null, plaqueCanvas = null, tex = null, plaqueTex = null;

  function ensure() {
    if (tex) return;
    paintCanvas = document.createElement('canvas'); paintCanvas.width = 512; paintCanvas.height = 648;
    plaqueCanvas = document.createElement('canvas'); plaqueCanvas.width = 512; plaqueCanvas.height = 120;
    tex = new THREE.CanvasTexture(paintCanvas); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    plaqueTex = new THREE.CanvasTexture(plaqueCanvas); plaqueTex.encoding = THREE.sRGBEncoding; plaqueTex.anisotropy = 4;
    repaint();
  }

  // The photo as an old oil painting: sepia, varnish, fine cracks, dark vignette.
  function paint(img) {
    const c = paintCanvas, g = c.getContext('2d'), w = c.width, h = c.height;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const bg = g.createRadialGradient(w / 2, h * 0.35, 20, w / 2, h * 0.5, h * 0.8);
    bg.addColorStop(0, '#4a3420'); bg.addColorStop(1, '#0c0806');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (img) {
      const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
      g.save(); g.filter = 'sepia(0.45) contrast(1.15) saturate(0.85) brightness(0.92)';
      g.drawImage(img, (w - dw) / 2, (h - dh) * 0.3, dw, dh);
      g.restore();
    } else {
      // A faceless figure until a photo is given.
      g.fillStyle = '#0a0705';
      g.beginPath(); g.ellipse(w / 2, h * 0.38, 92, 118, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(w / 2, h * 0.98, 235, 210, 0, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(190,130,60,0.35)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.35; g.drawImage(HH.Tex.noiseCanvas(171, 32), 0, 0, w, h);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(20,10,0,0.22)'; g.lineWidth = 0.8;
    for (let i = 0; i < 140; i++) {
      let x = Math.random() * w, y = Math.random() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 34; y += (Math.random() - 0.5) * 34; g.lineTo(x, y); }
      g.stroke();
    }
    const v = g.createRadialGradient(w / 2, h * 0.42, h * 0.22, w / 2, h * 0.5, h * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    tex.needsUpdate = true;
  }

  function paintPlaque(host) {
    const c = plaqueCanvas, g = c.getContext('2d'), w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#e6c27a'); gr.addColorStop(0.5, '#a07a34'); gr.addColorStop(1, '#6a4a1a');
    g.fillStyle = gr; g.fillRect(4, 4, w - 8, h - 8);
    g.strokeStyle = '#3a2808'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#2a1a04'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 22px Georgia, serif'; g.fillText('THE MASTER OF THE HOUSE', w / 2, host.named ? 38 : h / 2);
    if (host.named) { g.font = 'italic bold 40px Georgia, serif'; g.fillText(host.name, w / 2, 80); }
    plaqueTex.needsUpdate = true;
  }

  // Redraw from the current host name and photo (called when either changes).
  function repaint() {
    if (!tex) return;
    const host = HH.Roster.host(), src = HH.Roster.photo('host');
    paintPlaque(host);
    if (!src) return paint(null);
    const img = new Image();
    img.onload = () => paint(img);
    img.onerror = () => paint(null);
    img.src = src;
  }

  // A framed portrait. Front faces +z; origin at the centre of the painting.
  function make() {
    ensure();
    const P = HH.Props, at = P.at, g = new THREE.Group();
    const gold = P.mat({ color: 0xc09848, metalness: 0.65, roughness: 0.35, transparent: true });
    const dark = P.mat({ color: 0x2a1a08, metalness: 0.4, roughness: 0.6, transparent: true });
    const canvasM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.14, transparent: true });
    const plaqueM = new THREE.MeshStandardMaterial({ map: plaqueTex, metalness: 0.5, roughness: 0.35, emissive: 0xffffff, emissiveMap: plaqueTex, emissiveIntensity: 0.1, transparent: true });
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(W, H), canvasM), 0, 0, 0.03));
    g.add(at(P.box(W + FW * 2, FW, 0.12, gold), 0, H / 2 + FW / 2, 0.04));
    g.add(at(P.box(W + FW * 2, FW, 0.12, gold), 0, -H / 2 - FW / 2, 0.04));
    g.add(at(P.box(FW, H, 0.12, gold), -W / 2 - FW / 2, 0, 0.04));
    g.add(at(P.box(FW, H, 0.12, gold), W / 2 + FW / 2, 0, 0.04));
    for (const [w, h, x, y] of [[W, 0.03, 0, H / 2 - 0.015], [W, 0.03, 0, -H / 2 + 0.015], [0.03, H, -W / 2 + 0.015, 0], [0.03, H, W / 2 - 0.015, 0]]) g.add(at(P.box(w, h, 0.05, dark), x, y, 0.06));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), gold), sx * (W / 2 + FW / 2), sy * (H / 2 + FW / 2), 0.08));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.17), plaqueM), 0, -H / 2 - FW - 0.2, 0.04));
    const glow = P.glowSprite(0xffc070, 4.2, 0); glow.position.z = -0.05; g.add(glow);
    const mats = [gold, dark, canvasM, plaqueM];
    return {
      group: g,
      setOpacity(v) { mats.forEach(m => { m.opacity = v; }); g.visible = v > 0.01; },
      setGlow(v) { glow.material.opacity = v * 0.5; canvasM.emissiveIntensity = 0.14 + v * 0.45; }
    };
  }

  // Hang a portrait on a wall with its own little picture lamp. `pos` is the
  // centre of the painting, just off the wall; `ry` turns it to face into the
  // room (-90° on a right-hand wall, 90° on a left-hand one). Returns the
  // portrait with `anchor`, the point the camera looks at.
  function hang(scene, { pos, ry = 0, scale = 1 }) {
    const P = HH.Props, at = P.at, pic = make(), g = pic.group;
    g.position.set(pos[0], pos[1], pos[2]); g.rotation.y = ry; g.scale.setScalar(scale);
    g.add(at(P.box(0.9, 0.05, 0.12, P.brass()), 0, 1.27, 0.04));
    const lamp = P.glowSprite(0xffd090, 0.9, 0.35); lamp.position.set(0, 1.23, 0.18); g.add(lamp);
    const light = new THREE.PointLight(0xffc890, 0.9, 4.5, 1.8); light.position.set(0, 0.95, 0.9); g.add(light);
    scene.add(g);
    g.updateMatrixWorld(true);
    pic.anchor = new THREE.Vector3(0, 0, 0.05).applyMatrix4(g.matrixWorld);
    return pic;
  }

  // A real wall ahead of the camera where a portrait can appear: a large
  // upright wall plane (not a door, prop or opening). Looks straight ahead
  // first, then a little to either side.
  function wallSpot(set) {
    const Wd = HH.World, r = Wd.rig;
    const fwd = new THREE.Vector3().subVectors(r.look, r.pos).setY(0).normalize();
    const ceiling = set.ceiling || 4.5;
    const origin = new THREE.Vector3(r.pos.x, Math.min(3.0, ceiling - 0.6), r.pos.z);
    const y = Math.max(2.2, Math.min(2.6, ceiling - 1.5));
    const ray = new THREE.Raycaster();
    ray.camera = Wd.camera;
    const isWall = h => {
      const g = h.object.geometry, m = h.object.material;
      if (!h.object.isMesh || !g || g.type !== 'PlaneGeometry' || !h.face) return false;
      if (g.parameters.width < 3 || g.parameters.height < 3) return false;
      if (m && !Array.isArray(m) && m.transparent) return false;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      return Math.abs(n.y) < 0.3;
    };
    for (const deg of [0, 12, -12, 24, -24, 36, -36, 50, -50]) {
      const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), deg * Math.PI / 180);
      ray.set(origin, dir); ray.near = 3; ray.far = 30;
      const hits = ray.intersectObjects(set.scene.children, true).filter(h => h.object.isMesh && !(h.object.material && h.object.material.transparent));
      const first = hits[0];
      if (!first || !isWall(first)) continue;    // an opening, a door or a prop is in the way
      const n = first.face.normal.clone().transformDirection(first.object.matrixWorld);
      if (n.dot(dir) > 0) n.negate();
      n.y = 0; n.normalize();
      return { pos: new THREE.Vector3(first.point.x, y, first.point.z).addScaledVector(n, 0.08), normal: n };
    }
    return { pos: new THREE.Vector3(origin.x + fwd.x * 5, y, origin.z + fwd.z * 5), normal: fwd.clone().negate() };
  }

  return { make, hang, repaint, wallSpot, size: { w: W, h: H } };
})();
