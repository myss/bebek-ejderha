// The trip between two levels, played by itself: the dragon slithers through the rainbow gate and
// up into thickening fog, a white mist hides the swap, and it glides down out of the sky into the
// next level while the new level's name shows. On the way down the air is full of what that place
// is made of: petals, leaves, snowflakes, sand, fireflies or embers.
//
// The next level is built under the mist, because building freezes the page for a moment.

const CROSSING_OUT_SECONDS = 4.5;
const CROSSING_IN_SECONDS = 4;
const CROSSING_SPEED = 12;
const CROSSING_CLIMB_HEIGHT = 24;
const ARRIVAL_HEIGHT = 26;
const ARRIVAL_DISTANCE = 40; // behind the start, over the hill at the back of the level
const MIST_SECONDS = 0.8;
const CLEAR_FOG = { near: 60, far: 260 };
const THICK_FOG = { near: 1, far: 25 };

const BIOME_FLAKES = {
  meadow: { colors: [0xffffff, 0xffc4dd, 0xfff3a0], fall: 1.5 },
  forest: { colors: [0x7ac142, 0xe0a030, 0xc0602a], fall: 2 },
  snow: { colors: [0xffffff, 0xeaf4ff], fall: 2.5 },
  desert: { colors: [0xe8cf8f, 0xd9b870], fall: 0.5, drift: 6 },
  swamp: { colors: [0xd4ff6a, 0xaaff55], fall: -0.3 },
  volcano: { colors: [0xff7a1a, 0xffc040, 0xff4010], fall: -2.5 },
};

let crossing = null;

// message is what shows on the way up; by default, how the level went.
function startCrossing(nextLevel, message) {
  crossing = { phase: 'out', time: 0, nextLevel, from: null };
  state = 'crossing';
  ui.netHelp.classList.remove('visible');
  dragon.mode = 'air';
  dragon.vy = 0;
  dragon.diving = false;
  dragon.running = false;
  dragon.cocoon.visible = false;
  dragon.mound.visible = false;
  if (message) {
    Sound.checkpoint();
    say(message, 4);
  } else {
    Sound.win();
    say(`${levelTitle(levelIndex)} bitti! 🌈 ${coinsTaken} / ${world.coins.length} altın topladın.`, 4);
  }
}

function setMist(opacity) {
  ui.mist.style.opacity = clamp(opacity, 0, 1);
}

function setFogThickness(progress) {
  const p = progress * progress;
  airFog.near = CLEAR_FOG.near + (THICK_FOG.near - CLEAR_FOG.near) * p;
  airFog.far = CLEAR_FOG.far + (THICK_FOG.far - CLEAR_FOG.far) * p;
}

function showBanner(title, subtitle) {
  ui.bannerTitle.textContent = title;
  ui.bannerSubtitle.textContent = subtitle;
  ui.banner.classList.add('visible');
  setTimeout(() => ui.banner.classList.remove('visible'), 3500);
}

// Follows the winding path ahead, like it knows the way.
function flyAlongPath(dt) {
  const tz = dragon.pos.z - 10;
  const want = Math.atan2(pathX(tz) - dragon.pos.x, tz - dragon.pos.z);
  const turn = Math.atan2(Math.sin(want - dragon.heading), Math.cos(want - dragon.heading));
  dragon.heading += clamp(turn, -1.5 * dt, 1.5 * dt);
  dragon.forward.set(Math.sin(dragon.heading), 0, Math.cos(dragon.heading));
  dragon.pos.addScaledVector(dragon.forward, CROSSING_SPEED * dt);
}

function sprinkleFlakes(dt) {
  const flakes = BIOME_FLAKES[world.biomeKey];
  if (Math.random() > dt * 40) return;
  const p = camera.position.clone();
  p.x += (Math.random() - 0.5) * 24;
  p.y += (Math.random() - 0.3) * 10;
  p.z -= 9 + Math.random() * 16;
  const color = flakes.colors[Math.floor(Math.random() * flakes.colors.length)];
  const v = new THREE.Vector3((Math.random() - 0.5) + (flakes.drift || 0), -flakes.fall, (Math.random() - 0.5));
  spawnParticle(p, v, color, 2.5, 0, 0);
}

function arriveAtNextLevel() {
  loadLevel(crossing.nextLevel);
  tipIndex = 1; // the banner already says which level this is
  const s = world.start;
  crossing.phase = 'in';
  crossing.time = 0;
  crossing.from = new THREE.Vector3(s.x, ARRIVAL_HEIGHT, s.z + ARRIVAL_DISTANCE);
  dragon.reset(s.x, s.z);
  dragon.mode = 'air';
  dragon.pos.copy(crossing.from);
  camera.position.set(s.x, ARRIVAL_HEIGHT + 4, s.z + ARRIVAL_DISTANCE + 9);
  messageTimer = 0;
  ui.message.classList.remove('visible');
  showBanner(levelTitle(levelIndex), world.name);
}

function finishCrossing() {
  crossing = null;
  setMist(0);
  setFogThickness(0);
  dragon.mode = 'ground';
  dragon.pos.y = terrainHeight(dragon.pos.x, dragon.pos.z);
  dragon.vy = 0;
  dragon.invulnerable = 2;
  Sound.land();
  state = 'play';
}

function updateCrossing(dt) {
  const c = crossing;
  c.time += dt;
  dragon.flapTime += dt * 10;
  dragon.walkTime += dt * 5;

  if (c.phase === 'out') {
    flyAlongPath(dt);
    dragon.pos.y += (CROSSING_CLIMB_HEIGHT - dragon.pos.y) * Math.min(1, dt * 0.8);
    dragon.pos.y = Math.max(dragon.pos.y, terrainHeight(dragon.pos.x, dragon.pos.z) + 5); // over the hill at the end
    dragon.vy = 3;
    setFogThickness(clamp(c.time / CROSSING_OUT_SECONDS, 0, 1));
    setMist((c.time - (CROSSING_OUT_SECONDS - MIST_SECONDS)) / MIST_SECONDS);
    if (c.time >= CROSSING_OUT_SECONDS) arriveAtNextLevel();
  } else {
    const p = clamp(c.time / CROSSING_IN_SECONDS, 0, 1);
    const eased = p * p * (3 - 2 * p);
    const s = world.start;
    dragon.pos.set(s.x, c.from.y + (terrainHeight(s.x, s.z) - c.from.y) * eased, c.from.z + (s.z - c.from.z) * eased);
    dragon.vy = -4 * (1 - p);
    setFogThickness(1 - p);
    setMist(1 - c.time / MIST_SECONDS);
    sprinkleFlakes(dt);
    if (p >= 1) finishCrossing();
  }
  dragon.updateMesh(dt);
}
