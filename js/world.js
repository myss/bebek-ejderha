// Builds one level from its segments: lays them out along -z, sets LEVEL, then fills each
// segment with scenery, chasers, animals and coins in the level's biome. Everything goes into one
// group so the level can be thrown away when the next one starts.

const SEGMENT_SIZES = { fence: 12, wall: 16, finish: 30, mountain: 34 };

// Tree kinds, each a list of parts. A part is a geometry with its own place in the tree, and is
// drawn as one instanced mesh for all trees of that kind. radius and top are the collider.
const TREE_KINDS = {
  pine: {
    radius: 0.9, top: 6.5,
    parts: [
      { geo: () => Models.cylinder(0.25, 0.35, 2, 8), at: [0, 1, 0], color: 0x7a4a21 },
      { geo: () => Models.cone(2.2, 2.4, 10), at: [0, 2.4, 0], color: 'leaf' },
      { geo: () => Models.cone(1.65, 2.4, 10), at: [0, 3.7, 0], color: 'leaf' },
      { geo: () => Models.cone(1.1, 2.4, 10), at: [0, 5.0, 0], color: 'leaf' },
    ],
    leaves: [0x2f7d32, 0x3a8f3a],
  },
  snowPine: {
    radius: 0.9, top: 6.5,
    parts: [
      { geo: () => Models.cylinder(0.25, 0.35, 2, 8), at: [0, 1, 0], color: 0x6b4a2a },
      { geo: () => Models.cone(2.2, 2.4, 10), at: [0, 2.4, 0], color: 'leaf' },
      { geo: () => Models.cone(1.65, 2.4, 10), at: [0, 3.7, 0], color: 'leaf' },
      { geo: () => Models.cone(1.1, 2.4, 10), at: [0, 5.0, 0], color: 0xf4f8fb },
      { geo: () => Models.cone(1.7, 0.6, 10), at: [0, 3.35, 0], color: 0xf4f8fb },
    ],
    leaves: [0x24533a, 0x2c6244],
  },
  round: {
    radius: 1.0, top: 6,
    parts: [
      { geo: () => Models.cylinder(0.3, 0.4, 2.6, 8), at: [0, 1.3, 0], color: 0x7a4a21 },
      { geo: () => Models.sphere(1.9, 12), at: [0, 4, 0], color: 'leaf' },
    ],
    leaves: [0x4caf50, 0x5cbf4a, 0x6aa84f],
  },
  cactus: {
    radius: 0.9, top: 4,
    parts: [
      { geo: () => Models.cylinder(0.45, 0.5, 3.6, 10), at: [0, 1.8, 0], color: 'leaf' },
      { geo: () => Models.cylinder(0.3, 0.3, 1.4, 8), at: [0.95, 2.6, 0], color: 'leaf' },
      { geo: () => Models.box(0.8, 0.4, 0.4), at: [0.6, 1.9, 0], color: 'leaf' },
      { geo: () => Models.cylinder(0.3, 0.3, 1.2, 8), at: [-0.95, 2.1, 0], color: 'leaf' },
      { geo: () => Models.box(0.8, 0.4, 0.4), at: [-0.6, 1.5, 0], color: 'leaf' },
    ],
    leaves: [0x4a8f3a, 0x5a9a40],
  },
  palm: {
    radius: 0.6, top: 7,
    parts: [
      { geo: () => Models.cylinder(0.22, 0.35, 6, 8), at: [0, 3, 0], color: 0xa0784a },
      ...[0, 1, 2, 3, 4].map((i) => ({ geo: () => Models.box(0.7, 0.08, 3.2), at: [Math.sin((i * 2 * Math.PI) / 5) * 1.4, 5.8, Math.cos((i * 2 * Math.PI) / 5) * 1.4], rot: [0.35, (i * 2 * Math.PI) / 5, 0], color: 'leaf' })),
    ],
    leaves: [0x3f9a3a, 0x4aa840],
  },
  dead: {
    radius: 0.6, top: 5,
    parts: [
      { geo: () => Models.cylinder(0.2, 0.35, 4, 7), at: [0, 2, 0], color: 'leaf' },
      { geo: () => Models.cylinder(0.08, 0.14, 1.8, 6), at: [0.6, 3.2, 0], rot: [0, 0, -0.8], color: 'leaf' },
      { geo: () => Models.cylinder(0.08, 0.14, 1.5, 6), at: [-0.5, 2.6, 0.2], rot: [0.2, 0, 0.9], color: 'leaf' },
    ],
    leaves: [0x4a3626, 0x3a2a1e],
  },
  mushroom: {
    radius: 1.0, top: 3.4,
    parts: [
      { geo: () => Models.cylinder(0.35, 0.5, 2.5, 10), at: [0, 1.25, 0], color: 0xf0e6d0 },
      { geo: () => Models.sphere(1.6, 14), at: [0, 2.6, 0], scale: [1, 0.55, 1], color: 'leaf' },
    ],
    leaves: [0xd63a3a, 0xe0a030, 0x9a5ad6],
  },
};

