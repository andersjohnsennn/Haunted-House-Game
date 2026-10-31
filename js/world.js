/* ==========================================================================
   World: renderer, first-person camera rig, tweens, lightning and the
   registry of 3D sets. Each set is its own THREE.Scene; only one renders.
   ========================================================================== */

window.HH = window.HH || {};

HH.Ease = {
  linear: k => k,
  inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  in: k => k * k * k,
  out: k => 1 - Math.pow(1 - k, 3),
  inQuad: k => k * k,
  outQuad: k => 1 - (1 - k) * (1 - k),
  sine: k => -(Math.cos(Math.PI * k) - 1) / 2
};

// Time-based tweens. HH.Tween.speed > 1 fast-forwards every cutscene.
HH.Tween = (function () {
  const list = [];
  let speed = 1;
  function add({ dur, update, ease = 'inOut' }) {
    return new Promise(res => {
      list.push({ t: 0, dur: Math.max(0.0001, dur), update, ease: typeof ease === 'function' ? ease : HH.Ease[ease], res });
    });
  }
  function tick(dt) {
    const d = dt * speed;
    for (let i = list.length - 1; i >= 0; i--) {
      const tw = list[i];
      tw.t += d;
      const k = Math.min(1, tw.t / tw.dur);
      tw.update(tw.ease(k), k);
      if (k >= 1) { list.splice(i, 1); tw.res(); }
    }
  }
  return {
    add, tick,
    wait: s => add({ dur: s, update() {}, ease: 'linear' }),
    get speed() { return speed; },
    set speed(v) { speed = v; }
  };
})();

