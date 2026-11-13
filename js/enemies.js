// The wizard and everyone who chases for him. Walkers (guards, robots, dogs, wolves, scorpions,
// bears) stay on land, the eagle flies, the crocodile only swims. They patrol near home, chase a
// dragon they can see, and go back home when it gets away.

const ENEMY_TYPES = {
  guard: { moves: 'walk', patrol: 2.5, chase: 6.5, sight: 16, leash: 45, stun: 4, netSpeed: 16, netEvery: 2.6, range: 18 },
  dog: { moves: 'walk', patrol: 3, chase: 10, sight: 13, leash: 40, stun: 4 },
  wolf: { moves: 'walk', patrol: 3, chase: 10, sight: 15, leash: 40, stun: 4 },
  scorpion: { moves: 'walk', patrol: 2.5, chase: 8.5, sight: 12, leash: 35, stun: 4 },
  bear: { moves: 'walk', patrol: 1.5, chase: 5.5, sight: 12, leash: 35, stun: 4 },
  robot: { moves: 'walk', patrol: 2, chase: 4.5, sight: 22, leash: 35, stun: 5, netSpeed: 14, netEvery: 3.2, range: 20 },
  wizard: { moves: 'walk', patrol: 3, chase: 7.5, sight: 30, leash: 80, stun: 3, netSpeed: 22, netEvery: 1.8, range: 26 },
  eagle: { moves: 'fly', patrol: 5, chase: 10, sight: 24, leash: 60, stun: 3 },
  crocodile: { moves: 'swim', patrol: 2, chase: 5.5, sight: 16, leash: 30, stun: 4 },
};

const EAGLE_ALTITUDE = 9;

class Enemy {
  constructor(scene, spec, rand) {
    this.type = spec.type;
    this.stats = ENEMY_TYPES[spec.type];
    this.moves = this.stats.moves;
    this.hasGun = spec.type === 'robot' || spec.type === 'wizard' || !!spec.gun;
    this.onBridgeHome = !!spec.onBridge;
    this.rand = rand;
    this.mesh = spec.type === 'guard' ? Models.guard(spec.gun) : Models[spec.type]();
    scene.add(this.mesh);
    this.alert = textSprite('!', 1.4);
    this.stars = textSprite('💫', 1.6);
    this.mesh.add(this.alert);
    this.mesh.add(this.stars);
    const h = this.mesh.userData.height;
    this.alert.position.y = h + 0.6;
    this.stars.position.y = h + 0.3;
    this.home = new THREE.Vector3(spec.x, 0, spec.z);
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.pos.set(this.home.x, this.restingHeight(), this.home.z);
    this.heading = this.rand() * Math.PI * 2;
    this.state = 'patrol';
    this.stateTime = 0;
    this.lostTime = 0;
    this.gunCooldown = 1 + this.rand() * 2;
    this.walk = 0;
    this.pickPatrolTarget();
    this.sync();
  }

  // Height when not chasing: on the ground, high in the air, or with its back at the water top.
  restingHeight() {
    if (this.moves === 'fly') return EAGLE_ALTITUDE;
    if (this.moves === 'swim') return RULES.waterLevel - 0.6;
    return floorAt(this.home.x, this.home.z, 10);
  }

  pickPatrolTarget() {
    const r = this.onBridgeHome ? 6 : this.moves === 'fly' ? 18 : 10;
    const a = this.rand() * Math.PI * 2;
    this.target.set(this.home.x + Math.cos(a) * (this.onBridgeHome ? 0.5 : r), 0, this.home.z + Math.sin(a) * r);
  }

