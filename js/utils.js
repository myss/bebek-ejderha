// Shared helpers. RULES holds what is the same in every level; LEVEL holds the layout of the
// level being played. Every level runs from its start (z > 0) toward its end along -z.

const RULES = {
  waterLevel: -0.8,
  flyCeiling: 11,
  bridgeHalfWidth: 4,
  bridgeTop: 0.5,
};

let LEVEL = { halfWidth: 46, backZ: 40, endZ: -400, goalZ: -390, rivers: [], walls: [], path: { amp: 8, freq: 0.018, phase: 0 } };

function makeRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function pathX(z) {
  const p = LEVEL.path;
  return p.amp * Math.sin(z * p.freq + p.phase);
}

function riverAt(z) {
  for (const r of LEVEL.rivers) if (z < r.near && z > r.far) return r;
  return null;
}

function isRiver(z) {
  return riverAt(z) !== null;
}

function terrainHeight(x, z) {
  let h = 0;
  const river = riverAt(z);
  if (river) h -= Math.min(river.depth, Math.min(river.near - z, z - river.far) * river.slope);
  const edge = LEVEL.halfWidth - 2;
  const ax = Math.abs(x);
  if (ax > edge) h += Math.min(28, (ax - edge) * (ax - edge) * 0.25);
  if (z < LEVEL.endZ) h += Math.min(20, (LEVEL.endZ - z) * 0.6);
  if (z > LEVEL.backZ) h += Math.min(20, (z - LEVEL.backZ) * 0.6);
  return h;
}

function onBridge(x, z) {
  for (const r of LEVEL.rivers) {
    if (r.bridgeX !== null && Math.abs(x - r.bridgeX) < RULES.bridgeHalfWidth && z < r.near + 3 && z > r.far - 3) return true;
  }
  return false;
}

// Height a walker stands on. Something at or above the bridge deck stands on it; below it
// (swimming under the bridge) the riverbed counts.
function floorAt(x, z, y) {
  const ground = terrainHeight(x, z);
  if (onBridge(x, z) && y > RULES.bridgeTop - 1) return Math.max(ground, RULES.bridgeTop);
  return ground;
}

// Deep enough to swim in, as opposed to the shallow edge you wade through.
function isDeepWater(x, z) {
  return isRiver(z) && terrainHeight(x, z) < RULES.waterLevel - 1.5;
}

function textSprite(text, size = 1.2) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '96px "Segoe UI Emoji", "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, 64, 68);
  ctx.fillStyle = '#ffd400';
  ctx.fillText(text, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 10;
  return sprite;
}
