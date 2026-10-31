/* ==========================================================================
   Set: the entrance hall. Room spans x -8..8, z 0 (front door) .. -20,
   ceiling 9. Staircase along the left wall up to a gallery at y 4.5.
   The door to Room 1 is in the right wall at z -10.
   ========================================================================== */

HH.World.define('entrance_hall', function () {
  const P = HH.Props, Tx = HH.Tex, at = P.at;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020203);
  scene.fog = new THREE.FogExp2(0x07060a, 0.035);
  const rig = new P.LightRig();
  const updaters = [];

  /* ---------- materials ---------- */
  const paper = (w, h) => P.mat({ map: Tx.tiled(Tx.wallpaper('#24161a', '#3c2328', 3), w / 3.2, h / 3.2), roughness: 0.9 });
  const darkWood = P.mat({ map: Tx.tiled(Tx.wood(4, '#24140b', 6), 2, 2), roughness: 0.7 });
  const trim = P.mat({ color: 0x1a0f08, roughness: 0.6 });
  const carpet = P.mat({ color: 0x3a0a0c, roughness: 1 });

  /* ---------- shell ---------- */
  const floorTex = Tx.tiled(Tx.wood(2, '#2e1c10', 8), 3, 4); floorTex.rotation = Math.PI / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), P.mat({ map: floorTex, roughness: 0.55, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -10); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), P.mat({ map: Tx.tiled(Tx.wood(6, '#160c06', 6), 2, 3) }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 9, -10); scene.add(ceil);

  // Wall piece: w wide, h tall, centred at (x, y, z), facing rotation ry.
  const wall = (w, h, x, y, z, ry) => scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), paper(w, h)), x, y, z, 0, ry));
  const HALF = Math.PI / 2;
  wall(20, 9, -8, 4.5, -10, HALF);                         // left
  wall(9.15, 9, 8, 4.5, -4.575, -HALF);                    // right, front part
  wall(9.15, 9, 8, 4.5, -15.425, -HALF);                   // right, back part
  wall(1.7, 5.9, 8, 6.05, -10, -HALF);                     // right, above door
  wall(0.9, 9, -7.55, 4.5, -20, 0);                        // back, left strip
  wall(13.3, 9, 1.35, 4.5, -20, 0);                        // back, main
  wall(1.8, 4.5, -6.2, 2.25, -20, 0);                      // back, below upstairs doorway
  wall(1.8, 1.5, -6.2, 8.25, -20, 0);                      // back, above upstairs doorway
  wall(6.96, 9, -4.52, 4.5, 0, Math.PI);                   // front, left
  wall(6.96, 9, 4.52, 4.5, 0, Math.PI);                    // front, right
  wall(2.08, 5.8, 0, 6.1, 0, Math.PI);                     // front, above door

  // Wainscoting, chair rail and crown moulding.
  const wains = (len, x, z, ry) => {
    scene.add(at(P.box(len, 1.2, 0.06, darkWood), x, 0.6, z, 0, ry));
    scene.add(at(P.box(len, 0.08, 0.12, trim), x, 1.24, z, 0, ry));
    scene.add(at(P.box(len, 0.3, 0.2, trim), x, 8.85, z, 0, ry));
  };
  wains(20, -7.97, -10, HALF); wains(9.15, 7.97, -4.575, HALF); wains(9.15, 7.97, -15.425, HALF);
  wains(16, 0, -19.97, 0); wains(6.96, -4.52, -0.03, 0); wains(6.96, 4.52, -0.03, 0);

  /* ---------- rug ---------- */
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 10.5), P.mat({ map: Tx.rug(), roughness: 1 }));
  rug.rotation.x = -HALF; rug.position.set(0.3, 0.012, -7); scene.add(rug);

  /* ---------- staircase along the left wall ---------- */
  const STEPS = 15, RISE = 0.3, RUN = 0.6, SX = -6.2, SW = 3.2, Z0 = -5;
  for (let i = 0; i < STEPS; i++) {
    const h = (i + 1) * RISE, zc = Z0 - (i + 0.5) * RUN;
    scene.add(at(P.box(SW, h, RUN, darkWood), SX, h / 2, zc));
    scene.add(at(P.box(1.7, 0.025, RUN + 0.01, carpet), SX, h + 0.012, zc));
  }
  const slope = Math.atan2(STEPS * RISE, STEPS * RUN), len = Math.hypot(STEPS * RISE, STEPS * RUN);
  const railX = SX + SW / 2 - 0.08;
  scene.add(at(P.box(0.1, 0.1, len, trim), railX, (STEPS * RISE) / 2 + 1.0, Z0 - (STEPS * RUN) / 2, slope));
  for (let i = 0; i < STEPS; i++) {
    const h = (i + 1) * RISE, zc = Z0 - (i + 0.5) * RUN;
    scene.add(at(P.box(0.045, 0.86, 0.045, trim), railX, h + 0.43, zc));
  }
  scene.add(at(P.box(0.24, 1.35, 0.24, trim), railX, 0.68, Z0 + 0.1));
  scene.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), trim), railX, 1.45, Z0 + 0.1));
  scene.add(at(P.candle(rig, { h: 0.2, r: 0.04, flame: 1.3 }), railX, 1.58, Z0 + 0.1));
  const stairLight = new THREE.PointLight(0xff9440, 1.0, 10, 1.6); stairLight.position.set(railX + 0.4, 2.0, Z0 - 0.2); scene.add(stairLight);
  rig.light(stairLight, { amt: 0.25, speed: 1.2 });

  /* ---------- gallery ---------- */
  scene.add(at(P.box(16, 0.4, 6, darkWood), 0, 4.3, -17));
  scene.add(at(P.box(16, 0.55, 0.16, trim), 0, 4.15, -14.02));
  const galleryRail = SX + SW / 2;
  scene.add(at(P.box(8 - galleryRail, 0.1, 0.1, trim), (8 + galleryRail) / 2, 5.5, -14.05));
  const balN = Math.floor((8 - galleryRail) / 0.32);
  const bal = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.98, 0.045), trim, balN);
  const d = new THREE.Object3D();
  for (let i = 0; i < balN; i++) { d.position.set(galleryRail + 0.16 + i * 0.32, 5.0, -14.05); d.updateMatrix(); bal.setMatrixAt(i, d.matrix); }
  scene.add(bal);
  for (const x of [-3.4, 3.4]) scene.add(at(P.cyl(0.16, 0.2, 4.1, trim, 10), x, 2.05, -14.25));
  const upVoid = P.doorway(1.8, 3, 3, 'dark'); upVoid.position.set(-6.2, 4.5 + 1.5, -21.5); scene.add(upVoid);
  scene.add(at(P.doorFrame(1.8, 3, trim, 0.3), -6.2, 4.5, -19.9));

  /* ---------- front door (behind the camera on arrival) ---------- */
  scene.add(at(P.doorFrame(2.08, 3.2, trim, 0.35), 0, 0, -0.05, 0, Math.PI));
  const outside = P.doorway(2.08, 3.2, 1.5, 'dark'); outside.rotation.y = Math.PI; outside.position.set(0, 1.6, 0.75); scene.add(outside);
  const frontHolder = new THREE.Group(); frontHolder.position.set(1.04, 0, -0.06); frontHolder.rotation.y = Math.PI; scene.add(frontHolder);
  const frontDoor = P.door({ w: 2.08, h: 3.2, tone: '#24140c', hinge: 'left', max: 1.5 });
  frontHolder.add(frontDoor.pivot);

  /* ---------- the door on the right ---------- */
  const rdHolder = new THREE.Group(); rdHolder.position.set(8.0, 0, -10.85); rdHolder.rotation.y = -HALF; scene.add(rdHolder);
  const rightDoor = P.door({ w: 1.7, h: 3.1, tone: '#2e1a10', hinge: 'left', max: 1.4 });
  rdHolder.add(rightDoor.pivot);
  const rdFrame = P.doorFrame(1.7, 3.1, trim, 0.32); rdFrame.position.set(0.85, 0, 0); rdHolder.add(rdFrame);
  const rdBeyond = P.doorway(1.7, 3.1, 2.4, 'warm'); rdBeyond.position.set(0.85, 1.55, -1.25); rdHolder.add(rdBeyond);
  const leak = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), new THREE.MeshBasicMaterial({
    map: Tx.glow(), color: 0xff8a30, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  leak.rotation.x = -HALF; leak.position.set(7.75, 0.02, -10); scene.add(leak);
  for (const z of [-8.75, -11.25]) {
    const s = new THREE.Group(); s.position.set(7.88, 2.35, z); scene.add(s);
    s.add(at(P.box(0.06, 0.32, 0.18, P.brass()), 0, 0, 0));
    s.add(at(P.box(0.22, 0.04, 0.06, P.brass()), -0.1, -0.08, 0));
    s.add(at(P.candle(rig, { h: 0.2, r: 0.03, flame: 1.2 }), -0.2, -0.06, 0));
  }
  const sconceLight = new THREE.PointLight(0xff9440, 1.25, 9, 1.7); sconceLight.position.set(7.0, 2.6, -10); scene.add(sconceLight);
  rig.light(sconceLight, { amt: 0.2 });

  /* ---------- chandelier ---------- */
  const chand = P.chandelier(rig, 2.2); chand.group.position.set(0, 9, -8); scene.add(chand.group);

  /* ---------- clock and candelabras under the gallery ---------- */
  const clock = P.grandfatherClock(); clock.group.position.set(0, 0, -19.55); scene.add(clock.group); updaters.push(clock);
  for (const x of [-2.2, 2.2]) {
    scene.add(at(P.box(0.8, 0.9, 0.5, darkWood), x, 0.45, -19.4));
    scene.add(at(P.candelabra(rig, 3), x, 0.9, -19.4));
  }
  const backLight = new THREE.PointLight(0xff9a48, 0.9, 9, 1.8); backLight.position.set(0, 1.9, -18.4); scene.add(backLight);
  rig.light(backLight, { amt: 0.2 });

  /* ---------- windows, moonlight, paintings, cobwebs ---------- */
  const panes = [];
  for (const x of [-5, 5]) {
    const w = P.windowFrame({ w: 1.4, h: 3.4, kind: 'cold' });
    w.group.position.set(x, 4.6, -0.02); w.group.rotation.y = Math.PI; scene.add(w.group); panes.push(w.pane);
  }
  scene.add(new THREE.HemisphereLight(0x2c3550, 0x0a0705, 0.28));
  const moonLight = new THREE.DirectionalLight(0x8ea6e0, 0.22); moonLight.position.set(2, 12, 14); moonLight.target.position.set(0, 0, -10);
  scene.add(moonLight, moonLight.target);

  const paintings = [];
  const hang = (seed, x, y, z, ry, w = 1.1, h = 1.4) => { const p = P.painting({ w, h, seed }); at(p.group, x, y, z, 0, ry); scene.add(p.group); paintings.push(p); };
  hang(1, -7.96, 4.4, -7.4, HALF);
  hang(2, -7.96, 6.4, -11.6, HALF, 1.0, 1.3);
  hang(5, 7.96, 2.7, -15.8, -HALF, 0.9, 1.1);
  hang(3, 2.6, 6.7, -19.96, 0, 1.5, 1.9);

  // The Master of the House (the host) greets everyone from the right-hand wall by the entrance.
  const master = HH.HostPortrait.hang(scene, { pos: [7.9, 3.55, -4.4], ry: -HALF });
  hang(7, 6.0, 6.5, -19.96, 0, 1.0, 1.3);

  const web = (x, y, z, ry, flip) => { const w = P.cobweb(1.6); at(w, x, y, z, 0, ry); if (flip) w.scale.x = -1; scene.add(w); };
  web(-8, 9, -19.96, 0); web(8, 9, -19.96, 0, true); web(-7.96, 9, -20, HALF, true);
  web(8, 4.1, -19.96, 0, true); web(-7.96, 9, -0.02, HALF); web(7.96, 9, -0.02, -HALF, true);

  /* ---------- atmosphere ---------- */
  const fog = P.fogLayer({ count: 20, w: 15, d: 19, x: 0, z: -10, y: 0.15, size: 4.5, color: 0x8a8a9c, opacity: 0.1, speed: 0.05, spread: 0.5 });
  scene.add(fog.group); updaters.push(fog);
  const dust = P.dust({ count: 320, w: 12, h: 6, d: 15, x: 0, y: 3.6, z: -9 });
  scene.add(dust.points); updaters.push(dust);

  const shadow = P.shadowFigure(2.8); at(shadow, -7.9, 4.6, -16, 0, HALF); scene.add(shadow);
  let shadowT = -1, nextShadow = 18;

  // The demon (HH.Demon) is brought in by the staircase death; this set owns no monster.

  const set = {
    scene, lights: rig, ambience: 'interior', autoLightning: [10, 22], flashScale: 0.12,
    home: { pos: new THREE.Vector3(0.3, 1.75, -1.3), look: new THREE.Vector3(0.3, 2.5, -12) },
    anchors: {
      stairs: new THREE.Vector3(-6.2, 2.4, -8.6),
      rightDoor: new THREE.Vector3(7.9, 2.1, -10),
      upstairs: new THREE.Vector3(-6.2, 6, -19.6),
      clock: new THREE.Vector3(0, 1.9, -19.4),
      hostPortrait: master.anchor
    },
    hostPortrait: master,
    stairs: { x: SX, z0: Z0, rise: RISE, run: RUN, steps: STEPS },
    frontDoor, rightDoor, chandelier: chand, leak, paintings,
    ceiling: 9,
    doorAt: { rightDoor },

    setPaintingEyes(v) { paintings.forEach(p => p.setEyes(v)); },

    passShadow() { shadowT = 0; },

    setFlash(f) {
      moonLight.intensity = 0.22 + f * 3.2;
      panes.forEach(p => p.material.color.setScalar(0.65 + f * 2.5));
    },

    onEnter() {
      HH.Audio.clock(true);
      rig.darkness = 0; rig.chaos = 0;
      set.setPaintingEyes(0);
      rightDoor.set(0);
      frontDoor.set(0);
    },
    onExit() { HH.Audio.clock(false); HH.Audio.heartbeat(0); },

    update(t, dt) {
      updaters.forEach(u => u.update(t));
      chand.group.rotation.z = Math.sin(t * 0.5) * 0.012;
      chand.group.rotation.x = Math.sin(t * 0.37) * 0.01;
      leak.material.opacity = (0.45 + Math.sin(t * 7) * 0.05) * rig.blackout * (1 - rig.darkness) * (Math.sin(t * 0.21) > 0.97 ? 0.15 : 1);
      if (shadowT < 0 && t > nextShadow) { shadowT = 0; nextShadow = t + 20 + Math.random() * 20; }
      if (shadowT >= 0) {
        shadowT += dt;
        const k = shadowT / 5;
        shadow.position.z = -16 + k * 13;
        shadow.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.55;
        if (k >= 1) { shadowT = -1; shadow.material.opacity = 0; }
      }
    }
  };
  return set;
});
