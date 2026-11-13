// The baby dragon: walking, jumping, flying, swimming, digging and breathing fire.

const DRAGON_RADIUS = 0.9;
const MAX_ENERGY = 100;
const RUN_SPEED_FACTOR = 1.6;
const SWIM_FLOAT = RULES.waterLevel - 1.3;

class Dragon {
  constructor(scene, world) {
    this.world = world;
    this.mesh = Models.dragon();
    scene.add(this.mesh);
    this.mound = Models.mesh(Models.sphere(1.1, 12), 0x7a5230);
    this.mound.scale.set(1, 0.45, 1.3);
    this.mound.visible = false;
    scene.add(this.mound);
    this.cocoon = Models.cocoon();
    this.cocoon.visible = false;
    scene.add(this.cocoon);
    this.forward = new THREE.Vector3();
    this.reset(world.start.x, world.start.z, Math.PI);
  }

  reset(x, z, heading = Math.PI) {
    this.pos = new THREE.Vector3(x, terrainHeight(x, z), z);
    this.vy = 0;
    this.heading = heading;
    this.forward.set(Math.sin(heading), 0, Math.cos(heading));
    this.mode = 'ground';
    this.energy = MAX_ENERGY;
    this.fireTime = 0;
    this.fireCooldown = 0;
    this.netPresses = 0;
    this.flapTime = 0;
    this.walkTime = 0;
    this.diving = false;
    this.running = false;
    this.wavePhase = 0;
    this.lateral = 0;
    this.vertical = 0;
    this.digDepth = 0;
    this.digSoundTime = 0;
    this.invulnerable = 0;
    this.mesh.visible = true;
    this.mound.visible = false;
    this.cocoon.visible = false;
    this.updateMesh(0);
  }

  // Enemies cannot see a dragon under the ground or deep under water.
  get hidden() {
    return this.mode === 'dig' || (this.mode === 'swim' && this.pos.y < SWIM_FLOAT - 0.9);
  }

  get isFiring() {
    return this.fireTime > 0 && this.mode !== 'swim';
  }

  mouthPosition(target) {
    return this.mesh.userData.mouth.getWorldPosition(target);
  }

