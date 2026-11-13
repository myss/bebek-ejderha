// Game loop: levels, input, camera, fire, nets, getting caught, coins, checkpoints and the HUD.

const MAX_HEARTS = 5;
const SAVE_KEY = 'bebek-ejderha-bolum';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const airFog = new THREE.Fog(0xf3d6b4, 60, 260);
const waterFog = new THREE.Fog(0x1d5f8a, 1, 22);
scene.fog = airFog;
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const ui = {
  hearts: document.getElementById('hearts'),
  coins: document.getElementById('coins'),
  energy: document.getElementById('energy-fill'),
  running: document.getElementById('running'),
  touchRun: document.getElementById('touch-run'),
  progressText: document.getElementById('progress-text'),
  progressTrack: document.getElementById('progress-track'),
  progressFill: document.getElementById('progress-fill'),
  progressDragon: document.getElementById('progress-dragon'),
  message: document.getElementById('message'),
  netHelp: document.getElementById('net-help'),
  flash: document.getElementById('flash'),
  mist: document.getElementById('mist'),
  banner: document.getElementById('banner'),
  bannerTitle: document.getElementById('banner-title'),
  bannerSubtitle: document.getElementById('banner-subtitle'),
  paused: document.getElementById('paused'),
  startPanel: document.getElementById('start-panel'),
  startButton: document.getElementById('start-button'),
  homeButton: document.getElementById('home-button'),
  endPanel: document.getElementById('end-panel'),
  endTitle: document.getElementById('end-title'),
  endText: document.getElementById('end-text'),
  nextButton: document.getElementById('next-button'),
  menuButton: document.getElementById('menu-button'),
};

// --- Levels --------------------------------------------------------------------------------

let levelIndex = HOME_LEVEL;
let world = null;
let dragon = null;
let enemies = [];
let critters = [];
let nets = [];

function disposeGroup(group) {
  scene.remove(group);
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of materials) {
      if (m.userData.shared) continue;
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}

function loadLevel(index) {
  if (world) disposeGroup(world.group);
  nets = [];
  levelIndex = index;
  world = buildWorld(scene, index, progress);
  airFog.color.setHex(world.theme.fog);
  waterFog.color.setHex(world.biome.water).multiplyScalar(0.55);
  const enemyRandom = makeRandom(42 + index);
  enemies = world.enemies.map((spec) => new Enemy(world.group, spec, enemyRandom));
  critters = world.critters.map((spec) => new Critter(world.group, spec, enemyRandom));
  if (dragon) dragon.world = world;
  else dragon = new Dragon(scene, world);
  newGame();
}

// How far the player has come: how many levels are open, and how many surprise levels are done.
// An older save is just the number of open levels.
const progress = { unlocked: 1, surpriseDone: 0 };
try {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (typeof saved === 'number') progress.unlocked = saved;
  else if (saved) Object.assign(progress, saved);
} catch (e) {
  // Without storage the progress lasts for this visit only.
}
progress.unlocked = clamp(progress.unlocked, 1, LEVELS.length);

function writeProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch (e) {
    // As above.
  }
}

// Finishing a level opens the next one; finishing a surprise level moves the surprise door on.
function recordFinished(level) {
  if (level < FIRST_SURPRISE_LEVEL) progress.unlocked = Math.max(progress.unlocked, Math.min(level + 2, LEVELS.length));
  else progress.surpriseDone = Math.max(progress.surpriseDone, level - FIRST_SURPRISE_LEVEL + 1);
  writeProgress();
}

function goHome() {
  if (state === 'end') {
    ui.endPanel.classList.add('hidden');
    state = 'play';
  }
  if (state === 'play' && !world.isHome) startCrossing(HOME_LEVEL, 'Ana Sayfa\'ya dönüyorsun! 🏠');
}

// --- Input ---------------------------------------------------------------------------------