  canStandAt(x, z, world) {
    if (Math.abs(x) > LEVEL.halfWidth - 2 || z > LEVEL.backZ - 1 || z < LEVEL.endZ) return false;
    if (this.moves === 'swim') return isDeepWater(x, z) && !onBridge(x, z);
    for (const b of world.boxes) if (x > b.minX - 0.6 && x < b.maxX + 0.6 && z > b.minZ - 0.6 && z < b.maxZ + 0.6 && this.pos.y < b.top) return false;
    if (this.moves === 'fly') return true;
    if (isRiver(z) && !onBridge(x, z)) return false;
    for (const c of world.circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 0.6) ** 2) return false;
    return true;
  }

  stepToward(tx, tz, speed, dt, world) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) return d;
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.heading += clamp(diff, -6 * dt, 6 * dt);
    const step = Math.min(d, speed * dt);
    const nx = this.pos.x + (dx / d) * step;
    const nz = this.pos.z + (dz / d) * step;
    if (this.canStandAt(nx, nz, world)) {
      this.pos.x = nx;
      this.pos.z = nz;
    } else if (this.canStandAt(nx, this.pos.z, world)) {
      this.pos.x = nx;
    } else if (this.canStandAt(this.pos.x, nz, world)) {
      this.pos.z = nz;
    } else {
      return -1;
    }
    this.walk += step * 2.5;
    return d;
  }

  stun() {
    if (this.state === 'stunned') return false;
    this.state = 'stunned';
    this.stateTime = this.stats.stun;
    return true;
  }

  // A crocodile only notices a swimming dragon, but sees it even deep under water.
  canSee(dragon, dist) {
    if (this.moves === 'swim') return dragon.mode === 'swim' && dist < this.stats.sight;
    if (dragon.hidden || dist >= this.stats.sight) return false;
    // An eagle hunts in the air and on land; a dragon in the water is out of its reach.
    if (this.moves === 'fly' && dragon.mode === 'swim') return false;
    return this.moves === 'fly' || dragon.pos.y - this.pos.y < 12;
  }

  // Returns 'spotted' when it first sees the dragon and 'shoot' when it fires a net.
  update(dt, dragon, world) {
    const s = this.stats;
    const dx = dragon.pos.x - this.pos.x;
    const dz = dragon.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const sees = this.canSee(dragon, dist);
    const fromHome = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    let result = null;
    let wantY = this.restingHeight();

    this.gunCooldown = Math.max(0, this.gunCooldown - dt);
    if (this.state === 'stunned') {
      this.stateTime -= dt;
      this.heading += dt * 8;
      if (this.moves === 'fly') wantY = terrainHeight(this.pos.x, this.pos.z) + 1.5;
      if (this.stateTime <= 0) this.state = 'return';
    } else if (this.state === 'patrol') {
      if (this.stepToward(this.target.x, this.target.z, s.patrol, dt, world) < 0.5) this.pickPatrolTarget();
      if (sees) {
        this.state = 'chase';
        result = 'spotted';
      }
    } else if (this.state === 'chase') {
      if (sees) this.lostTime = 0;
      else this.lostTime += dt;
      const keepDistance = this.hasGun && this.type !== 'wizard' && dist < 6;
      if (!keepDistance) this.stepToward(dragon.pos.x, dragon.pos.z, s.chase, dt, world);
      else this.heading = Math.atan2(dx, dz);
      if (this.moves !== 'walk') wantY = dragon.pos.y + (this.moves === 'fly' ? 1 : 0.4);
      if (fromHome > s.leash || this.lostTime > 2) this.state = 'return';
      if (this.hasGun && sees && dist < s.range && this.gunCooldown === 0 && dragon.mode !== 'netted') {
        this.gunCooldown = s.netEvery;
        result = 'shoot';
      }
    } else if (this.state === 'return') {
      if (this.stepToward(this.home.x, this.home.z, s.patrol * 1.5, dt, world) < 1) this.state = 'patrol';
      if (sees && fromHome < s.leash * 0.7) {
        this.state = 'chase';
        result = 'spotted';
      }
    }

    if (this.moves === 'walk') {
      this.pos.y = floorAt(this.pos.x, this.pos.z, this.pos.y + 1);
    } else {
      let floor = terrainHeight(this.pos.x, this.pos.z) + 0.4;
      if (this.moves === 'fly' && isRiver(this.pos.z)) floor = Math.max(floor, RULES.waterLevel + 1);
      const ceiling = this.moves === 'swim' ? RULES.waterLevel - 0.6 : RULES.flyCeiling + 2;
      wantY = clamp(wantY, floor, ceiling);
      this.pos.y += clamp(wantY - this.pos.y, -6 * dt, 6 * dt);
    }
    this.sync();
    return result;
  }

  // Close enough, at the same height, to grab the dragon.
  touches(dragon) {
    if (this.state === 'stunned') return false;
    if (this.moves === 'swim') {
      return dragon.mode === 'swim' && this.pos.distanceTo(dragon.pos) < 2.2;
    }
    if (dragon.hidden) return false;
    const d = Math.hypot(dragon.pos.x - this.pos.x, dragon.pos.z - this.pos.z);
    if (this.moves === 'fly') return dragon.mode !== 'swim' && d < 1.8 && Math.abs(dragon.pos.y + 1 - this.pos.y) < 1.6;
    return d < 1.8 && Math.abs(dragon.pos.y - this.pos.y) < 2.2;
  }

  sync() {
    const m = this.mesh;
    const u = m.userData;
    const stunned = this.state === 'stunned';
    const t = performance.now() * 0.001;
    m.position.copy(this.pos);
    m.rotation.y = this.heading;
    if (this.moves === 'walk') m.position.y += stunned ? 0 : Math.abs(Math.sin(this.walk)) * 0.12;
    if (this.moves === 'fly') m.position.y += Math.sin(t * 2) * 0.3;
    m.rotation.z = stunned ? Math.sin(this.stateTime * 10) * 0.12 : 0;
    this.alert.visible = this.state === 'chase';
    this.stars.visible = stunned;
    if (u.wings) for (const w of u.wings) w.rotation.z = w.userData.side * Math.sin(t * (stunned ? 20 : 6)) * 0.5;
    if (u.tail) u.tail.rotation[this.type === 'crocodile' ? 'y' : 'z'] = Math.sin(this.walk * 2) * (this.type === 'scorpion' ? 0.15 : 0.6);
    if (u.beam) u.beam.material.color.setHex(this.state === 'chase' ? 0xff5050 : 0xfff27a);
  }
}

class Net {
  constructor(scene, from, to, speed) {
    this.mesh = Models.net();
    this.mesh.position.copy(from);
    scene.add(this.mesh);
    this.vel = to.clone().sub(from).normalize().multiplyScalar(speed);
    this.life = 2.2;
  }

  update(dt) {
    this.life -= dt;
    this.mesh.position.addScaledVector(this.vel, dt);
    this.mesh.rotation.x += dt * 6;
    this.mesh.rotation.y += dt * 4;
    const p = this.mesh.position;
    if (p.y < floorAt(p.x, p.z, p.y) || (isRiver(p.z) && p.y < RULES.waterLevel)) this.life = 0;
  }
}
