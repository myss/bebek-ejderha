// Harmless animals that make each place feel alive. Fish swim circles under water, birds circle
// high in the sky, and the land animals wander and run away when the dragon comes close.

const CRITTER_TYPES = {
  fish: { moves: 'circle', speed: 2.5 },
  bird: { moves: 'circle', speed: 6 },
  rabbit: { moves: 'hop', speed: 7, shy: 8 },
  frog: { moves: 'hop', speed: 4, shy: 5 },
  deer: { moves: 'walk', speed: 8, shy: 11 },
  penguin: { moves: 'walk', speed: 2.5, shy: 6 },
};

const FISH_COLORS = [0xff8c1a, 0xffd23f, 0x3ab0ff, 0xff5c8a, 0x9b5de5];
const BIRD_COLORS = [0x3a3a3a, 0xe8e8e8, 0x4a7fd6, 0xc0392b];

class Critter {
  constructor(group, spec, rand) {
    this.type = spec.type;
    this.stats = CRITTER_TYPES[spec.type];
    this.rand = rand;
    if (spec.type === 'fish') this.mesh = Models.fish(FISH_COLORS[Math.floor(rand() * FISH_COLORS.length)]);
    else if (spec.type === 'bird') this.mesh = Models.bird(BIRD_COLORS[Math.floor(rand() * BIRD_COLORS.length)]);
    else this.mesh = Models[spec.type]();
    group.add(this.mesh);
    this.home = new THREE.Vector3(spec.x, spec.y ?? terrainHeight(spec.x, spec.z), spec.z);
    this.pos = this.home.clone();
    this.target = new THREE.Vector3();
    this.radius = this.type === 'bird' ? 10 + rand() * 12 : 2 + rand() * 4;
    this.angle = rand() * Math.PI * 2;
    this.direction = rand() < 0.5 ? -1 : 1;
    this.hop = rand() * 10;
    this.pickTarget();
  }

  pickTarget() {
    const a = this.rand() * Math.PI * 2;
    const r = 2 + this.rand() * 8;
    this.target.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
    this.wait = this.rand() * 3;
  }

  canStandAt(x, z, world) {
    if (Math.abs(x) > LEVEL.halfWidth - 2 || z > LEVEL.backZ - 1 || z < LEVEL.endZ || isRiver(z)) return false;
    for (const c of world.circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 0.4) ** 2) return false;
    for (const b of world.boxes) if (x > b.minX - 0.5 && x < b.maxX + 0.5 && z > b.minZ - 0.5 && z < b.maxZ + 0.5) return false;
    return true;
  }

  update(dt, dragon, world) {
    const s = this.stats;
    const m = this.mesh;
    if (s.moves === 'circle') {
      this.angle += (s.speed / this.radius) * dt * this.direction;
      this.pos.set(this.home.x + Math.cos(this.angle) * this.radius, this.home.y + Math.sin(this.angle * 3) * 0.4, this.home.z + Math.sin(this.angle) * this.radius);
      this.pos.y = Math.max(this.pos.y, terrainHeight(this.pos.x, this.pos.z) + 0.4);
      m.position.copy(this.pos);
      m.rotation.y = -this.angle + (this.direction > 0 ? 0 : Math.PI);
      const t = performance.now() * 0.001;
      if (m.userData.tail) m.userData.tail.rotation.y = Math.sin(t * 10) * 0.5;
      if (m.userData.wings) for (const w of m.userData.wings) w.rotation.z = w.userData.side * Math.sin(t * 8 + this.angle) * 0.6;
      return;
    }

    let speed = s.speed * 0.35;
    const dx = this.pos.x - dragon.pos.x;
    const dz = this.pos.z - dragon.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < s.shy && !dragon.hidden) {
      this.target.set(this.pos.x + (dx / d) * 6, 0, this.pos.z + (dz / d) * 6);
      this.wait = 0;
      speed = s.speed;
    }
    const tx = this.target.x - this.pos.x;
    const tz = this.target.z - this.pos.z;
    const td = Math.hypot(tx, tz);
    let moving = false;
    if (this.wait > 0) {
      this.wait -= dt;
    } else if (td < 0.4) {
      this.pickTarget();
    } else {
      const step = Math.min(td, speed * dt);
      const nx = this.pos.x + (tx / td) * step;
      const nz = this.pos.z + (tz / td) * step;
      if (this.canStandAt(nx, nz, world) && Math.hypot(nx - this.home.x, nz - this.home.z) < 20) {
        this.pos.x = nx;
        this.pos.z = nz;
        moving = true;
      } else {
        this.pickTarget();
      }
      m.rotation.y = Math.atan2(tx, tz);
    }
    this.pos.y = terrainHeight(this.pos.x, this.pos.z);
    m.position.copy(this.pos);
    if (moving) {
      this.hop += dt * (s.moves === 'hop' ? 10 : 8);
      m.position.y += s.moves === 'hop' ? Math.abs(Math.sin(this.hop)) * 0.6 : 0;
      m.rotation.z = s.moves === 'walk' && this.type === 'penguin' ? Math.sin(this.hop) * 0.15 : 0;
    }
  }
}