const held = new Set();
const pressed = new Set();
const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
// Keys are known by where they sit (e.code), as on a US laptop keyboard, the same as in Kaplan
// Macerası. On a keyboard with another layout the run key 'KeyQ' may carry a different letter.
window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  held.add(e.code);
});
window.addEventListener('keyup', (e) => held.delete(e.code));

// What a key going down does, for the on-screen buttons that press keys.
function pressKey(code) {
  if (!held.has(code)) pressed.add(code);
  held.add(code);
}
window.addEventListener('blur', () => held.clear());
canvas.addEventListener('mousedown', () => pressed.add('Mouse'));

// A tap on Q switches running on or off, because an on-screen keyboard cannot hold two keys at
// once. Holding Q while going forward runs too.
let runSwitchedOn = false;
function switchRunning() {
  runSwitchedOn = !runSwitchedOn;
  ui.running.hidden = !runSwitchedOn;
  ui.touchRun.classList.toggle('on', runSwitchedOn);
  say(runSwitchedOn ? 'Koşma açık! 💨 Q ile kapatırsın.' : 'Koşma kapalı.', 1.5);
}

function readInput() {
  const any = (...codes) => codes.some((c) => held.has(c));
  const once = (...codes) => codes.some((c) => pressed.has(c));
  return {
    move: (any('KeyW', 'ArrowUp') ? 1 : 0) - (any('KeyS', 'ArrowDown') ? 1 : 0),
    turn: (any('KeyA', 'ArrowLeft') ? 1 : 0) - (any('KeyD', 'ArrowRight') ? 1 : 0),
    jumpHeld: any('Space'),
    jumpPressed: once('Space'),
    dive: any('ShiftLeft', 'ShiftRight'),
    run: runSwitchedOn || any('KeyQ'),
    firePressed: once('KeyF', 'KeyJ', 'Mouse'),
    digPressed: once('KeyE', 'KeyK'),
  };
}

// --- Messages ------------------------------------------------------------------------------

let messageTimer = 0;
function say(text, seconds = 3.5) {
  ui.message.textContent = text;
  ui.message.classList.add('visible');
  messageTimer = seconds;
}

const onceMessages = new Set();
function sayOnce(key, text, seconds) {
  if (onceMessages.has(key)) return;
  onceMessages.add(key);
  say(text, seconds);
}

// --- Particles -----------------------------------------------------------------------------

const particleGeometry = new THREE.SphereGeometry(0.25, 6, 4);
const particles = [];
function spawnParticle(position, velocity, color, life, grow, gravity = 0) {
  let p = particles.find((q) => q.life <= 0);
  if (!p) {
    if (particles.length > 300) return;
    const mesh = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    scene.add(mesh);
    p = { mesh, vel: new THREE.Vector3() };
    particles.push(p);
  }
  p.mesh.visible = true;
  p.mesh.position.copy(position);
  p.mesh.material.color.setHex(color);
  p.vel.copy(velocity);
  p.life = p.maxLife = life;
  p.grow = grow;
  p.gravity = gravity;
}

function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.mesh.visible = false;
      continue;
    }
    p.vel.y += p.gravity * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    const t = 1 - p.life / p.maxLife;
    p.mesh.scale.setScalar(1 + t * p.grow);
    p.mesh.material.opacity = 1 - t;
  }
}

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
function burst(position, color, count, speed, gravity = -8) {
  for (let i = 0; i < count; i++) {
    tmp2.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).multiplyScalar(speed);
    spawnParticle(position, tmp2, color, 0.6 + Math.random() * 0.4, 0.5, gravity);
  }
}

// --- Game state ----------------------------------------------------------------------------

let state = 'start';
let hearts = MAX_HEARTS;
let coinsTaken = 0;
let checkpoint = -1;
let tipIndex = 0;
let soundThrottle = 0;
const mouth = new THREE.Vector3();

