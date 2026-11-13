// Characters and props built from simple shapes. Every character faces +z.

const Models = (() => {
  const materials = new Map();

  function mat(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (!materials.has(key)) {
      const m = new THREE.MeshLambertMaterial(Object.assign({ color }, opts));
      m.userData.shared = true;
      materials.set(key, m);
    }
    return materials.get(key);
  }

  function mesh(geometry, color, x = 0, y = 0, z = 0, opts) {
    const m = new THREE.Mesh(geometry, mat(color, opts));
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  const sphere = (r, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, (seg * 0.75) | 0));
  const cylinder = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const cone = (r, h, seg = 14) => new THREE.ConeGeometry(r, h, seg);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  const SKIN = 0xf1c27d;

  // A long, slim, snake-like dragon. The body is a chain of segments that poseDragon bends into
  // waves; the head stays steady at the front and the tail swings the most.
  const DRAGON_SEGMENTS = 16;
  const SEGMENT_GAP = 0.36;

  function dragon({ body = 0x63c74d, belly = 0xf5d76e, wing = 0x9be27e, spikes = 0xff9a3c } = {}) {
    const g = new THREE.Group();
    const segments = [];
    for (let i = 0; i < DRAGON_SEGMENTS; i++) {
      const t = i / (DRAGON_SEGMENTS - 1);
      const r = 0.34 * (1 - t * 0.72) + 0.05 * Math.sin(t * Math.PI);
      const seg = new THREE.Group();
      const scale = mesh(sphere(r, 12), body);
      scale.scale.set(1, 0.9, 1.3);
      seg.add(scale);
      const under = mesh(sphere(r * 0.8, 10), belly, 0, -r * 0.35, 0);
      under.scale.set(0.9, 0.7, 1.3);
      seg.add(under);
      if (i % 2 === 0 && i < DRAGON_SEGMENTS - 1) {
        const spike = mesh(cone(0.06 + r * 0.2, 0.15 + r * 0.5, 6), spikes, 0, r * 0.85, 0);
        spike.rotation.x = -0.4;
        seg.add(spike);
      }
      seg.userData = { z: 0.5 - i * SEGMENT_GAP, t };
      g.add(seg);
      segments.push(seg);
    }
    const last = segments[segments.length - 1];
    const tip = mesh(cone(0.16, 0.45, 4), spikes, 0, 0, -0.3);
    tip.rotation.x = -Math.PI / 2;
    last.add(tip);

    for (const i of [2, 9]) {
      for (const s of [-1, 1]) {
        const leg = mesh(cylinder(0.07, 0.06, 0.45, 6), body, s * 0.26, -0.28, 0);
        leg.rotation.z = s * 0.5;
        segments[i].add(leg);
        segments[i].add(mesh(sphere(0.1, 8), body, s * 0.38, -0.48, 0.06));
      }
    }

    const head = new THREE.Group();
    head.position.set(0, 0.95, 0.95);
    g.add(head);
    head.add(mesh(sphere(0.48), body));
    const snout = mesh(sphere(0.33), body, 0, -0.1, 0.4);
    snout.scale.set(0.95, 0.72, 1.2);
    head.add(snout);
    for (const s of [-1, 1]) {
      head.add(mesh(sphere(0.05, 8), 0x2d5a27, s * 0.1, -0.02, 0.78));
      head.add(mesh(sphere(0.16), 0xffffff, s * 0.21, 0.14, 0.32));
      head.add(mesh(sphere(0.09), 0x111111, s * 0.23, 0.16, 0.45));
      head.add(mesh(sphere(0.03, 8), 0xffffff, s * 0.2, 0.22, 0.53));
      const cheek = mesh(sphere(0.1), 0xff9fb0, s * 0.33, -0.1, 0.3);
      cheek.scale.set(1, 0.6, 0.4);
      head.add(cheek);
      const horn = mesh(cone(0.08, 0.36, 8), 0xfff1c9, s * 0.2, 0.45, -0.12);
      horn.rotation.x = -0.5;
      head.add(horn);
      const whisker = mesh(cylinder(0.015, 0.008, 0.8, 4), 0xfff1c9, s * 0.42, -0.12, 0.62);
      whisker.rotation.set(0.3, 0, s * 1.2);
      head.add(whisker);
    }
    const mouth = new THREE.Object3D();
    mouth.position.set(0, -0.12, 0.85);
    head.add(mouth);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0.3);
    wingShape.lineTo(1.7, 0.7);
    wingShape.lineTo(1.5, -0.1);
    wingShape.lineTo(1.0, -0.45);
    wingShape.lineTo(0.5, -0.3);
    wingShape.lineTo(0, -0.4);
    const wingGeometry = new THREE.ShapeGeometry(wingShape);
    wingGeometry.rotateX(-Math.PI / 2);
    const wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.2, 0.25, 0);
      const w = mesh(wingGeometry, wing, 0, 0, 0, { side: THREE.DoubleSide });
      w.scale.set(s * 0.75, 1, 0.75);
      pivot.add(w);
      pivot.userData.side = s;
      segments[2].add(pivot);
      wings.push(pivot);
    }

    g.userData = { head, mouth, wings, segments };
    poseDragon(g, 0, 0, 0);
    return g;
  }

  // Bends the dragon's body into a wave running from head to tail. lateral and vertical are how
  // far it swings sideways and up and down; phase moves the wave along.
  function poseDragon(g, phase, lateral, vertical) {
    for (const [i, seg] of g.userData.segments.entries()) {
      const t = seg.userData.t;
      const a = phase - i * 0.55;
      const reach = 0.2 + t * 0.8;
      seg.position.set(Math.sin(a) * lateral * reach, 0.62 - t * 0.3 + Math.sin(a + 1.3) * vertical * reach, seg.userData.z);
      seg.rotation.y = -Math.cos(a) * lateral * reach * 1.2;
    }
  }

  function mustache(parent, y, z, size) {
    for (const s of [-1, 1]) {
      const half = mesh(sphere(0.1 * size), 0x1a1a1a, s * 0.13 * size, y, z);
      half.scale.set(2.2, 0.65, 0.8);
      half.rotation.z = s * 0.3;
      parent.add(half);
      const curl = mesh(new THREE.TorusGeometry(0.06 * size, 0.025 * size, 6, 12), 0x1a1a1a, s * 0.33 * size, y + 0.06 * size, z - 0.02);
      parent.add(curl);
    }
  }

  // A rifle that shoots nets: wooden stock, long barrel, a funnel at the end.
  function netRifle(barrelColor = 0x555555, funnelColor = 0xc9a227) {
    const g = new THREE.Group();
    g.add(mesh(box(0.14, 0.2, 0.6), 0x7a4a21, 0, 0, -0.1));
    const barrel = mesh(cylinder(0.06, 0.06, 1.0, 10), barrelColor, 0, 0.05, 0.65);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
    const funnel = mesh(cylinder(0.18, 0.07, 0.25, 12), funnelColor, 0, 0.05, 1.25);
    funnel.rotation.x = Math.PI / 2;
    g.add(funnel);
    return g;
  }

  function wizard() {
    const g = new THREE.Group();
    g.add(mesh(cone(1.0, 2.4, 20), 0x5b2a86, 0, 1.2, 0));
    const collar = mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 20), 0xd4af37, 0, 2.25, 0);
    collar.rotation.x = Math.PI / 2;
    g.add(collar);
    for (const [x, y, z] of [[0.3, 0.9, 0.82], [-0.4, 1.5, 0.6], [0.1, 0.4, 0.95]]) g.add(mesh(new THREE.OctahedronGeometry(0.12), 0xffd700, x, y, z));

    const head = new THREE.Group();
    head.position.set(0, 2.65, 0);
    g.add(head);
    head.add(mesh(sphere(0.45), SKIN));
    head.add(mesh(sphere(0.12), 0xe0a060, 0, -0.02, 0.45));
    for (const s of [-1, 1]) {
      head.add(mesh(sphere(0.07, 8), 0x111111, s * 0.16, 0.1, 0.39));
      const brow = mesh(box(0.22, 0.05, 0.05), 0x1a1a1a, s * 0.17, 0.22, 0.4);
      brow.rotation.z = s * -0.45;
      head.add(brow);
    }
    mustache(head, -0.16, 0.42, 1.5);
    head.add(mesh(cylinder(0.75, 0.75, 0.06, 24), 0x3d1a5e, 0, 0.32, 0));
    const hat = mesh(cone(0.5, 1.5, 18), 0x3d1a5e, 0.05, 1.05, -0.05);
    hat.rotation.z = -0.12;
    head.add(hat);
    for (const [x, y, z] of [[0.25, 0.7, 0.33], [-0.2, 1.0, 0.25], [0.1, 1.35, 0.15]]) head.add(mesh(new THREE.OctahedronGeometry(0.08), 0xffd700, x, y, z));

    for (const s of [-1, 1]) {
      const arm = mesh(cylinder(0.14, 0.18, 0.9, 10), 0x5b2a86, s * 0.45, 1.85, 0.35);
      arm.rotation.x = -1.2;
      g.add(arm);
      g.add(mesh(sphere(0.12), SKIN, s * 0.3, 1.7, 0.75));
    }
    const rifle = netRifle(0x333333, 0xd4af37);
    rifle.position.set(0.15, 1.75, 0.6);
    g.add(rifle);
    g.scale.setScalar(1.2);
    g.userData = { head, height: 4.4 };
    return g;
  }

  function guard(withGun) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) g.add(mesh(cylinder(0.17, 0.17, 0.9, 10), 0x223366, s * 0.22, 0.45, 0));
    g.add(mesh(cylinder(0.45, 0.5, 1.1, 16), 0xc0392b, 0, 1.45, 0));
    g.add(mesh(cylinder(0.51, 0.51, 0.12, 16), 0x222222, 0, 1.05, 0));
    for (const y of [1.25, 1.5, 1.75]) g.add(mesh(sphere(0.06, 8), 0xffd700, 0, y, 0.47));
    const head = new THREE.Group();
    head.position.set(0, 2.35, 0);
    g.add(head);
    head.add(mesh(sphere(0.38), SKIN));
    head.add(mesh(sphere(0.08, 8), 0xe0a060, 0, -0.02, 0.38));
    for (const s of [-1, 1]) head.add(mesh(sphere(0.055, 8), 0x111111, s * 0.13, 0.07, 0.33));
    mustache(head, -0.13, 0.35, 1);
    head.add(mesh(cylinder(0.32, 0.36, 0.45, 16), 0x222222, 0, 0.45, 0));
    head.add(mesh(cylinder(0.37, 0.37, 0.1, 16), 0xc0392b, 0, 0.27, 0));
    for (const s of [-1, 1]) {
      const arm = mesh(cylinder(0.12, 0.12, 0.85, 10), 0xc0392b, s * 0.58, withGun ? 1.75 : 1.5, withGun ? 0.3 : 0);
      if (withGun) arm.rotation.x = -1.3;
      else arm.rotation.z = s * 0.2;
      g.add(arm);
    }
    if (withGun) {
      const rifle = netRifle();
      rifle.position.set(0.2, 1.7, 0.55);
      g.add(rifle);
    }
    g.userData = { head, height: 3.3 };
    return g;
  }

  function robot() {
    const g = new THREE.Group();
    for (const s of [-1, 1]) g.add(mesh(box(0.35, 0.5, 1.3), 0x333333, s * 0.45, 0.25, 0));
    g.add(mesh(box(1.1, 1.2, 0.9), 0x9aa4ad, 0, 1.2, 0));
    g.add(mesh(box(0.5, 0.3, 0.05), 0x2ecc71, 0, 1.35, 0.46, { emissive: 0x1a7a40 }));
    const head = new THREE.Group();
    head.position.set(0, 2.1, 0);
    g.add(head);
    head.add(mesh(box(0.8, 0.6, 0.7), 0xb8c2cc));
    head.add(mesh(box(0.6, 0.15, 0.05), 0xff2222, 0, 0.05, 0.36, { emissive: 0xcc0000 }));
    head.add(mesh(cylinder(0.03, 0.03, 0.5, 6), 0x555555, 0, 0.55, 0));
    head.add(mesh(sphere(0.09, 8), 0xff2222, 0, 0.82, 0, { emissive: 0xaa0000 }));
    for (const s of [-1, 1]) {
      const arm = mesh(cylinder(0.1, 0.1, 0.9, 8), 0x777777, s * 0.7, 1.3, 0.25);
      arm.rotation.x = -1.0;
      g.add(arm);
      g.add(mesh(box(0.25, 0.25, 0.25), 0x555555, s * 0.7, 1.05, 0.65));
    }
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 10, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(0, -0.6, 5.2);
    head.add(beam);
    g.userData = { head, beam, height: 3.3 };
    return g;
  }

  function dog({ fur = 0x8b5a2b, snout = 0xd2a679, ear = 0x5a3a1a, wolf = false } = {}) {
    const g = new THREE.Group();
    const torso = mesh(sphere(0.5), fur, 0, 0.75, 0);
    torso.scale.set(0.8, 0.75, 1.4);
    g.add(torso);
    for (const [x, z] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]]) g.add(mesh(cylinder(0.09, 0.09, 0.5, 8), fur, x, 0.25, z));
    const head = new THREE.Group();
    head.position.set(0, 1.15, 0.7);
    g.add(head);
    head.add(mesh(sphere(0.32), fur));
    const muzzle = mesh(sphere(0.18), snout, 0, -0.08, wolf ? 0.32 : 0.27);
    if (wolf) muzzle.scale.set(1, 0.9, 1.5);
    head.add(muzzle);
    head.add(mesh(sphere(0.07, 8), 0x111111, 0, -0.02, wolf ? 0.58 : 0.45));
    for (const s of [-1, 1]) {
      head.add(mesh(sphere(0.05, 8), wolf ? 0xffd34d : 0x111111, s * 0.13, 0.1, 0.26));
      if (wolf) {
        head.add(mesh(cone(0.1, 0.3, 4), ear, s * 0.18, 0.35, -0.02));
      } else {
        const flop = mesh(box(0.12, 0.3, 0.18), ear, s * 0.3, 0.05, -0.02);
        flop.rotation.z = s * 0.3;
        head.add(flop);
      }
    }
    if (!wolf) {
      const collar = mesh(cylinder(0.33, 0.33, 0.1, 14), 0xc0392b, 0, 1.0, 0.55);
      collar.rotation.x = 0.6;
      g.add(collar);
    }
    const tail = mesh(cylinder(0.05, wolf ? 0.14 : 0.08, 0.5, 6), fur, 0, 1.05, -0.75);
    tail.rotation.x = -0.6;
    g.add(tail);
    g.userData = { head, tail, height: 2.0 };
    return g;
  }

  function wolf() {
    return dog({ fur: 0x8d939a, snout: 0xd8dde0, ear: 0x6b7178, wolf: true });
  }

  // A circus bear standing on its hind legs, with a little party hat and a bow tie.
  function bear() {
    const g = new THREE.Group();
    const fur = 0x7a4b2a;
    for (const s of [-1, 1]) g.add(mesh(cylinder(0.28, 0.32, 0.8, 10), fur, s * 0.35, 0.4, 0));
    const torso = mesh(sphere(0.9), fur, 0, 1.6, 0);
    torso.scale.set(1, 1.15, 0.9);
    g.add(torso);
    const tummy = mesh(sphere(0.6), 0xc49a6c, 0, 1.5, 0.4);
    tummy.scale.set(1, 1.2, 0.6);
    g.add(tummy);
    for (const s of [-1, 1]) {
      const arm = mesh(cylinder(0.2, 0.24, 0.9, 10), fur, s * 0.85, 1.9, 0.35);
      arm.rotation.x = -1.0;
      arm.rotation.z = s * 0.3;
      g.add(arm);
    }
    const head = new THREE.Group();
    head.position.set(0, 2.85, 0.1);
    g.add(head);
    head.add(mesh(sphere(0.55), fur));
    head.add(mesh(sphere(0.25), 0xc49a6c, 0, -0.1, 0.45));
    head.add(mesh(sphere(0.09, 8), 0x111111, 0, -0.02, 0.68));
    for (const s of [-1, 1]) {
      head.add(mesh(sphere(0.07, 8), 0x111111, s * 0.2, 0.12, 0.45));
      head.add(mesh(sphere(0.18), fur, s * 0.4, 0.45, -0.05));
    }
    head.add(mesh(cone(0.25, 0.6, 12), 0x2a9d8f, 0.1, 0.75, 0));
    head.add(mesh(sphere(0.08, 8), 0xffd60a, 0.1, 1.08, 0));
    for (const s of [-1, 1]) {
      const bow = mesh(cone(0.14, 0.3, 4), 0xd62828, s * 0.15, 2.32, 0.65);
      bow.rotation.z = s * -Math.PI / 2;
      g.add(bow);
    }
    g.userData = { head, height: 4.1 };
    return g;
  }

  function scorpion() {
    const g = new THREE.Group();
    const shell = 0xb5651d;
    const body = mesh(sphere(0.6), shell, 0, 0.45, 0);
    body.scale.set(1, 0.45, 1.4);
    g.add(body);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const leg = mesh(cylinder(0.05, 0.05, 0.8, 6), 0x8a4a14, s * 0.6, 0.3, 0.35 - i * 0.35);
        leg.rotation.z = s * 1.0;
        g.add(leg);
      }
      const arm = mesh(cylinder(0.08, 0.08, 0.7, 6), shell, s * 0.4, 0.4, 0.95);
      arm.rotation.x = Math.PI / 2;
      arm.rotation.z = s * -0.4;
      g.add(arm);
      const claw = mesh(sphere(0.18), shell, s * 0.55, 0.42, 1.35);
      claw.scale.set(0.8, 0.6, 1.3);
      g.add(claw);
      g.add(mesh(sphere(0.06, 8), 0x111111, s * 0.15, 0.62, 0.7));
    }
    const head = new THREE.Group();
    head.position.set(0, 0.5, -0.8);
    g.add(head);
    const tail = new THREE.Group();
    tail.position.set(0, 0.5, -0.8);
    g.add(tail);
    // The tail curls up and over the back.
    [[0.1, -0.3], [0.45, -0.55], [0.85, -0.55], [1.15, -0.3], [1.25, 0.05]].forEach(([y, z], i) => tail.add(mesh(sphere(0.2 - i * 0.02), shell, 0, y, z)));
    const sting = mesh(cone(0.1, 0.35, 6), 0x3a1a0a, 0, 1.12, 0.3);
    sting.rotation.x = Math.PI * 0.75;
    tail.add(sting);
    g.userData = { head, tail, height: 2.1 };
    return g;
  }

  function wings(g, color, span, y, z) {
    const list = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.2, y, z);
      const w = mesh(box(span, 0.06, span * 0.45), color, s * span * 0.5, 0, 0);
      pivot.add(w);
      pivot.userData.side = s;
      g.add(pivot);
      list.push(pivot);
    }
    return list;
  }

  function eagle() {
    const g = new THREE.Group();
    const body = mesh(sphere(0.5), 0x6b4423, 0, 0, 0);
    body.scale.set(0.8, 0.7, 1.5);
    g.add(body);
    const head = new THREE.Group();
    head.position.set(0, 0.25, 0.75);
    g.add(head);
    head.add(mesh(sphere(0.3), 0xffffff));
    const beak = mesh(cone(0.1, 0.35, 8), 0xffc300, 0, -0.05, 0.35);
    beak.rotation.x = Math.PI / 2;
    head.add(beak);
    for (const s of [-1, 1]) head.add(mesh(sphere(0.05, 8), 0x111111, s * 0.13, 0.08, 0.22));
    const tail = mesh(box(0.5, 0.06, 0.5), 0xffffff, 0, 0, -0.85);
    g.add(tail);
    g.userData = { head, wings: wings(g, 0x5a3a1c, 1.8, 0.1, 0), height: 1.2 };
    return g;
  }

  function crocodile() {
    const g = new THREE.Group();
    const green = 0x3f7d3a;
    const body = mesh(box(1.1, 0.55, 2.4), green, 0, 0.35, 0);
    g.add(body);
    for (let i = 0; i < 5; i++) g.add(mesh(box(0.2, 0.15, 0.2), 0x2f5f2a, 0, 0.7, 0.9 - i * 0.45));
    const head = new THREE.Group();
    head.position.set(0, 0.35, 1.2);
    g.add(head);
    head.add(mesh(box(0.8, 0.3, 1.4), green, 0, 0.05, 0.6));
    head.add(mesh(box(0.75, 0.15, 1.3), 0x6aa060, 0, -0.18, 0.6));
    for (const s of [-1, 1]) {
      head.add(mesh(sphere(0.16), green, s * 0.25, 0.3, 0.1));
      head.add(mesh(sphere(0.09, 8), 0xffee55, s * 0.25, 0.38, 0.2));
      for (let i = 0; i < 4; i++) head.add(mesh(cone(0.05, 0.14, 4), 0xffffff, s * 0.36, -0.08, 0.3 + i * 0.3));
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.35, -1.2);
    g.add(tail);
    const t = mesh(cone(0.45, 2.4, 6), green, 0, 0, -1.2);
    t.rotation.x = -Math.PI / 2;
    t.scale.z = 0.5;
    tail.add(t);
    for (const [x, z] of [[-0.6, 0.8], [0.6, 0.8], [-0.6, -0.8], [0.6, -0.8]]) g.add(mesh(box(0.25, 0.3, 0.35), green, x, 0.1, z));
    g.userData = { head, tail, height: 1.6 };
    return g;
  }

  // --- Harmless animals ---

  function fish(color) {
    const g = new THREE.Group();
    const body = mesh(sphere(0.35), color);
    body.scale.set(0.5, 0.8, 1.3);
    g.add(body);
    const tail = mesh(cone(0.25, 0.4, 4), color, 0, 0, -0.55);
    tail.rotation.x = -Math.PI / 2;
    tail.scale.x = 0.3;
    g.add(tail);
    for (const s of [-1, 1]) g.add(mesh(sphere(0.06, 8), 0x111111, s * 0.12, 0.08, 0.3));
    g.userData = { tail };
    return g;
  }

  function bird(color) {
    const g = new THREE.Group();
    const body = mesh(sphere(0.25), color);
    body.scale.set(0.8, 0.8, 1.4);
    g.add(body);
    const beak = mesh(cone(0.06, 0.18, 6), 0xffa500, 0, 0.05, 0.4);
    beak.rotation.x = Math.PI / 2;
    g.add(beak);
    g.userData = { wings: wings(g, color, 0.7, 0.05, 0) };
    return g;
  }

  function rabbit() {
    const g = new THREE.Group();
    const body = mesh(sphere(0.35), 0xf0ece4, 0, 0.35, 0);
    body.scale.set(0.9, 0.9, 1.2);
    g.add(body);
    g.add(mesh(sphere(0.25), 0xf0ece4, 0, 0.7, 0.3));
    for (const s of [-1, 1]) {
      const ear = mesh(sphere(0.08), 0xf0ece4, s * 0.1, 1.05, 0.25);
      ear.scale.set(0.8, 3, 0.5);
      g.add(ear);
      g.add(mesh(sphere(0.04, 8), 0x111111, s * 0.1, 0.75, 0.52));
    }
    g.add(mesh(sphere(0.04, 8), 0xff9fb0, 0, 0.68, 0.55));
    g.add(mesh(sphere(0.12), 0xffffff, 0, 0.4, -0.42));
    return g;
  }

  function deer() {
    const g = new THREE.Group();
    const fur = 0xa0662e;
    const body = mesh(sphere(0.5), fur, 0, 1.3, 0);
    body.scale.set(0.8, 0.8, 1.6);
    g.add(body);
    for (const [x, z] of [[-0.25, 0.5], [0.25, 0.5], [-0.25, -0.5], [0.25, -0.5]]) g.add(mesh(cylinder(0.07, 0.06, 1.1, 6), fur, x, 0.55, z));
    const neck = mesh(cylinder(0.14, 0.2, 0.8, 8), fur, 0, 1.75, 0.65);
    neck.rotation.x = 0.5;
    g.add(neck);
    g.add(mesh(sphere(0.25), fur, 0, 2.1, 0.85));
    g.add(mesh(sphere(0.06, 8), 0x111111, 0, 2.05, 1.12));
    for (const s of [-1, 1]) {
      g.add(mesh(sphere(0.04, 8), 0x111111, s * 0.12, 2.17, 1.0));
      const antler = mesh(cylinder(0.03, 0.04, 0.5, 5), 0xe8d8b0, s * 0.15, 2.5, 0.8);
      antler.rotation.z = s * -0.4;
      g.add(antler);
    }
    g.add(mesh(sphere(0.12), 0xffffff, 0, 1.45, -0.8));
    return g;
  }

  function penguin() {
    const g = new THREE.Group();
    const body = mesh(sphere(0.4), 0x1f2a36, 0, 0.55, 0);
    body.scale.set(0.9, 1.4, 0.85);
    g.add(body);
    const belly = mesh(sphere(0.32), 0xffffff, 0, 0.5, 0.12);
    belly.scale.set(0.9, 1.4, 0.7);
    g.add(belly);
    g.add(mesh(sphere(0.25), 0x1f2a36, 0, 1.15, 0));
    const beak = mesh(cone(0.07, 0.2, 6), 0xff9f1c, 0, 1.12, 0.28);
    beak.rotation.x = Math.PI / 2;
    g.add(beak);
    for (const s of [-1, 1]) {
      g.add(mesh(sphere(0.04, 8), 0xffffff, s * 0.1, 1.22, 0.2));
      g.add(mesh(box(0.15, 0.05, 0.25), 0xff9f1c, s * 0.15, 0.03, 0.1));
      const flipper = mesh(box(0.08, 0.5, 0.2), 0x1f2a36, s * 0.38, 0.65, 0);
      flipper.rotation.z = s * 0.3;
      g.add(flipper);
    }
    return g;
  }

  function frog() {
    const g = new THREE.Group();
    const body = mesh(sphere(0.35), 0x5cb85c, 0, 0.3, 0);
    body.scale.set(1.1, 0.7, 1);
    g.add(body);
    for (const s of [-1, 1]) {
      g.add(mesh(sphere(0.13), 0x5cb85c, s * 0.18, 0.55, 0.15));
      g.add(mesh(sphere(0.08, 8), 0x111111, s * 0.18, 0.6, 0.24));
      const leg = mesh(sphere(0.15), 0x4a9a4a, s * 0.35, 0.15, -0.15);
      leg.scale.set(1, 0.6, 1.5);
      g.add(leg);
    }
    return g;
  }

  function snowman() {
    const g = new THREE.Group();
    g.add(mesh(sphere(1.1), 0xffffff, 0, 1, 0));
    g.add(mesh(sphere(0.75), 0xffffff, 0, 2.5, 0));
    g.add(mesh(sphere(0.5), 0xffffff, 0, 3.55, 0));
    const nose = mesh(cone(0.08, 0.5, 8), 0xff7f1c, 0, 3.55, 0.65);
    nose.rotation.x = Math.PI / 2;
    g.add(nose);
    for (const s of [-1, 1]) g.add(mesh(sphere(0.06, 8), 0x111111, s * 0.18, 3.7, 0.42));
    g.add(mesh(cylinder(0.35, 0.35, 0.5, 12), 0x222222, 0, 4.1, 0));
    g.add(mesh(cylinder(0.55, 0.55, 0.06, 16), 0x222222, 0, 3.87, 0));
    const scarf = mesh(new THREE.TorusGeometry(0.5, 0.12, 6, 16), 0xd62828, 0, 3.12, 0);
    scarf.rotation.x = Math.PI / 2;
    g.add(scarf);
    return g;
  }

  function chest() {
    const g = new THREE.Group();
    g.add(mesh(box(1.8, 1.0, 1.2), 0x8b5a2b, 0, 0.5, 0));
    g.add(mesh(box(1.85, 0.15, 1.25), 0xd4af37, 0, 0.2, 0));
    const lid = new THREE.Group();
    lid.position.set(0, 1.0, -0.6);
    lid.add(mesh(box(1.8, 0.4, 1.2), 0x8b5a2b, 0, 0.2, 0.6));
    lid.add(mesh(box(1.85, 0.12, 1.25), 0xd4af37, 0, 0.35, 0.6));
    lid.add(mesh(box(0.3, 0.3, 0.1), 0xd4af37, 0, 0.05, 1.22));
    g.add(lid);
    g.userData = { lid };
    return g;
  }

  function stripeTexture(a, b, stripes) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.fillRect((i * 512) / stripes, 0, 512 / stripes + 1, 8);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function tent(radius, height, a = '#d62828', b = '#fdf0d5') {
    const g = new THREE.Group();
    const texture = stripeTexture(a, b, 24);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 48, 1, true), new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide }));
    wall.position.y = height / 2;
    wall.castShadow = true;
    g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.08, height * 1.3, 48), new THREE.MeshLambertMaterial({ map: texture }));
    roof.position.y = height + height * 0.65;
    roof.castShadow = true;
    g.add(roof);
    const top = height * 1.95;
    g.add(mesh(cylinder(0.08, 0.08, 3, 6), 0x777777, 0, top + 1.3, 0));
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(1.6, -0.4);
    flagShape.lineTo(0, -0.8);
    g.add(mesh(new THREE.ShapeGeometry(flagShape), 0xffd60a, 0, top + 2.8, 0, { side: THREE.DoubleSide }));
    g.userData = { radius, top: top + 1 };
    return g;
  }

  function cage() {
    const g = new THREE.Group();
    g.add(mesh(box(4, 0.3, 4), 0x6b4b2a, 0, 0.15, 0));
    g.add(mesh(box(4, 0.3, 4), 0xc9a227, 0, 4, 0));
    const bar = cylinder(0.07, 0.07, 3.7, 6);
    for (let i = 0; i < 6; i++) {
      const t = -1.9 + (i * 3.8) / 5;
      for (const [x, z] of [[t, -1.9], [-1.9, t], [1.9, t]]) g.add(mesh(bar, 0xc9a227, x, 2.1, z));
    }
    const door = new THREE.Group();
    door.position.set(-1.9, 0, 1.9);
    for (let i = 0; i < 6; i++) door.add(mesh(bar, 0xc9a227, (i * 3.8) / 5, 2.1, 0));
    door.rotation.y = -1.9;
    g.add(door);
    return g;
  }

  function haystack() {
    const g = new THREE.Group();
    const hay = mesh(sphere(1.4, 14), 0xe9c46a, 0, 0.8, 0);
    hay.scale.set(1, 0.8, 1);
    g.add(hay);
    g.userData = { hay };
    return g;
  }

  function crate() {
    const g = new THREE.Group();
    g.add(mesh(box(1.6, 1.6, 1.6), 0xa0703a, 0, 0.8, 0));
    g.add(mesh(box(1.65, 0.2, 1.65), 0x6b4b2a, 0, 0.8, 0));
    return g;
  }

  function coin() {
    const m = new THREE.Mesh(cylinder(0.5, 0.5, 0.12, 20), mat(0xffcc00, { emissive: 0x664400 }));
    m.rotation.x = Math.PI / 2;
    const g = new THREE.Group();
    g.add(m);
    return g;
  }

  function net() {
    const m = new THREE.Mesh(sphere(0.6, 10), new THREE.MeshBasicMaterial({ color: 0xeeeeee, wireframe: true }));
    return m;
  }

  function cocoon() {
    return new THREE.Mesh(sphere(1.6, 12), new THREE.MeshBasicMaterial({ color: 0xf5f5f5, wireframe: true }));
  }

  return {
    mat, mesh, sphere, cylinder, cone, box,
    dragon, poseDragon, wizard, guard, robot, dog, wolf, bear, scorpion, eagle, crocodile,
    fish, bird, rabbit, deer, penguin, frog,
    tent, cage, haystack, crate, snowman, chest, coin, net, cocoon,
  };
})();