HH.World = (function () {
  let renderer, camera, clock, current = null, time = 0;
  const builders = {}, sets = {}, frameHooks = [];
  const flashQueue = [];
  let flash = 0, nextBolt = 6;
  let fxFlash = null;

  const rig = {
    pos: new THREE.Vector3(0, 1.7, 0),
    look: new THREE.Vector3(0, 1.7, -1),
    roll: 0, trauma: 0, fovKick: 0,
    walk: 0, walkPhase: 0, stepRate: 1.7, steps: null,
    sway: 1
  };

  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 700);
    fxFlash = document.getElementById('fx-flash');
    resize();
    window.addEventListener('resize', resize);
    clock = new THREE.Clock();
    requestAnimationFrame(loop);
  }

  // Keep roughly the same horizontal view on 16:9 TVs and 4:3 projectors.
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const v = 2 * Math.atan(Math.tan(96 * Math.PI / 360) / camera.aspect) * 180 / Math.PI;
    camera.userData.baseFov = Math.max(52, Math.min(80, v));
    camera.fov = camera.userData.baseFov + rig.fovKick;
    camera.updateProjectionMatrix();
  }

  function define(name, builder) { builders[name] = builder; }

  function keyOf(spec) { return typeof spec === 'string' ? spec : JSON.stringify(spec); }

  function build(spec) {
    const key = keyOf(spec);
    if (sets[key]) return sets[key];
    const name = typeof spec === 'string' ? spec : spec.template;
    const builder = builders[name] || builders.corridor;
    const set = builder(typeof spec === 'string' ? {} : spec);
    set.key = key;
    sets[key] = set;
    return set;
  }

  function use(spec) {
    const set = build(spec);
    if (current !== set) {
      if (current && current.onExit) current.onExit();
      current = set;
      if (set.onEnter) set.onEnter();
      HH.Audio.ambience(set.ambience || 'interior');
      nextBolt = time + 3 + Math.random() * 6;
    }
    return set;
  }

  function home(set = current) {
    rig.pos.copy(set.home.pos);
    rig.look.copy(set.home.look);
  }

  // Build and compile every set up front so nothing stutters mid-cutscene.
  function prewarm(specs) {
    specs.forEach(spec => {
      const s = build(spec);
      try { renderer.compile(s.scene, camera); } catch (e) { /* compile is best effort */ }
    });
  }

  function lightning(strength = 1, thunder = true) {
    const start = time;
    [[0, 1], [0.06, 0.12], [0.11, 0.85], [0.19, 0.25], [0.27, 0.6], [0.42, 0.05], [0.6, 0]].forEach(([d, l]) => {
      flashQueue.push({ at: start + d + Math.random() * 0.03, l: l * strength });
    });
    if (thunder) setTimeout(() => HH.Audio.sfx.thunder(Math.max(0.05, 0.85 - strength * 0.7)), 250 + (1 - strength) * 1600);
  }

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), lookTmp = new THREE.Vector3();

  function updateCamera(dt) {
    rig.trauma = Math.max(0, rig.trauma - dt * 1.1);
    const sh = rig.trauma * rig.trauma;

    if (rig.walk > 0.01) {
      const prev = rig.walkPhase;
      rig.walkPhase += dt * HH.Tween.speed * Math.PI * rig.stepRate;
      const a = Math.floor(prev / Math.PI), b = Math.floor(rig.walkPhase / Math.PI);
      if (a !== b && rig.steps) HH.Audio.sfx.step(rig.steps, 0.45 * Math.min(1, rig.walk), b % 2 ? 0.25 : -0.25);
    }
    const w = rig.walk;
    const bobY = (Math.abs(Math.sin(rig.walkPhase)) - 0.5) * 0.08 * w;
    const bobX = Math.sin(rig.walkPhase) * 0.035 * w;
    const br = rig.sway;
    const nx = (Math.sin(time * 47.3) + Math.sin(time * 31.1 + 1)) * 0.5;
    const ny = (Math.sin(time * 43.7 + 2) + Math.sin(time * 29.3 + 3)) * 0.5;
    const nr = Math.sin(time * 39.1 + 4);

    fwd.subVectors(rig.look, rig.pos).normalize();
    right.crossVectors(fwd, up).normalize();
    camera.position.copy(rig.pos)
      .addScaledVector(right, bobX + Math.sin(time * 0.6) * 0.008 * br + nx * 0.12 * sh);
    camera.position.y += bobY + Math.sin(time * 1.1) * 0.012 * br + ny * 0.1 * sh;

    lookTmp.copy(rig.look);
    lookTmp.addScaledVector(right, Math.sin(time * 0.37) * 0.04 * br + nx * 0.4 * sh);
    lookTmp.y += Math.sin(time * 0.29) * 0.025 * br + ny * 0.35 * sh;
    camera.lookAt(lookTmp);
    camera.rotateZ(rig.roll + nr * 0.05 * sh + Math.sin(rig.walkPhase) * 0.005 * w);

    const fov = camera.userData.baseFov + rig.fovKick;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    time += dt;
    HH.Tween.tick(dt);

    while (flashQueue.length && flashQueue[0].at <= time) flash = flashQueue.shift().l;
    if (current && current.autoLightning && time > nextBolt) {
      const [lo, hi] = current.autoLightning;
      nextBolt = time + lo + Math.random() * (hi - lo);
      lightning(0.35 + Math.random() * 0.65);
    }

    if (current) {
      if (current.lights) current.lights.update(time);
      if (current.setFlash) current.setFlash(flash);
      if (current.update) current.update(time, dt);
    }
    if (fxFlash) fxFlash.style.opacity = (flash * (current ? current.flashScale || 0.3 : 0.3)).toFixed(3);
    updateCamera(dt);
    frameHooks.forEach(f => f(time, dt));
    if (current) renderer.render(current.scene, camera);
  }

  const proj = new THREE.Vector3();
  function project(v) {
    proj.copy(v).project(camera);
    const behind = proj.z > 1;
    return {
      x: (proj.x * 0.5 + 0.5) * window.innerWidth,
      y: (-proj.y * 0.5 + 0.5) * window.innerHeight,
      nx: proj.x, ny: proj.y, behind,
      on: !behind && Math.abs(proj.x) <= 0.92 && Math.abs(proj.y) <= 0.9
    };
  }

  return {
    init, define, use, home, prewarm, lightning, project, rig,
    // A set without switching to it (built on first use), e.g. to tidy it before it's shown.
    peek: build,
    shake(a) { rig.trauma = Math.min(1, rig.trauma + a); },
    onFrame(fn) { frameHooks.push(fn); },
    get camera() { return camera; },
    get renderer() { return renderer; },
    get current() { return current; },
    get time() { return time; },
    set(spec) { return build(spec); }
  };
})();