function newGame() {
  hearts = MAX_HEARTS;
  coinsTaken = 0;
  checkpoint = -1;
  tipIndex = 0;
  onceMessages.clear();
  for (const c of world.coins) {
    c.taken = false;
    c.object.visible = !c.hidden;
  }
  for (const b of world.burnables) {
    if (b.coin) {
      b.coin.hidden = true;
      b.coin.object.visible = false;
    }
    b.burnt = false;
    b.collider.top = 2;
    b.object.userData.hay.material = Models.mat(0xe9c46a);
    b.object.scale.setScalar(1);
  }
  for (const chest of world.chests) {
    chest.opened = false;
    chest.object.userData.lid.rotation.x = 0;
    for (const c of chest.coins) {
      c.hidden = true;
      c.object.visible = false;
    }
  }
  respawn();
  dragon.invulnerable = 0;
}

function respawn() {
  const cp = checkpoint >= 0 ? world.checkpoints[checkpoint] : world.start;
  dragon.reset(cp.x, cp.z);
  dragon.invulnerable = 2.5;
  for (const e of enemies) e.reset();
  for (const n of nets) world.group.remove(n.mesh);
  nets = [];
  ui.netHelp.classList.remove('visible');
}

function caught() {
  hearts--;
  Sound.caught();
  ui.flash.style.opacity = 0.6;
  setTimeout(() => (ui.flash.style.opacity = 0), 300);
  if (hearts <= 0) {
    endLevel('lost');
    return;
  }
  respawn();
  say('Yakalandın! Ama yine kaçtın. Dikkatli ol! 💔', 3);
}

function endLevel(result) {
  state = 'end';
  ui.netHelp.classList.remove('visible');
  const coinText = `Kötü Sihirbaz'ın altınlarından <b>${coinsTaken} / ${world.coins.length}</b> tanesini topladın.`;
  if (result === 'won') {
    Sound.win();
    recordFinished(levelIndex);
    ui.endTitle.textContent = 'Yaşasın! 🎉';
    ui.endText.innerHTML = `Ejderha Dağı'na ulaştın ve annene kavuştun! 🐉💜<br>${coinText}<br>Ana Sayfa'daki ⭐ Sürpriz Kapısı'ndan hiç bitmeyen yeni bölümlere gidebilirsin!`;
    ui.nextButton.textContent = '🏠 Ana Sayfa';
    ui.nextButton.onclick = goHome;
  } else if (result === 'levelDone') {
    // Every level carries straight on to the next one; surprise levels never run out.
    recordFinished(levelIndex);
    startCrossing(levelIndex + 1);
    return;
  } else {
    ui.endTitle.textContent = 'Eyvah! 😢';
    ui.endText.innerHTML = 'Kötü Sihirbaz seni yine yakaladı.<br>Ama bebek ejderhalar pes etmez! Bir daha dene!';
    ui.nextButton.textContent = 'Tekrar dene';
    ui.nextButton.onclick = () => startLevel(levelIndex);
  }
  ui.endPanel.classList.remove('hidden');
}

function startLevel(index) {
  ui.endPanel.classList.add('hidden');
  if (index !== levelIndex) loadLevel(index);
  else newGame();
  state = 'play';
}

ui.menuButton.addEventListener('click', goHome);
ui.homeButton.addEventListener('click', () => {
  ui.homeButton.blur(); // otherwise Space, the jump key, would press it again
  goHome();
});
ui.startButton.addEventListener('click', () => {
  Sound.start();
  ui.startPanel.classList.add('hidden');
  state = 'play';
});

// --- Fire ----------------------------------------------------------------------------------

function inFire(point) {
  tmp.copy(point).sub(mouth);
  if (Math.abs(tmp.y) > 4) return false;
  const d = Math.hypot(tmp.x, tmp.z);
  if (d > 8) return false;
  return d < 1 || (tmp.x * dragon.forward.x + tmp.z * dragon.forward.z) / d > 0.8;
}

