/* ==========================================================================
   The silver dagger: the weapon a team can earn in the Ghost's library (the
   quiz's bonus question). The ghost holds it out, the team takes it, and
   when the demon gives chase it comes up in first person, glowing, and one
   thrust drives the demon off. Who holds it is a team flag (js/state.js);
   the chase itself is in js/cinematics.js (demonChase).
   ========================================================================== */

window.HH = window.HH || {};

HH.Weapon = (function () {
  // In hand: low and to the right of the view, the tip pointing ahead.
  const HOLD = new THREE.Vector3(0.2, -0.2, -0.52);
  // take: 0 in the air (st.pos), 1 in hand · raise: 0 below the view, 1 up · thrust: the stab
  const st = { show: 0, take: 0, raise: 0, thrust: 0, glow: 0, pos: new THREE.Vector3() };
  let g = null, mats = [], halo = null;
  const off = new THREE.Vector3(), hp = new THREE.Vector3(), e = new THREE.Euler();
  const fq = new THREE.Quaternion(), hq = new THREE.Quaternion(), q = new THREE.Quaternion();
  const tw = (dur, fn, ease) => HH.Tween.add({ dur, update: fn, ease });

  function build() {
    const P = HH.Props, at = P.at;
    g = new THREE.Group();
    const silver = P.mat({ color: 0xdfe8f0, metalness: 0.75, roughness: 0.2, emissive: 0x7fa8d8 });
    const steel = P.mat({ color: 0x9aa4ae, metalness: 0.8, roughness: 0.35, emissive: 0x2a3a50 });
    const leather = P.mat({ color: 0x2a1810, roughness: 0.9 });
    mats = [silver, steel];

    // The blade: a long leaf, sharp at the tip.
    const sh = new THREE.Shape();
    sh.moveTo(-0.021, 0); sh.lineTo(-0.025, 0.13); sh.quadraticCurveTo(-0.019, 0.25, 0, 0.33);
    sh.quadraticCurveTo(0.019, 0.25, 0.025, 0.13); sh.lineTo(0.021, 0); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 6 });
    geo.translate(0, 0, -0.002);
    g.add(at(new THREE.Mesh(geo, silver), 0, 0.04, 0));
    g.add(at(P.box(0.13, 0.018, 0.028, steel), 0, 0.03, 0));
    for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), steel), s * 0.068, 0.03, 0));
    g.add(at(P.cyl(0.013, 0.015, 0.1, leather, 8), 0, -0.025, 0));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), steel), 0, -0.085, 0));
    // A cold glow around the blade (a sprite, so no light is added to the room).
    halo = P.glowSprite(0x9cc8ff, 0.6, 0);
    halo.position.y = 0.2;
    g.add(halo);
    g.visible = false;
    HH.World.onFrame(update);
  }

  function update(t) {
    if (!g.visible) return;
    const cam = HH.World.camera, pulse = 0.85 + Math.sin(t * 5) * 0.15;
    mats[0].emissiveIntensity = st.glow * 0.7 * pulse;
    mats[1].emissiveIntensity = st.glow * 0.5;
    halo.material.opacity = Math.min(0.9, st.glow * 0.35 * pulse);
    g.scale.setScalar(Math.max(0.001, st.show));
    // In the air: upright, turning slowly.
    fq.setFromEuler(e.set(0.15, t * 1.3, 0));
    // In hand, following the camera.
    off.copy(HOLD);
    off.y += -(1 - st.raise) * 0.45 + Math.sin(t * 1.6) * 0.005;
    off.x -= st.thrust * 0.14; off.y += st.thrust * 0.1; off.z -= st.thrust * 0.42;
    hp.copy(off).applyQuaternion(cam.quaternion).add(cam.position);
    hq.copy(cam.quaternion).multiply(q.setFromEuler(e.set(-1.2 - st.thrust * 0.25, 0, 0.32 - st.thrust * 0.15)));
    g.position.lerpVectors(st.pos, hp, st.take);
    g.quaternion.copy(fq).slerp(hq, st.take);
  }

  function attach(set) {
    if (!g) build();
    if (g.parent !== set.scene) set.scene.add(g);
    g.visible = true;
  }

  function hide() {
    if (!g) return;
    g.visible = false;
    if (g.parent) g.parent.remove(g);
  }

  return {
    // The ghost holds it out: it appears in the air between `from` and the camera.
    async present(set, from) {
      attach(set);
      const r = HH.World.rig;
      st.pos.lerpVectors(from, r.pos, 0.7).setY(1.5);
      Object.assign(st, { show: 0, take: 0, raise: 1, thrust: 0, glow: 0 });
      HH.Audio.sfx.whoosh(0.4); HH.Audio.sfx.bell(880, 0.25);
      HH.Cine.look([st.pos.x, st.pos.y, st.pos.z], 1.0);
      await tw(1.2, k => { st.show = k; st.glow = 1.8 * k; }, 'out');
      await tw(0.6, k => { st.glow = 1.8 - 0.8 * k; });
    },

    // Into the team's hand, held up a moment, then lowered away.
    async take() {
      HH.Audio.sfx.blade(0.6);
      await tw(0.9, k => { st.take = k; }, 'inOut');
      await HH.Cine.wait(1.0);
      await this.lower();
    },

    // Straight up into view, ready to fight.
    raise(set) {
      attach(set);
      Object.assign(st, { show: 1, take: 1, thrust: 0, glow: 1 });
      HH.Audio.sfx.blade(0.7);
      return tw(0.45, k => { st.raise = k; }, 'out');
    },

    async strike() {
      await tw(0.1, k => { st.thrust = k; st.glow = 1 + k * 1.5; }, 'in');
      await tw(0.5, k => { st.thrust = 1 - k; st.glow = 2.5 - k * 1.5; }, 'out');
    },

    async lower() {
      await tw(0.5, k => { st.raise = 1 - k; }, 'in');
      hide();
    },

    hide
  };
})();
