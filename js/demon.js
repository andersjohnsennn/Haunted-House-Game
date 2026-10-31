/* ==========================================================================
   The demon. ONE creature hunts both teams through the whole house: the
   same model (HH.Props.creature), the same eyes, the same jumpscare face
   (HH.Tex.faceCanvas) and the same scream. It is re-parented into whichever
   set it appears in; nothing else in the game ever kills a team.
   ========================================================================== */

window.HH = window.HH || {};

HH.Demon = (function () {
  let c = null, root = null, body = null, glow = null;

  function ensure() {
    if (c) return;
    c = HH.Props.creature();
    root = new THREE.Group();
    body = new THREE.Group();
    body.add(c.group);
    root.add(body);
    // A red glow behind it: a dark silhouette with a red rim, readable in any room.
    glow = new THREE.PointLight(0xff3a24, 0, 3.5, 2);
    glow.position.set(0, 1.7, -0.9);
    body.add(glow);
    root.visible = false;
    HH.World.onFrame(t => {
      if (!root.parent || !root.visible) return;
      c.update(t);
      glow.intensity = 0.8 + Math.sin(t * 9) * 0.15;
    });
  }

  return {
    get root() { ensure(); return root; },
    get creature() { ensure(); return c; },

    // Bring it into a set (hidden until placed). Quick mode may speed up a
    // death's build-up, but the demon itself always plays at normal speed.
    enter(set) {
      ensure();
      if (HH.Tween.speed > 1 && HH.Tween.speed < 4) HH.Tween.speed = 1;
      if (root.parent !== set.scene) set.scene.add(root);
      root.visible = true;
      this.pose('stand');
      c.setReach(0);
      c.setEyes(1);
      return root;
    },

    leave() {
      if (!root) return;
      if (root.parent) root.parent.remove(root);
      root.visible = false;
    },

    // Feet at `pos`, facing `faceTo` (usually the camera).
    place(pos, faceTo) {
      ensure();
      root.position.copy(pos);
      if (faceTo) root.rotation.y = Math.atan2(faceTo.x - pos.x, faceTo.z - pos.z);
    },

    face(target) { root.rotation.y = Math.atan2(target.x - root.position.x, target.z - root.position.z); },

    // stand: upright · crawl: prone, head ~2.3 m ahead of the root · hang: upside down from the root
    pose(name) {
      ensure();
      body.rotation.set(0, 0, 0);
      body.position.set(0, 0, 0);
      c.setPitch(0);
      if (name === 'crawl') { body.rotation.x = 1.25; body.position.y = 0.2; c.setReach(0.7); c.setPitch(-1.3); }
      if (name === 'hang') { body.rotation.z = Math.PI; c.setReach(0.3); }
    }
  };
})();