function updateFire() {
  if (dragon.fireTime <= 0) return;
  dragon.mouthPosition(mouth);
  if (dragon.mode === 'swim') {
    if (Math.random() < 0.5) spawnParticle(mouth, tmp2.set(dragon.forward.x * 4, 2, dragon.forward.z * 4), 0xcfefff, 1, 0.3);
    for (const e of enemies) {
      if (e.moves !== 'swim' || !inFire(e.pos) || !e.stun()) continue;
      Sound.boing();
      say('Baloncuklar timsahın başını döndürdü! 🫧', 2.5);
    }
    return;
  }
  for (let i = 0; i < 4; i++) {
    tmp2.copy(dragon.forward).multiplyScalar(13);
    tmp2.x += (Math.random() - 0.5) * 4;
    tmp2.y += (Math.random() - 0.3) * 3;
    tmp2.z += (Math.random() - 0.5) * 4;
    const color = [0xfff3a0, 0xffb02e, 0xff6a1a, 0xe83a14][(Math.random() * 4) | 0];
    spawnParticle(mouth, tmp2, color, 0.45, 3, 2);
  }
  if (dragon.mode === 'netted') return;

  for (const e of enemies) {
    if (!inFire(tmp.copy(e.pos).setY(e.pos.y + 1))) continue;
    if (!e.stun()) continue;
    Sound.boing();
    if (e.type === 'wizard') say('Sihirbazın bıyığı kavruldu! 😂', 2.5);
    else if (e.type === 'robot') say('Robotun devreleri yandı! ⚡', 2);
  }
  nets = nets.filter((n) => {
    if (!inFire(n.mesh.position)) return true;
    burst(n.mesh.position, 0xffb02e, 8, 4);
    world.group.remove(n.mesh);
    return false;
  });
  for (const b of world.burnables) {
    if (b.burnt || !inFire(tmp.set(b.collider.x, b.object.position.y + 1, b.collider.z))) continue;
    b.burnt = true;
    b.collider.top = -100;
    b.object.userData.hay.material = Models.mat(0x2b2b2b);
    b.object.scale.setScalar(0.5);
    Sound.burn();
    burst(tmp, 0x555555, 20, 5, 2);
    if (b.coin) {
      b.coin.hidden = false;
      b.coin.object.visible = !b.coin.taken;
      say('Samanın içinden altın çıktı! 🪙', 2);
    }
  }
}

// --- Main loop -----------------------------------------------------------------------------

function nearTallWall(z) {
  return LEVEL.walls.some((w) => w.top > RULES.flyCeiling && z > w.z && z < w.z + 30);
}

function handleDragonEvents(events) {
  for (const ev of events) {
    switch (ev) {
      case 'fire': Sound.fire(); break;
      case 'bubbles': Sound.bubbles(); sayOnce('bubbles', 'Su altında ateş çıkmıyor, baloncuk çıkıyor! 🫧', 2.5); break;
      case 'jump': Sound.jump(); break;
      case 'jumpOut': Sound.splash(); break;
      case 'dive': Sound.bubbles(); sayOnce('dive', 'Dibe dalıyorsun! Yukarı çıkmak için E ya da Boşluk. 🫧', 2.5); break;
      case 'rise': Sound.bubbles(); break;
      case 'flap': Sound.flap(); break;
      case 'land': Sound.land(); break;
      case 'splash':
        Sound.splash();
        burst(tmp.set(dragon.pos.x, RULES.waterLevel, dragon.pos.z), 0xbfe8ff, 18, 6);
        break;
      case 'dig':
        Sound.dig();
        burst(tmp.copy(dragon.pos), 0x7a5230, 16, 5);
        break;
      case 'digging':
        Sound.dig();
        burst(tmp.set(dragon.pos.x, terrainHeight(dragon.pos.x, dragon.pos.z) + 0.3, dragon.pos.z), 0x7a5230, 4, 3);
        break;
      case 'popOut':
        Sound.popOut();
        burst(tmp.copy(dragon.pos), 0x7a5230, 20, 6);
        break;
      case 'cantSurface': sayOnce('cantSurface' + Math.round(dragon.pos.z / 20), 'Burada yukarı çıkamazsın, biraz daha kaz!', 2); break;
      case 'digWater': sayOnce('digWater', 'Suyun altından kazamazsın. Yüzerek geç!', 2.5); break;
      case 'tired': say('Yoruldun! Biraz yürü, gücün dolsun.', 2); break;
      case 'ceiling':
        if (nearTallWall(dragon.pos.z)) sayOnce('wallCeiling' + Math.round(dragon.pos.z / 50), 'Duvar çok yüksek! Yere in ve E ile altından kaz.', 3);
        else sayOnce('ceiling', 'Bebek ejderhalar daha yükseğe uçamaz!', 2);
        break;
      case 'burnNet':
        Sound.burnNet();
        burst(tmp.copy(dragon.pos).setY(dragon.pos.y + 1.2), 0xff8a1f, 6, 4);
        break;
      case 'freed':
        Sound.freed();
        ui.netHelp.classList.remove('visible');
        burst(tmp.copy(dragon.pos).setY(dragon.pos.y + 1.2), 0xffd34d, 25, 7);
        say('Ağı yaktın, kurtuldun! 🔥', 2);
        break;
    }
  }
}