// progress says which doors on the home meadow are open: { unlocked, surpriseDone }.
function buildWorld(scene, levelIndex, progress) {
  const def = levelDef(levelIndex);
  const theme = typeof def.theme === 'string' ? THEMES[def.theme] : def.theme;
  const biomeKey = def.biomeKey || def.biome;
  const biome = typeof def.biome === 'string' ? BIOMES[def.biome] : def.biome;
  const isFinal = levelIndex === LEVELS.length - 1;
  const isHome = levelIndex === HOME_LEVEL;
  const difficulty = 1 + clamp(levelIndex, 0, 14) * 0.15;
  const rand = makeRandom(100 + levelIndex * 17);
  const group = new THREE.Group();
  scene.add(group);

  // Lay the segments out first, so the terrain knows where the water is.
  const backZ = 40;
  LEVEL = { halfWidth: 46, backZ, endZ: -1000, goalZ: 0, rivers: [], walls: [], path: def.path };
  let cursor = backZ;
  const segments = [];
  let goalZ = 0;
  for (const [type, size] of def.segments) {
    const length = type === 'river' || type === 'lake' ? size + 10 : SEGMENT_SIZES[type] || size;
    const seg = { type, start: cursor, end: cursor - length, size };
    if (type === 'river') {
      seg.river = { near: cursor - 5, far: cursor - 5 - size, bridgeX: Math.round(pathX(cursor - length / 2)), depth: 7, slope: 1.4 };
      LEVEL.rivers.push(seg.river);
    }
    if (type === 'lake') {
      seg.river = { near: cursor - 5, far: cursor - 5 - size, bridgeX: null, depth: 14, slope: 0.9 };
      LEVEL.rivers.push(seg.river);
    }
    if (type === 'finish') goalZ = cursor - 12;
    if (type === 'mountain') goalZ = cursor - 14;
    if (type === 'home') goalZ = -Infinity;
    segments.push(seg);
    cursor -= length;
  }
  LEVEL.endZ = cursor;
  LEVEL.goalZ = goalZ;

  const circles = [];
  const boxes = [];
  const burnables = [];
  const coins = [];
  const chests = [];
  const enemies = [];
  const critters = [];
  const checkpoints = [];
  const tips = [];
  const trees = [];
  const rocks = [];
  const portals = [];
  let mother = null;
  let start = { x: pathX(backZ - 10), z: backZ - 10 };

  function add(object, x, z, y = terrainHeight(x, z)) {
    object.position.set(x, y, z);
    group.add(object);
    return object;
  }

  function isFree(x, z, r) {
    if (Math.abs(x) > LEVEL.halfWidth - 3 || isRiver(z)) return false;
    for (const c of circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return false;
    return true;
  }

  // A random free spot in a segment, away from the path when asked.
  function spot(seg, r, awayFromPath = 0, margin = 4) {
    for (let i = 0; i < 30; i++) {
      const z = seg.start - margin - rand() * (seg.start - seg.end - margin * 2);
      const x = (rand() * 2 - 1) * (LEVEL.halfWidth - 4);
      if (Math.abs(x - pathX(z)) < awayFromPath) continue;
      if (isFree(x, z, r)) return { x, z };
    }
    return null;
  }

  // A random spot in a river or lake, deep enough to swim.
  function waterSpot(r, minDepth = 3) {
    for (let i = 0; i < 30; i++) {
      const z = r.near - rand() * (r.near - r.far);
      const x = (rand() * 2 - 1) * (LEVEL.halfWidth - 6);
      if (terrainHeight(x, z) < RULES.waterLevel - minDepth && (r.bridgeX === null || Math.abs(x - r.bridgeX) > 6)) return { x, z };
    }
    return null;
  }

  function addEnemy(type, seg, extra = {}) {
    const p = extra.x !== undefined ? { x: extra.x, z: extra.z } : spot(seg, 1.5, 0, 8);
    if (!p || p.z > backZ - 35) return;
    enemies.push(Object.assign({ type, x: p.x, z: p.z }, extra));
  }

  function addCritters(type, count, place) {
    for (let i = 0; i < count; i++) {
      const p = place();
      if (p) critters.push({ type, x: p.x, z: p.z, y: p.y });
    }
  }

  function addCoin(x, z, y) {
    const c = add(Models.coin(), x, z, y);
    coins.push({ object: c, taken: false, hidden: false });
    return coins[coins.length - 1];
  }

  function addHaystack(x, z, coinInside) {
    const h = add(Models.haystack(), x, z);
    const collider = { x, z, r: 1.4, top: 2 };
    circles.push(collider);
    const b = { object: h, collider, burnt: false, coin: null };
    if (coinInside) {
      b.coin = addCoin(x, z, terrainHeight(x, z) + 1.2);
      b.coin.hidden = true;
      b.coin.object.visible = false;
    }
    burnables.push(b);
  }

  function addSolid(object, x, z, r, top) {
    add(object, x, z);
    object.rotation.y = rand() * Math.PI * 2;
    circles.push({ x, z, r, top });
  }

  function addTent(x, z, radius, height, a, b) {
    const t = add(Models.tent(radius, height, a, b), x, z);
    circles.push({ x, z, r: radius + 0.5, top: t.userData.top });
  }

  function addTree(x, z, solid = true, kind = null) {
    kind = kind || biome.trees[Math.floor(rand() * biome.trees.length)];
    const k = TREE_KINDS[kind];
    const s = 0.8 + rand() * 0.6;
    trees.push({ kind, x, z, s, turn: rand() * Math.PI * 2, leaf: k.leaves[Math.floor(rand() * k.leaves.length)] });
    if (solid) circles.push({ x, z, r: k.radius * s, top: k.top * s });
  }

  function addRock(x, z) {
    const r = 1 + rand() * 2.2;
    rocks.push({ x, z, r, rx: rand() * 3, ry: rand() * 3 });
    circles.push({ x, z, r: r * 0.9, top: r * 1.4 });
  }

  // A pool of lava: dragons can jump over it, nobody can walk through it.
  function addLava(x, z) {
    const r = 2 + rand() * 2.5;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0xff5a1a, fog: false }));
    pool.rotation.x = -Math.PI / 2;
    add(pool, x, z, terrainHeight(x, z) + 0.06);
    const crust = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.5, 20), Models.mat(0x2a1a14));
    crust.rotation.x = -Math.PI / 2;
    add(crust, x, z, terrainHeight(x, z) + 0.05);
    circles.push({ x, z, r: r + 0.3, top: 0.8, lava: true });
  }

  function plantForest(seg, count) {
    for (let i = 0; i < count; i++) {
      const p = spot(seg, 1.2, 5, 2);
      if (p) addTree(p.x, p.z);
    }
  }

  function pathCoins(seg) {
    for (let z = seg.start - 6; z > seg.end + 4; z -= 14) {
      if (z > backZ - 20) continue;
      addCoin(pathX(z), z, terrainHeight(pathX(z), z) + 1.2);
    }
  }

  function wildAnimals(seg, count) {
    const n = Math.round(count * difficulty);
    for (let i = 0; i < n; i++) addEnemy(i % 2 ? biome.beast : 'guard', seg, { gun: i % 4 === 2 });
    if (def.eagles) addEnemy('eagle', seg);
  }

  function landCritters(seg) {
    for (const type of def.critters) {
      if (type === 'fish') continue;
      const count = type === 'bird' ? 2 : 3;
      addCritters(type, count, () => spot(seg, 1, 4));
    }
  }

  // The collider of a fence or wall that spans the whole level, into the hills on both sides.
  function barrier(z, top, thickness) {
    const width = (LEVEL.halfWidth + 14) * 2;
    boxes.push({ minX: -width / 2, maxX: width / 2, minZ: z - thickness / 2, maxZ: z + thickness / 2, top });
    LEVEL.walls.push({ z, top });
    return width;
  }

  function fence(z, top) {
    const width = barrier(z, top, 1);
    const board = Models.box(0.7, top, 0.25);
    const count = Math.ceil(width / 0.8);
    const boards = new THREE.InstancedMesh(board, Models.mat(0x9c6b3c), count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const x = -width / 2 + i * 0.8;
      const h = top - 0.2 + Math.sin(i * 1.7) * 0.2;
      m.makeScale(1, h / top, 1);
      m.setPosition(x, terrainHeight(x, z) + h / 2, z);
      boards.setMatrixAt(i, m);
    }
    boards.castShadow = true;
    group.add(boards);
    for (const y of [1.0, top - 1.0]) group.add(Models.mesh(Models.box(width, 0.25, 0.2), 0x6b4b2a, 0, y, z - 0.2));
  }

  function water(r) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(groundWidth, r.near - r.far),
      new THREE.MeshLambertMaterial({ color: biome.water, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, RULES.waterLevel, (r.near + r.far) / 2);
    plane.renderOrder = 2;
    group.add(plane);
    if (biome.lilies) {
      for (let i = 0; i < 14; i++) {
        const p = waterSpot(r, 1);
        if (!p) continue;
        const pad = new THREE.Mesh(new THREE.CircleGeometry(0.7 + rand() * 0.5, 12, 0.3, Math.PI * 1.8), Models.mat(0x4c9a3a, { side: THREE.DoubleSide }));
        pad.rotation.x = -Math.PI / 2;
        pad.rotation.z = rand() * 6;
        add(pad, p.x, p.z, RULES.waterLevel + 0.03);
      }
    }
    if (def.critters.includes('fish')) {
      addCritters('fish', r.bridgeX === null ? 10 : 5, () => {
        const p = waterSpot(r, 3);
        return p && { x: p.x, z: p.z, y: (terrainHeight(p.x, p.z) + RULES.waterLevel) / 2 };
      });
    }
    if (def.crocodiles) {
      for (let i = 0; i < (r.bridgeX === null ? 3 : 2); i++) {
        const p = waterSpot(r, 3);
        if (p) enemies.push({ type: 'crocodile', x: p.x, z: p.z });
      }
    }
    if (biome.shoreTree) {
      for (let i = 0; i < 10; i++) {
        const z = rand() < 0.5 ? r.near + 2 + rand() * 4 : r.far - 2 - rand() * 4;
        const x = (rand() * 2 - 1) * (LEVEL.halfWidth - 6);
        if (Math.abs(x - pathX(z)) > 5 && isFree(x, z, 1)) addTree(x, z, true, biome.shoreTree);
      }
    }
  }

  function checkpointAfter(z) {
    checkpoints.push({ x: pathX(z), z });
  }

  function rainbow(parent, radius, tube) {
    [0xe63946, 0xf77f00, 0xfcbf49, 0x52b788, 0x4895ef, 0x7b2cbf].forEach((color, i) => {
      parent.add(Models.mesh(new THREE.TorusGeometry(radius - i * tube * 1.85, tube, 8, 40, Math.PI), color, 0, 0, 0, { emissive: color, emissiveIntensity: 0.3 }));
    });
  }

  // A board with writing on it, lit the same from every side so it is always easy to read.
  function signBoard(text, width) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = '#fff4e0';
    ctx.font = 'bold 52px "Trebuchet MS", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 68, 480);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  }

  // A small rainbow door on the home meadow, with a glowing middle and its name above it.
  function addPortal(x, z, level, label, color, locked) {
    const door = new THREE.Group();
    rainbow(door, 3.6, 0.14);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 32),
      new THREE.MeshBasicMaterial({ color: locked ? 0x8a8a8a : color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    );
    door.add(glow);
    const sign = signBoard(label, 5);
    sign.position.y = 5;
    door.add(sign);
    door.rotation.y = Math.atan2(-x, start.z - z);
    add(door, x, z);
    portals.push({ x, z, level, label, locked, glow });
  }

  // --- Sky, light, ground --------------------------------------------------------------------

  const skyGeometry = new THREE.SphereGeometry(900, 32, 16);
  const skyColors = [];
  const top = new THREE.Color(theme.top);
  const horizon = new THREE.Color(theme.horizon);
  const sp = skyGeometry.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const t = clamp(sp.getY(i) / 900, 0, 1);
    const c = horizon.clone().lerp(top, Math.pow(t, 0.6));
    skyColors.push(c.r, c.g, c.b);
  }
  skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  group.add(new THREE.Mesh(skyGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));

  group.add(new THREE.HemisphereLight(0xfff1dc, biome.ground[1], 1.4));
  const sun = new THREE.DirectionalLight(theme.sun, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 200 });
  sun.shadow.bias = -0.0005;
  group.add(sun);
  group.add(sun.target);

  const groundWidth = (LEVEL.halfWidth + 40) * 2;
  const groundNear = backZ + 40;
  const groundFar = LEVEL.endZ - (isFinal ? 160 : 60);
  const groundGeometry = new THREE.PlaneGeometry(groundWidth, groundNear - groundFar, Math.round(groundWidth / 2), Math.round((groundNear - groundFar) / 2));
  groundGeometry.rotateX(-Math.PI / 2);
  groundGeometry.translate(0, 0, (groundNear + groundFar) / 2);
  const gp = groundGeometry.attributes.position;
  const groundColors = [];
  const light = new THREE.Color(biome.ground[0]);
  const dark = new THREE.Color(biome.ground[1]);
  const trail = new THREE.Color(biome.path);
  const shore = new THREE.Color(biome.shore);
  const stone = new THREE.Color(biome.stone);
  const sandBed = new THREE.Color(0xc8b07a);
  const rocky = segments.filter((s) => s.type === 'rocks' || s.type === 'camp');
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i);
    const z = gp.getZ(i);
    const h = terrainHeight(x, z);
    gp.setY(i, h);
    let c = light.clone().lerp(dark, rand() * 0.6);
    if (rocky.some((s) => z < s.start && z > s.end)) c.lerp(stone, 0.35);
    if (Math.abs(x - pathX(z)) < 2.6 && !isRiver(z)) c = trail.clone();
    if (LEVEL.rivers.some((r) => z < r.near + 3 && z > r.far - 3)) c = h < -3 ? sandBed.clone().lerp(stone, rand() * 0.3) : shore.clone();
    if (h > 6) c = stone.clone().lerp(dark, rand() * 0.3);
    groundColors.push(c.r, c.g, c.b);
  }
  groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  group.add(ground);

  // --- Segments ------------------------------------------------------------------------------

  for (const seg of segments) {
    const zOff = seg.start - backZ;
    switch (seg.type) {
      case 'home': {
        // A door for every level in an arc in front of the start, and the surprise door last.
        const doors = LEVELS.length + 1;
        for (let i = 0; i < doors; i++) {
          const a = -1.3 + (2.6 * i) / (doors - 1);
          const x = Math.sin(a) * 32;
          const z = start.z - 10 - Math.cos(a) * 32;
          if (i < LEVELS.length) {
            const locked = i >= progress.unlocked;
            addPortal(x, z, i, locked ? `🔒 ${i + 1}. Bölüm` : `${i + 1}. ${LEVELS[i].name}`, THEMES[LEVELS[i].theme].top, locked);
          } else {
            addPortal(x, z, FIRST_SURPRISE_LEVEL + progress.surpriseDone, `⭐ Sürpriz ${progress.surpriseDone + 1}`, 0xffd700, false);
          }
          // Keeps trees and haystacks off the doors; nothing bumps into it.
          circles.push({ x, z, r: 5, top: -1 });
        }
        circles.push({ x: start.x, z: start.z, r: 8, top: -1 });
        for (let i = 0; i < 30; i++) {
          const p = spot(seg, 1.2, 0);
          if (p) addTree(p.x, p.z);
        }
        for (let i = 0; i < 4; i++) {
          const p = spot(seg, 2, 0);
          if (p) addHaystack(p.x, p.z, true);
        }
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          addCoin(Math.cos(a) * 6, start.z - 14 + Math.sin(a) * 6, 1.2);
        }
        landCritters(seg);
        break;
      }
      case 'circus': {
        addTent(16, 10 + zOff, 13, 6);
        addTent(-20, 22 + zOff, 4, 3, '#1d4ed8', '#fdf0d5');
        addTent(-24, -30 + zOff, 4, 3, '#7b2cbf', '#ffd60a');
        addTent(26, -38 + zOff, 4, 3, '#2a9d8f', '#fdf0d5');
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          group.add(Models.mesh(Models.sphere(0.18, 8), [0xff4d4d, 0xffd60a, 0x4dd2ff][i % 3], 16 + Math.cos(a) * 13.3, 6.2, 10 + zOff + Math.sin(a) * 13.3, { emissive: [0xaa2222, 0xaa8800, 0x2288aa][i % 3] }));
        }
        const cage = add(Models.cage(), -4, 20 + zOff);
        cage.rotation.y = Math.PI;
        for (const [x, z] of [[-6, 22], [-2, 22], [-6, 18], [-2, 18]]) circles.push({ x, z: z + zOff, r: 0.3, top: 4.2 });
        start = { x: -4, z: 15 + zOff };
        for (const [x, z] of [[-14, 6], [-12, -10], [6, -20], [-28, -60], [22, -70], [30, -15], [-8, -45]]) addSolid(Models.crate(), x, z + zOff, 1.1, 1.6);
        addHaystack(-16, -20 + zOff, true);
        addHaystack(-10, 30 + zOff, false);
        addHaystack(10, -80 + zOff, true);
        addHaystack(-30, -5 + zOff, true);
        addEnemy('guard', seg, { x: 2, z: -8 + zOff });
        addEnemy('guard', seg, { x: -16, z: -38 + zOff, gun: true });
        addEnemy('bear', seg, { x: 12, z: -72 + zOff });
        addEnemy('dog', seg, { x: -6, z: -88 + zOff });
        landCritters(seg);
        pathCoins(seg);
        break;
      }
      case 'meadow': {
        for (let i = 0; i < 4; i++) {
          const p = spot(seg, 2, 4);
          if (!p) continue;
          if (biome.hay) addHaystack(p.x, p.z, i < 3);
          else if (biome.snowmen) addSolid(Models.snowman(), p.x, p.z, 1.1, 4.3);
          else addRock(p.x, p.z);
        }
        for (let i = 0; i < 4; i++) {
          const p = spot(seg, 1.5, 4);
          if (p) addSolid(Models.crate(), p.x, p.z, 1.1, 1.6);
        }
        for (let i = 0; i < seg.size / 6; i++) {
          const p = spot(seg, 1.2, 8);
          if (p && Math.abs(p.x) > 16) addTree(p.x, p.z);
        }
        if (biome.lava) for (let i = 0; i < seg.size / 25; i++) { const p = spot(seg, 5, 4); if (p) addLava(p.x, p.z); }
        wildAnimals(seg, seg.size / 45);
        landCritters(seg);
        pathCoins(seg);
        break;
      }
      case 'forest': {
        plantForest(seg, Math.round(seg.size * 1.1));
        wildAnimals(seg, seg.size / 50);
        if (def.bears) addEnemy('bear', seg);
        landCritters(seg);
        for (const z of [seg.start - seg.size * 0.3, seg.start - seg.size * 0.7]) for (const y of [6, 8.5]) addCoin(pathX(z) + 3, z, y);
        pathCoins(seg);
        break;
      }
      case 'rocks': {
        for (let i = 0; i < seg.size * 0.3; i++) {
          const p = spot(seg, 3, 5);
          if (p) addRock(p.x, p.z);
        }
        for (let i = 0; i < seg.size / 12; i++) {
          const p = spot(seg, 1.2, 6);
          if (p) addTree(p.x, p.z);
        }
        if (biome.lava) {
          for (let i = 0; i < seg.size / 15; i++) {
            const p = spot(seg, 5, 4);
            if (p) addLava(p.x, p.z);
          }
          tips.push({ z: seg.start - 2, text: 'Lav! Çok sıcak. Üstünden zıpla ya da etrafından dolaş. 🌋' });
        }
        const n = Math.round((seg.size / 50) * difficulty);
        for (let i = 0; i < n; i++) addEnemy(i % 3 === 2 ? biome.beast : 'robot', seg);
        if (def.eagles) addEnemy('eagle', seg);
        landCritters(seg);
        pathCoins(seg);
        break;
      }
      case 'river': {
        const r = seg.river;
        water(r);
        const length = r.near - r.far + 6;
        const midZ = (r.near + r.far) / 2;
        const deck = Models.mesh(Models.box(RULES.bridgeHalfWidth * 2, 0.5, length), 0x8b5a2b, r.bridgeX, RULES.bridgeTop - 0.25, midZ);
        deck.receiveShadow = true;
        group.add(deck);
        for (const s of [-1, 1]) {
          const x = r.bridgeX + s * (RULES.bridgeHalfWidth - 0.1);
          group.add(Models.mesh(Models.box(0.2, 0.2, length), 0x6b4b2a, x, RULES.bridgeTop + 1, midZ));
          for (let z = r.near + 3; z >= r.far - 3; z -= 4) group.add(Models.mesh(Models.box(0.2, 1, 0.2), 0x6b4b2a, x, RULES.bridgeTop + 0.5, z));
        }
        const q = (r.near - r.far) / 4;
        addEnemy('robot', seg, { x: r.bridgeX, z: midZ + q, onBridge: true });
        addEnemy('robot', seg, { x: r.bridgeX, z: midZ - q, onBridge: true });
        addEnemy('guard', seg, { x: r.bridgeX + 10, z: r.far - 8, gun: true });
        for (let z = r.near - 6; z > r.far + 4; z -= 7) addCoin(r.bridgeX - 14, z, terrainHeight(r.bridgeX - 14, z) + 0.8);
        tips.push({ z: r.near + 14, text: def.crocodiles
          ? 'Nehirde timsahlar var! Suda ateş çıkmaz ama baloncukların timsahın başını döndürür. 🐊'
          : 'Nehir! Köprüde robotlar var. Suya gir, E ile dalıp gizlice geç.' });
        checkpointAfter(r.far - 8);
        break;
      }
      case 'lake': {
        const r = seg.river;
        water(r);
        // The lake bottom: seaweed, shells and a treasure chest in the deepest part.
        const weeds = [];
        for (let i = 0; i < 70; i++) {
          const p = waterSpot(r, 3);
          if (p) weeds.push(p);
        }
        const weed = new THREE.InstancedMesh(Models.cone(0.25, 1, 5), new THREE.MeshLambertMaterial({ color: 0xffffff }), weeds.length);
        const m = new THREE.Matrix4();
        const c = new THREE.Color();
        weeds.forEach((p, i) => {
          const h = 1.5 + rand() * 3;
          m.makeScale(1, h, 1);
          m.setPosition(p.x, terrainHeight(p.x, p.z) + h / 2, p.z);
          weed.setMatrixAt(i, m);
          weed.setColorAt(i, c.setHex(rand() < 0.5 ? 0x2e8b57 : 0x3cb371));
        });
        group.add(weed);
        for (let i = 0; i < 25; i++) {
          const p = waterSpot(r, 3);
          if (!p) continue;
          const shell = Models.mesh(Models.sphere(0.25, 8), [0xffc0cb, 0xfff5e0, 0xffa07a][i % 3]);
          shell.scale.set(1, 0.5, 1.2);
          add(shell, p.x, p.z, terrainHeight(p.x, p.z) + 0.1);
        }
        const cz = (r.near + r.far) / 2;
        const cx = pathX(cz) - 8;
        const chest = add(Models.chest(), cx, cz);
        chest.rotation.y = 0.4;
        const treasure = [];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const coin = addCoin(cx + Math.cos(a) * 1.6, cz + Math.sin(a) * 1.6, terrainHeight(cx, cz) + 2);
          coin.hidden = true;
          coin.object.visible = false;
          treasure.push(coin);
        }
        chests.push({ object: chest, coins: treasure, opened: false });
        tips.push({ z: r.near + 10, text: 'Kocaman bir göl! E ile en dibe dal, hazine sandığını bul! 💎' });
        checkpointAfter(r.far - 8);
        break;
      }
      case 'fence': {
        const z = seg.start - 6;
        fence(z, 4.5);
        const gx = pathX(z);
        group.add(Models.mesh(Models.box(6, 5.2, 0.4), 0x6b3d1f, gx, 2.6, z + 0.3));
        for (const dx of [-6, -2, 2, 6]) addCoin(gx + dx, z, 7);
        tips.push({ z: z + 18, text: 'Çit! Boşluk tuşuna basılı tutup üstünden uç, ya da E ile altından kaz.' });
        checkpointAfter(seg.end - 4);
        break;
      }
      case 'wall': {
        const z = seg.start - 8;
        const wallTop = 16;
        const width = barrier(z, wallTop + 1.6, 4);
        const wall = Models.mesh(Models.box(width, wallTop, 4), biome.lava ? 0x5a5050 : 0x8d8d8d, 0, wallTop / 2, z);
        wall.receiveShadow = true;
        group.add(wall);
        const count = Math.floor(width / 4);
        const battlement = new THREE.InstancedMesh(Models.box(2, 1.6, 4.2), Models.mat(0x7a7a7a), count);
        const bm = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
          bm.makeTranslation(-width / 2 + 1 + i * 4, wallTop + 0.8, z);
          battlement.setMatrixAt(i, bm);
        }
        battlement.castShadow = true;
        group.add(battlement);
        for (const x of [-12, 12]) {
          group.add(Models.mesh(Models.box(4, 7, 0.1), 0x5b2a86, x, 10, z + 2.06));
          group.add(Models.mesh(new THREE.OctahedronGeometry(1), 0xffd700, x, 10, z + 2.3));
        }
        addEnemy('robot', seg, { x: pathX(z) - 10, z: z + 16 });
        addEnemy('robot', seg, { x: pathX(z) + 12, z: z + 22 });
        tips.push({ z: z + 24, text: 'Kocaman bir duvar! Bu kadar yükseğe uçamazsın. E ile altından kaz!' });
        checkpointAfter(seg.end - 2);
        break;
      }
      case 'camp': {
        for (let i = 0; i < 4; i++) {
          const p = spot(seg, 6, 10);
          if (p) addTent(p.x, p.z, 4, 3, '#5b2a86', '#ffd60a');
        }
        for (let i = 0; i < 6; i++) {
          const p = spot(seg, 1.5, 4);
          if (p) addSolid(Models.crate(), p.x, p.z, 1.1, 1.6);
        }
        for (let i = 0; i < seg.size * 0.12; i++) {
          const p = spot(seg, 3, 6);
          if (p) addRock(p.x, p.z);
        }
        if (biome.lava) for (let i = 0; i < 4; i++) { const p = spot(seg, 5, 6); if (p) addLava(p.x, p.z); }
        const mid = seg.start - seg.size * 0.55;
        addEnemy('wizard', seg, { x: pathX(mid), z: mid });
        addEnemy('guard', seg, { gun: true });
        addEnemy('guard', seg, { gun: true });
        addEnemy('robot', seg);
        addEnemy(biome.beast, seg);
        if (def.eagles) addEnemy('eagle', seg);
        tips.push({ z: seg.start - 4, text: 'Burası Kötü Sihirbaz\'ın kampı! Ağlarına dikkat et.' });
        pathCoins(seg);
        break;
      }
      case 'finish': {
        const gate = new THREE.Group();
        rainbow(gate, 9, 0.3);
        add(gate, pathX(goalZ), goalZ);
        tips.push({ z: goalZ + 30, text: 'Gökkuşağı kapısı! İçinden geçince bölüm biter! 🌈' });
        break;
      }
      case 'mountain': {
        const baseZ = LEVEL.endZ - 85;
        const geo = new THREE.ConeGeometry(80, 110, 14, 8);
        const mp = geo.attributes.position;
        for (let i = 0; i < mp.count; i++) {
          if (mp.getY(i) > 54) continue;
          mp.setX(i, mp.getX(i) * (0.9 + rand() * 0.2));
          mp.setZ(i, mp.getZ(i) * (0.9 + rand() * 0.2));
        }
        geo.computeVertexNormals();
        const mountain = Models.mesh(geo, 0x5e4f6a, 0, 52, baseZ);
        mountain.receiveShadow = true;
        group.add(mountain);
        group.add(Models.mesh(new THREE.ConeGeometry(22, 30, 14), 0xffffff, 0, 93, baseZ));
        const glow = new THREE.PointLight(0xff9a3c, 60, 30);
        glow.position.set(pathX(goalZ), 4, goalZ + 1);
        group.add(glow);
        mother = Models.dragon({ body: 0x6a8de8, belly: 0xf5e6a8, wing: 0xa9c4ff, spikes: 0xffd060 });
        mother.scale.setScalar(2.6);
        add(mother, pathX(goalZ), goalZ - 2);
        tips.push({ z: goalZ + 30, text: 'Ejderha Dağı! Annen seni bekliyor! 💜' });
        break;
      }
    }
  }

  // Birds circle high above, out of reach.
  if (def.critters.includes('bird')) {
    for (let z = backZ - 30; z > LEVEL.endZ; z -= 60) critters.push({ type: 'bird', x: (rand() * 2 - 1) * 30, z, y: 15 + rand() * 6 });
  }

  // Trees along both sides, outside where you can walk.
  for (let z = backZ + 20; z > LEVEL.endZ - 20; z -= 7) {
    for (const s of [-1, 1]) addTree(s * (LEVEL.halfWidth + 1 + rand() * 18), z + rand() * 5, false);
  }

  // Trees and rocks are drawn as instances: one draw call per part instead of one per tree.
  const m = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const hslLeaf = {};
  for (const [kind, k] of Object.entries(TREE_KINDS)) {
    const list = trees.filter((t) => t.kind === kind);
    if (!list.length) continue;
    for (const part of k.parts) {
      const inst = new THREE.InstancedMesh(part.geo(), new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
      const r = part.rot || [0, 0, 0];
      local.compose(v.set(...part.at), q.setFromEuler(e.set(r[0], r[1], r[2])), s.set(...(part.scale || [1, 1, 1])));
      list.forEach((t, i) => {
        m.compose(v.set(t.x, terrainHeight(t.x, t.z), t.z), q.setFromEuler(e.set(0, t.turn, 0)), s.setScalar(t.s));
        m.multiply(local);
        inst.setMatrixAt(i, m);
        c.setHex(part.color === 'leaf' ? t.leaf : part.color);
        if (part.color === 'leaf' && biome.leafHue !== undefined) {
          c.getHSL(hslLeaf);
          c.setHSL(biome.leafHue % 1, Math.max(hslLeaf.s, 0.45), hslLeaf.l);
        }
        inst.setColorAt(i, c);
      });
      inst.castShadow = true;
      group.add(inst);
    }
  }
  if (rocks.length) {
    const inst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1), new THREE.MeshLambertMaterial({ color: 0xffffff }), rocks.length);
    rocks.forEach((r, i) => {
      m.compose(v.set(r.x, terrainHeight(r.x, r.z) + r.r * 0.5, r.z), q.setFromEuler(e.set(r.rx, r.ry, 0)), s.setScalar(r.r));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, c.setHex(biome.stone).offsetHSL(0, 0, (rand() - 0.5) * 0.12));
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  }

  const welcome = isHome ? 'Ana Sayfa! Bir kapıya girip bölüme başla. 🌈'
    : levelIndex === 0 ? 'Kafesin kapısı açık kalmış! Hadi kaç! 🐉'
    : `${levelTitle(levelIndex)}: ${def.name}`;
  tips.unshift({ z: backZ, text: welcome });
  tips.sort((a, b) => b.z - a.z);

  return {
    group, sun, theme, biome, biomeKey, name: def.name, isFinal, isHome,
    circles, boxes, burnables, coins, chests, enemies, critters, checkpoints, tips, portals, mother, goalZ, start,
  };
}