  // Pushes a point out of everything solid below height y. A digging dragon passes under it all.
  collide(p, y, ignoreAll) {
    if (ignoreAll) return;
    for (const c of this.world.circles) {
      if (y >= c.top) continue;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const min = c.r + DRAGON_RADIUS;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = c.x + (dx / d) * min;
        p.z = c.z + (dz / d) * min;
      }
    }
    for (const b of this.world.boxes) {
      if (y >= b.top) continue;
      const minX = b.minX - DRAGON_RADIUS;
      const maxX = b.maxX + DRAGON_RADIUS;
      const minZ = b.minZ - DRAGON_RADIUS;
      const maxZ = b.maxZ + DRAGON_RADIUS;
      if (p.x <= minX || p.x >= maxX || p.z <= minZ || p.z >= maxZ) continue;
      const pushes = [[p.x - minX, 'x', minX], [maxX - p.x, 'x', maxX], [p.z - minZ, 'z', minZ], [maxZ - p.z, 'z', maxZ]];
      pushes.sort((a, c) => a[0] - c[0]);
      p[pushes[0][1]] = pushes[0][2];
    }
  }

  insideSomething(x, z) {
    for (const c of this.world.circles) {
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + DRAGON_RADIUS * 0.5) ** 2) return true;
    }
    for (const b of this.world.boxes) {
      if (x > b.minX - 0.5 && x < b.maxX + 0.5 && z > b.minZ - 0.5 && z < b.maxZ + 0.5) return true;
    }
    return false;
  }

  // Returns what happened this frame so the game can show messages and play sounds.
  update(dt, input) {
    const events = [];
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.fireTime = Math.max(0, this.fireTime - dt);

    if (this.mode === 'netted') {
      this.vy -= 22 * dt;
      this.pos.y = Math.max(floorAt(this.pos.x, this.pos.z, this.pos.y), this.pos.y + this.vy * dt);
      if (this.pos.y <= floorAt(this.pos.x, this.pos.z, this.pos.y)) this.vy = 0;
      if (input.firePressed) {
        this.netPresses++;
        this.fireTime = 0.25;
        events.push('burnNet');
        if (this.netPresses >= 5) {
          this.mode = this.pos.y > floorAt(this.pos.x, this.pos.z, this.pos.y) + 0.1 ? 'air' : 'ground';
          this.cocoon.visible = false;
          this.invulnerable = 1.5;
          events.push('freed');
        }
      }
      this.updateMesh(dt);
      return events;
    }

    this.heading += input.turn * 2.8 * dt;
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading));

    // Holding Q while going forward runs (or flies and swims faster); digging stays slow.
    this.running = !!input.run && input.move > 0 && this.mode !== 'dig';
    const speed = { ground: 9, air: 12, swim: 7, dig: 6 }[this.mode] * (this.running ? RUN_SPEED_FACTOR : 1);
    const move = input.move * speed * (input.move < 0 ? 0.55 : 1) * dt;
    const next = new THREE.Vector3(this.pos.x + this.forward.x * move, 0, this.pos.z + this.forward.z * move);
    if (this.mode === 'dig' && isRiver(next.z) && terrainHeight(next.x, next.z) < -0.3) {
      next.set(this.pos.x, 0, this.pos.z);
      events.push('digWater');
    }
    this.collide(next, this.pos.y, this.mode === 'dig');
    next.x = clamp(next.x, -(LEVEL.halfWidth - 2), LEVEL.halfWidth - 2);
    next.z = clamp(next.z, LEVEL.endZ, LEVEL.backZ - 1.5);
    this.pos.x = next.x;
    this.pos.z = next.z;
    if (Math.abs(input.move) > 0.1) this.walkTime += dt * (this.mode === 'ground' ? 9 : 5) * (this.running ? RUN_SPEED_FACTOR : 1);

    const floor = floorAt(this.pos.x, this.pos.z, this.pos.y);

    // Flying is free; only digging uses up strength, which comes back while not digging.
    if (this.mode !== 'dig') this.energy = Math.min(MAX_ENERGY, this.energy + 20 * dt);

    if (input.firePressed && this.fireCooldown === 0 && this.mode !== 'dig') {
      this.fireTime = 0.6;
      this.fireCooldown = 0.75;
      events.push(this.mode === 'swim' ? 'bubbles' : 'fire');
    }

    // E digs into the ground on land; in the water it dives to the bottom, and again comes back up.
    if (input.digPressed) {
      if (this.mode === 'swim') {
        this.diving = !this.diving;
        events.push(this.diving ? 'dive' : 'rise');
      } else if (this.mode === 'dig') {
        if (this.insideSomething(this.pos.x, this.pos.z)) events.push('cantSurface');
        else this.surface(events);
      } else if (this.mode === 'ground' && !onBridge(this.pos.x, this.pos.z)) {
        if (this.energy < 15) events.push('tired');
        else {
          this.mode = 'dig';
          this.digDepth = 0;
          events.push('dig');
        }
      }
    }

    if (this.mode === 'dig') {
      this.energy -= 12 * dt;
      this.digDepth = Math.min(1, this.digDepth + dt * 3);
      this.pos.y = floor - 1.8 * this.digDepth;
      this.digSoundTime -= dt;
      if (Math.abs(input.move) > 0.1 && this.digSoundTime <= 0) {
        this.digSoundTime = 0.35;
        events.push('digging');
      }
      if (this.energy <= 0) {
        this.energy = 0;
        if (this.insideSomething(this.pos.x, this.pos.z)) {
          this.energy = 1;
        } else {
          this.surface(events);
          events.push('tired');
        }
      }
    } else if (this.mode === 'swim') {
      if (input.jumpHeld) this.diving = false;
      if (input.dive || this.diving) this.pos.y -= 5 * dt;
      else if (input.jumpHeld) this.pos.y += 5 * dt;
      else this.pos.y += Math.sign(SWIM_FLOAT - this.pos.y) * Math.min(Math.abs(SWIM_FLOAT - this.pos.y), 4 * dt);
      this.pos.y = Math.max(this.pos.y, terrainHeight(this.pos.x, this.pos.z) + 0.2);
      if (input.jumpPressed && this.pos.y > SWIM_FLOAT - 0.3) {
        this.mode = 'air';
        this.vy = 9;
        events.push('jumpOut');
      } else if (!isDeepWater(this.pos.x, this.pos.z)) {
        this.mode = 'ground';
        this.diving = false;
        this.pos.y = Math.max(this.pos.y, floor);
      }
    } else {
      if (this.mode === 'ground') {
        if (input.jumpPressed) {
          this.vy = 8.5;
          this.mode = 'air';
          events.push('jump');
        } else if (isDeepWater(this.pos.x, this.pos.z) && floor < RULES.waterLevel) {
          this.mode = 'swim';
          events.push('splash');
        } else if (this.pos.y > floor + 0.6) {
          this.mode = 'air';
        }
      }
      if (this.mode === 'air') {
        this.vy -= 22 * dt;
        if (input.jumpHeld && !input.jumpPressed) {
          this.vy = Math.min(this.vy + 45 * dt, 6);
          this.flapTime += dt * 14;
          if (Math.floor(this.flapTime / Math.PI) !== Math.floor((this.flapTime - dt * 14) / Math.PI)) events.push('flap');
        } else {
          this.flapTime += dt * 3;
        }
        this.vy = Math.max(this.vy, input.dive ? -16 : -5);
        this.pos.y += this.vy * dt;
        if (this.pos.y > RULES.flyCeiling) {
          this.pos.y = RULES.flyCeiling;
          this.vy = Math.min(this.vy, 0);
          events.push('ceiling');
        }
        if (isDeepWater(this.pos.x, this.pos.z) && this.pos.y < RULES.waterLevel - 0.2 && floor < RULES.waterLevel) {
          this.mode = 'swim';
          this.vy = 0;
          events.push('splash');
        } else if (this.pos.y <= floor) {
          this.pos.y = floor;
          this.vy = 0;
          this.mode = 'ground';
          events.push('land');
        }
      }
      if (this.mode === 'ground') this.pos.y = floor;
    }

    this.updateMesh(dt);
    return events;
  }

  surface(events) {
    this.mode = 'air';
    this.pos.y = floorAt(this.pos.x, this.pos.z, 0);
    this.vy = 7;
    events.push('popOut');
  }

  getNetted() {
    this.mode = 'netted';
    this.running = false;
    this.netPresses = 0;
    this.vy = Math.min(this.vy, 0);
    this.cocoon.visible = true;
  }

  updateMesh(dt) {
    const m = this.mesh;
    const u = m.userData;
    m.position.copy(this.pos);
    m.rotation.y = this.heading;
    m.visible = this.mode !== 'dig' && !(this.invulnerable > 0 && Math.floor(this.invulnerable * 10) % 2 === 0);

    // The body slithers like a snake: gently when standing, more when walking or swimming, and
    // in big waves up, down and sideways when flying.
    let wingAngle = 0.25;
    let pitch = 0;
    let lateral = 0.06;
    let vertical = 0;
    let waveSpeed = 2;
    const moving = this.walkTime !== this.lastWalkTime;
    this.lastWalkTime = this.walkTime;
    if (this.mode === 'air') {
      wingAngle = Math.sin(this.flapTime) * 0.7 + 0.1;
      pitch = clamp(-this.vy * 0.04, -0.3, 0.3);
      lateral = 0.4;
      vertical = 0.35;
      waveSpeed = 7;
    } else if (this.mode === 'swim') {
      wingAngle = -0.6;
      pitch = 0.15;
      lateral = 0.45;
      vertical = 0.1;
      waveSpeed = moving ? 8 : 3;
    } else if (this.mode === 'netted') {
      wingAngle = -0.3;
      lateral = 0.03;
    } else if (moving) {
      lateral = 0.28;
      waveSpeed = 9;
    }
    // Running slithers faster and wider.
    if (this.running) {
      lateral += 0.12;
      waveSpeed *= 1.8;
    }
    const ease = 1 - Math.exp(-4 * dt);
    this.lateral += (lateral - this.lateral) * ease;
    this.vertical += (vertical - this.vertical) * ease;
    this.wavePhase += waveSpeed * dt;
    Models.poseDragon(m, this.wavePhase, this.lateral, this.vertical);
    for (const w of u.wings) w.rotation.z = w.userData.side * wingAngle;
    m.rotation.x = pitch;
    u.head.rotation.x = this.isFiring ? -0.15 : 0;
    u.head.rotation.y = Math.sin(this.wavePhase + 0.6) * this.lateral * 0.4;

    this.mound.visible = this.mode === 'dig';
    if (this.mound.visible) {
      this.mound.position.set(this.pos.x, terrainHeight(this.pos.x, this.pos.z) + 0.05, this.pos.z);
      this.mound.rotation.y = this.heading;
    }
    if (this.cocoon.visible) {
      // The net wraps the whole long body, which trails behind the head.
      this.cocoon.position.set(this.pos.x - this.forward.x * 2, this.pos.y + 0.8, this.pos.z - this.forward.z * 2);
      this.cocoon.rotation.y = this.heading;
      const s = 1 - this.netPresses * 0.08;
      this.cocoon.scale.set(s, s * 0.8, s * 2.2);
    }
  }
}