// Puffs of dust behind a running dragon, or spray when it races along the water.
function kickUpDust(dt) {
  if (!dragon.running || Math.random() > dt * 30) return;
  const onWater = dragon.mode === 'swim' && dragon.pos.y > SWIM_FLOAT - 0.5;
  if (dragon.mode !== 'ground' && !onWater) return;
  const back = 1 + Math.random() * 3;
  tmp.set(dragon.pos.x - dragon.forward.x * back + (Math.random() - 0.5), onWater ? RULES.waterLevel : dragon.pos.y + 0.2, dragon.pos.z - dragon.forward.z * back + (Math.random() - 0.5));
  tmp2.set((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2);
  spawnParticle(tmp, tmp2, onWater ? 0xe0f4ff : world.biome.path, 0.7, 4, -1);
}

function updateEnemies(dt) {
  soundThrottle = Math.max(0, soundThrottle - dt);
  for (const e of enemies) {
    const r = e.update(dt, dragon, world);
    if (r === 'spotted' && soundThrottle === 0) {
      soundThrottle = 0.6;
      ({
        guard: Sound.hey, dog: Sound.bark, wolf: Sound.growl, bear: Sound.growl, scorpion: Sound.snap,
        crocodile: Sound.snap, eagle: Sound.screech, robot: Sound.beep, wizard: Sound.evilLaugh,
      })[e.type]();
      if (e.type === 'wizard') say('Kötü Sihirbaz: "Bıyığım üstüne yemin ederim, seni yakalayacağım!"', 3.5);
    } else if (r === 'shoot') {
      const from = e.pos.clone();
      from.y += 1.8 * e.mesh.scale.y;
      from.x += Math.sin(e.heading) * 1.4;
      from.z += Math.cos(e.heading) * 1.4;
      const to = dragon.pos.clone();
      to.y += 1;
      nets.push(new Net(world.group, from, to, e.stats.netSpeed));
      Sound.netShot();
    }
    if (dragon.invulnerable === 0 && e.touches(dragon)) {
      caught();
      return;
    }
  }
}

function updateNets(dt) {
  nets = nets.filter((n) => {
    n.update(dt);
    tmp.copy(dragon.pos).setY(dragon.pos.y + 1);
    if (n.life > 0 && !dragon.hidden && dragon.invulnerable === 0 && dragon.mode !== 'netted' && n.mesh.position.distanceTo(tmp) < 1.5) {
      dragon.getNetted();
      Sound.netted();
      ui.netHelp.classList.add('visible');
      n.life = 0;
    }
    if (n.life <= 0) world.group.remove(n.mesh);
    return n.life > 0;
  });
}

function updateCoins(dt) {
  tmp.copy(dragon.pos).setY(dragon.pos.y + 1);
  for (const chest of world.chests) {
    if (chest.opened || chest.object.position.distanceTo(tmp) > 3) continue;
    chest.opened = true;
    chest.object.userData.lid.rotation.x = -1.3;
    for (const c of chest.coins) {
      c.hidden = false;
      c.object.visible = true;
    }
    Sound.checkpoint();
    const top = chest.object.position.clone();
    top.y += 1.5;
    burst(top, 0xffd700, 30, 5, 1);
    say('Hazine sandığını buldun! İçinden altınlar çıktı! 💎', 3);
  }
  for (const c of world.coins) {
    if (c.taken || c.hidden) continue;
    c.object.rotation.y += dt * 3;
    if (c.object.position.distanceTo(tmp) < 1.7) {
      c.taken = true;
      c.object.visible = false;
      coinsTaken++;
      Sound.coin();
      burst(c.object.position, 0xffd700, 8, 4);
    }
  }
}

function updateProgress() {
  if (tipIndex < world.tips.length && dragon.pos.z < world.tips[tipIndex].z) {
    say(world.tips[tipIndex].text, 5);
    tipIndex++;
  }
  const next = world.checkpoints[checkpoint + 1];
  if (next && dragon.pos.z < next.z && dragon.mode !== 'dig') {
    checkpoint++;
    Sound.checkpoint();
    say('Kontrol noktası! Yakalanırsan buradan devam edersin. ✨', 3);
  }
  if (world.isHome) {
    enterDoors();
  } else if (world.mother) {
    const m = world.mother.position;
    if (Math.hypot(dragon.pos.x - m.x, dragon.pos.z - m.z) < 10) endLevel('won');
  } else if (dragon.pos.z < world.goalZ && dragon.mode !== 'dig') {
    endLevel('levelDone');
  }
}

// On the home meadow, flying or walking into a door's glow takes the dragon to that level.
function enterDoors() {
  for (const door of world.portals) {
    if (Math.hypot(dragon.pos.x - door.x, dragon.pos.z - door.z) > 3 || dragon.pos.y > terrainHeight(door.x, door.z) + 4 || dragon.hidden) continue;
    if (door.locked) {
      sayOnce(`locked${door.level}`, 'Bu kapı kilitli! 🔒 Önce ondan önceki bölümü bitir.', 2.5);
    } else {
      startCrossing(door.level, `${door.label} kapısından geçtin! ✨`);
    }
    return;
  }
}

function glowDoors(time) {
  if (!world.isHome) return;
  for (const [i, door] of world.portals.entries()) door.glow.material.opacity = door.locked ? 0.35 : 0.45 + Math.sin(time * 3 + i) * 0.15;
}

function updateCamera(dt) {
  const swimming = dragon.mode === 'swim';
  const back = swimming ? 6 : 8.5;
  const up = swimming ? 2.2 : dragon.mode === 'dig' ? 5.5 : 4.2;
  const base = dragon.mode === 'dig' ? terrainHeight(dragon.pos.x, dragon.pos.z) : dragon.pos.y;
  tmp.set(dragon.pos.x - dragon.forward.x * back, base + up, dragon.pos.z - dragon.forward.z * back);
  camera.position.lerp(tmp, 1 - Math.exp(-5 * dt));
  const floor = terrainHeight(camera.position.x, camera.position.z);
  camera.position.y = Math.max(camera.position.y, floor + 0.8);
  // Keep fences and walls from coming between the camera and the dragon.
  for (const b of world.boxes) {
    if (camera.position.y >= b.top) continue;
    const near = b.minZ - 0.6;
    const far = b.maxZ + 0.6;
    if (dragon.pos.z < near) camera.position.z = Math.min(camera.position.z, near);
    else if (dragon.pos.z > far) camera.position.z = Math.max(camera.position.z, far);
    else if (camera.position.z > near && camera.position.z < far) camera.position.z = far;
  }
  tmp.set(dragon.pos.x + dragon.forward.x * 2, base + 1.4, dragon.pos.z + dragon.forward.z * 2);
  camera.lookAt(tmp);

  const underwater = camera.position.y < RULES.waterLevel && isRiver(camera.position.z);
  scene.fog = underwater ? waterFog : airFog;

  world.sun.position.set(dragon.pos.x + 30, 60, dragon.pos.z + 25);
  world.sun.target.position.set(dragon.pos.x, 0, dragon.pos.z);
}

function updateHud() {
  ui.hearts.textContent = '❤️'.repeat(Math.max(0, hearts)) + '🤍'.repeat(MAX_HEARTS - Math.max(0, hearts));
  ui.coins.textContent = `🪙 ${coinsTaken} / ${world.coins.length}`;
  ui.energy.style.width = `${dragon.energy}%`;
  ui.homeButton.hidden = world.isHome;
  ui.progressTrack.hidden = world.isHome;
  if (world.isHome) {
    ui.progressText.textContent = '🏠 Ana Sayfa · Bir kapıya gir!';
    return;
  }
  const total = world.start.z - world.goalZ;
  const done = clamp((world.start.z - dragon.pos.z) / total, 0, 1);
  const meters = Math.max(0, Math.round(dragon.pos.z - world.goalZ));
  const where = world.isFinal ? 'Ejderha Dağı\'na' : 'Gökkuşağı kapısına';
  const title = levelIndex < FIRST_SURPRISE_LEVEL ? `Bölüm ${levelIndex + 1}/${LEVELS.length}` : `⭐ ${levelTitle(levelIndex)}: ${world.name}`;
  ui.progressText.textContent = `${title} · ${where} ${meters} metre`;
  ui.progressFill.style.width = `${done * 100}%`;
  ui.progressDragon.style.left = `${done * 100}%`;
}

function animateMother(time) {
  if (!world.mother) return;
  const u = world.mother.userData;
  for (const w of u.wings) w.rotation.z = w.userData.side * (0.4 + Math.sin(time * 2) * 0.25);
  u.head.rotation.x = Math.sin(time * 1.3) * 0.1;
  Models.poseDragon(world.mother, time * 2, 0.25, 0.15);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (pressed.has('KeyP') || pressed.has('Escape')) {
    if (state === 'play') state = 'paused';
    else if (state === 'paused') state = 'play';
    ui.paused.classList.toggle('visible', state === 'paused');
  }
  // The cheat key: finish the level right away.
  if (pressed.has('KeyO') && state === 'play' && !world.isHome) endLevel(world.mother ? 'won' : 'levelDone');
  if (pressed.has('KeyH')) goHome();
  if (pressed.has('KeyQ') && state === 'play') switchRunning();
  if (pressed.has('KeyM')) say(Sound.toggleMusic() ? 'Müzik açık 🎵' : 'Müzik kapalı', 1.5);

  if (state === 'play') {
    const events = dragon.update(dt, readInput());
    handleDragonEvents(events);
    kickUpDust(dt);
    updateFire();
    if (dragon.mode === 'netted') sayOnce('netted', 'Ağa yakalandın! F tuşuna hızlı hızlı basarak ağı yak!', 3);
    updateEnemies(dt);
    if (state === 'play') updateNets(dt);
    updateCoins(dt);
    if (state === 'play') updateProgress();
  } else if (state === 'crossing') {
    updateCrossing(dt);
  }
  pressed.clear();

  if (state !== 'paused') for (const c of critters) c.update(dt, dragon, world);
  updateParticles(dt);
  animateMother(now / 1000);
  glowDoors(now / 1000);
  updateCamera(dt);
  updateHud();
  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) ui.message.classList.remove('visible');
  }
  renderer.render(scene, camera);
}

loadLevel(HOME_LEVEL);
camera.position.set(dragon.pos.x, 5, dragon.pos.z + 9);
requestAnimationFrame(frame);
