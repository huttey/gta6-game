// Everyone who moves in Solmar: the player (on foot or in a car), traffic, pedestrians,
// police and the rival gang, plus pickups, particles and bullet tracers. The world owns
// the mission and wanted bookkeeping; this module owns movement, AI and combat, and
// reports what happened as bit flags, so the caller can react without the actors
// knowing about screens or sound.

import { CAR, PED, PLAYER, POLICE, WANTED, WEAPON, WORLD } from './config.js';
import { pick } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_SHOT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_CAR_STOLEN = 8;
export const EVENT_PED_HIT = 16;
export const EVENT_COP_KILLED = 32;
export const EVENT_BUSTED = 64;
export const EVENT_WASTED = 128;
export const EVENT_TARGET = 256;
export const EVENT_GANG_DEAD = 1024;
export const EVENT_CRASH = 2048;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function clampAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function slideMove(city, x, y, dx, dy, r) {
  // Move on one axis at a time so the player slides along walls instead of sticking.
  let nx = x + dx;
  if (city.collides(nx, y, r)) nx = x;
  let ny = y + dy;
  if (city.collides(nx, ny, r)) ny = y;
  return { x: nx, y: ny };
}

export function createActors(city, random) {
  const player = {
    x: 0, y: 0, angle: 0, health: PLAYER.health, cash: 0, wanted: 0,
    weapon: 'pistol', ammo: WEAPON.startAmmo, inCar: null, shootCooldown: 0,
    punchCooldown: 0, invulnerable: 0, lastDamage: -99, bustedTimer: 0,
  };
  const cars = [];
  const peds = [];
  const cops = [];
  const gang = [];
  const pickups = [];
  const particles = [];
  const tracers = [];
  const state = { elapsed: 0, wantedTimer: 0, trafficTimer: 0, pedTimer: 0, copTimer: 0, fareTimer: 8 };

  function makeCar(x, y, angle, kind, color) {
    return {
      x, y, angle, speed: 0, kind, color, hp: CAR.hp, wrecked: false,
      targetRoad: null, targetDir: 1, stuck: 0, driver: kind === 'traffic' ? 'traffic' : null,
    };
  }

  function spawnCar(x, y, kind, color) {
    const car = makeCar(x, y, random() * Math.PI * 2, kind, color || pick(random, CAR.colours));
    cars.push(car);
    return car;
  }

  function spawnParkedCars(count) {
    for (let i = 0; i < count; i += 1) {
      const p = city.randomRoadPoint(120);
      const onSide = random() < 0.5;
      const car = spawnCar(
        p.x + (onSide ? 52 : -52), p.y + (random() - 0.5) * 40,
        onSide ? 0 : Math.PI, 'parked',
      );
      car.angle = random() < 0.5 ? 0 : Math.PI;
    }
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i += 1) {
      const p = city.randomRoadPoint(100);
      const car = spawnCar(p.x, p.y, 'traffic');
      car.angle = random() < 0.5 ? 0 : Math.PI / 2;
      if (random() < 0.5) car.angle += Math.PI;
      car.speed = 90 + random() * 90;
    }
  }

  function spawnPeds(count) {
    for (let i = 0; i < count; i += 1) {
      const p = city.randomSidewalkPoint();
      peds.push({
        x: p.x, y: p.y, angle: random() * Math.PI * 2, speed: PED.walkSpeed,
        color: pick(random, PED.colours), state: 'walk', fleeX: 0, fleeY: 0, fleeT: 0, road: null,
      });
    }
  }

  function spawnCopCar(px, py) {
    const p = city.randomRoadPoint(150);
    // Put the car on a road some distance from the player, never on top of them.
    let x = p.x;
    let y = p.y;
    if (dist(x, y, px, py) < 500) {
      x = Math.min(WORLD.width - 100, Math.max(100, px + (px < WORLD.width / 2 ? 620 : -620)));
      y = Math.min(2100, Math.max(100, py + (random() < 0.5 ? 300 : -300)));
      const near = city.nearestRoadPoint(x, y);
      x = near.x;
      y = near.y;
    }
    const car = makeCar(x, y, angleTo(x, y, px, py), 'police', CAR.policeColour);
    car.speed = 200;
    cops.push({ kind: 'car', car, bustT: 0 });
    return car;
  }

  function spawnFootCop(px, py) {
    const a = random() * Math.PI * 2;
    const x = Math.min(WORLD.width - 60, Math.max(60, px + Math.cos(a) * 320));
    const y = Math.min(2150, Math.max(60, py + Math.sin(a) * 320));
    cops.push({ kind: 'foot', x, y, angle: angleTo(x, y, px, py), hp: 100, bustT: 0, shootT: 0 });
  }

  function spawnGang(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      gang.push({
        x: x + (random() - 0.5) * 160, y: y + (random() - 0.5) * 160,
        angle: random() * Math.PI * 2, hp: 60, shootT: 0.5 + random(), speed: 70,
      });
    }
  }

  function addPickup(kind, x, y, amount) {
    pickups.push({ kind, x, y, amount: amount || 0 });
  }

  function addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const s = (0.3 + random() * 0.7) * speed;
      particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.4 + random() * 0.5, maxLife: 0.9, color, size: 2 + random() * 4,
      });
    }
  }

  function reset(spawn) {
    player.x = spawn.x;
    player.y = spawn.y;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.cash = 0;
    player.wanted = 0;
    player.weapon = 'pistol';
    player.ammo = WEAPON.startAmmo;
    player.inCar = null;
    player.shootCooldown = 0;
    player.punchCooldown = 0;
    player.invulnerable = 0;
    player.lastDamage = -99;
    player.bustedTimer = 0;
    cars.length = 0;
    peds.length = 0;
    cops.length = 0;
    gang.length = 0;
    pickups.length = 0;
    particles.length = 0;
    tracers.length = 0;
    state.elapsed = 0;
    state.wantedTimer = 0;
    state.trafficTimer = 0;
    state.pedTimer = 0;
    state.copTimer = 0;
    state.fareTimer = 8;
    spawnParkedCars(14);
    spawnTraffic(16);
    spawnPeds(26);
    addPickup('ammo', spawn.x + 90, spawn.y - 60, WEAPON.ammoPickup);
    addPickup('health', spawn.x - 80, spawn.y + 70, 50);
  }

  function enterExitCar(events) {
    if (player.inCar) {
      const car = player.inCar;
      const side = car.angle + Math.PI / 2;
      const x = car.x + Math.cos(side) * (CAR.width / 2 + 18);
      const y = car.y + Math.sin(side) * (CAR.width / 2 + 18);
      if (!city.collides(x, y, PLAYER.radius)) {
        player.x = x;
        player.y = y;
        player.angle = car.angle;
        player.inCar = null;
      }
      return events;
    }
    let best = null;
    let bestD = 78;
    for (const car of cars) {
      if (car.wrecked) continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best) {
      player.inCar = best;
      player.x = best.x;
      player.y = best.y;
      if (best.kind === 'traffic' || best.kind === 'parked' || best.kind === 'police') {
        best.kind = 'player';
        best.driver = 'player';
        return events | EVENT_CAR_STOLEN;
      }
    }
    return events;
  }

  function driveCar(car, dt, move) {
    const forward = move.y < 0 ? 1 : move.y > 0 ? -0.6 : 0;
    if (move.y < 0) car.speed += CAR.accel * dt;
    else if (move.y > 0) {
      if (car.speed > 10) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
    }
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steer = move.x;
    if (Math.abs(car.speed) > 5) {
      car.angle += steer * CAR.turnRate * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (city.collides(nx, ny, CAR.width / 2)) {
      // A hard impact damages the car and counts as a crash; a slow scrape just
      // bounces the car back, so grinding along a wall is not a crash a step.
      const hard = Math.abs(car.speed) > 120;
      if (hard) {
        car.hp -= 12;
        addParticles(car.x, car.y, '#ffb347', 10, 160);
      }
      car.speed *= -0.25;
      return hard;
    }
    car.x = nx;
    car.y = ny;
    return false;
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.kind !== 'traffic' || car.wrecked) continue;
      // Follow the road grid: drive along the current axis; at an intersection,
      // sometimes turn onto the crossing road.
      const onX = Math.abs(car.y - Math.round(car.y / 600) * 600) < 40;
      const speed = 110 + (car.speed % 40);
      const dir = Math.sign(Math.cos(car.angle)) || 1;
      const dirY = Math.sign(Math.sin(car.angle)) || 1;
      const movingX = Math.abs(Math.cos(car.angle)) > 0.7;
      if (movingX) {
        car.x += dir * speed * dt;
        // Snap to the nearest horizontal road's lane.
        let bestY = null;
        let bestD = 1e9;
        for (const ry of [300, 900, 1500, 2100]) {
          const d = Math.abs(car.y - ry);
          if (d < bestD) {
            bestD = d;
            bestY = ry;
          }
        }
        car.y += (bestY - car.y) * Math.min(1, 2 * dt);
        if (random() < dt * 0.06) {
          car.angle = dirY >= 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      } else {
        car.y += dirY * speed * dt;
        let bestX = null;
        let bestD = 1e9;
        for (const rx of [300, 900, 1500, 2100, 2700, 3300]) {
          const d = Math.abs(car.x - rx);
          if (d < bestD) {
            bestD = d;
            bestX = rx;
          }
        }
        car.x += (bestX - car.x) * Math.min(1, 2 * dt);
        if (random() < dt * 0.06) {
          car.angle = dir >= 0 ? 0 : Math.PI;
        }
      }
      // Wrap around the map edges so traffic never runs out.
      if (car.x < -80) car.x = WORLD.width + 70;
      if (car.x > WORLD.width + 80) car.x = -70;
      if (car.y < -80) car.y = 2140;
      if (car.y > 2200) car.y = -70;
      // Slow for the car ahead.
      for (const other of cars) {
        if (other === car || other.wrecked) continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d < 70 && d > 0) {
          car.x -= Math.cos(car.angle) * 30 * dt;
          car.y -= Math.sin(car.angle) * 30 * dt;
        }
      }
      void onX;
    }
  }

  function stepPeds(dt, danger) {
    for (const ped of peds) {
      if (ped.state === 'flee') {
        ped.fleeT -= dt;
        const a = angleTo(ped.x, ped.y, ped.fleeX, ped.fleeY) + Math.PI;
        const next = slideMove(city, ped.x, ped.y, Math.cos(a) * PED.fleeSpeed * dt, Math.sin(a) * PED.fleeSpeed * dt, PED.radius);
        ped.x = next.x;
        ped.y = next.y;
        ped.angle = a;
        if (ped.fleeT <= 0) ped.state = 'walk';
        continue;
      }
      if (danger && dist(ped.x, ped.y, danger.x, danger.y) < 260) {
        ped.state = 'flee';
        ped.fleeX = danger.x;
        ped.fleeY = danger.y;
        ped.fleeT = 2.5;
        continue;
      }
      // Stroll along the sidewalk; at an intersection, sometimes turn.
      const next = slideMove(city, ped.x, ped.y, Math.cos(ped.angle) * PED.walkSpeed * dt, Math.sin(ped.angle) * PED.walkSpeed * dt, PED.radius);
      if (next.x === ped.x && next.y === ped.y) ped.angle = random() * Math.PI * 2;
      else {
        ped.x = next.x;
        ped.y = next.y;
      }
      if (random() < dt * 0.05) ped.angle += (random() < 0.5 ? -1 : 1) * Math.PI / 2;
    }
  }

  function damageCar(car, amount, events) {
    car.hp -= amount;
    if (car.hp <= 0 && !car.wrecked) {
      car.wrecked = true;
      car.speed = 0;
      addParticles(car.x, car.y, '#555555', 16, 120);
      if (player.inCar === car) {
        player.inCar = null;
        player.health -= 15;
        return events | EVENT_CRASH;
      }
    }
    return events;
  }

  function stepPolice(dt) {
    let events = 0;
    const px = player.x;
    const py = player.y;
    // No heat, no chase: the police give up and melt away.
    if (player.wanted === 0) {
      cops.length = 0;
      return 0;
    }
    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const cop = cops[i];
      if (cop.kind === 'car') {
        const car = cop.car;
        if (car.wrecked) {
          cops.splice(i, 1);
          continue;
        }
        const targetAngle = angleTo(car.x, car.y, px, py);
        const diff = (targetAngle - car.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
        car.speed = Math.min(POLICE.carSpeed, car.speed + 300 * dt);
        const nx = car.x + Math.cos(car.angle) * car.speed * dt;
        const ny = car.y + Math.sin(car.angle) * car.speed * dt;
        if (!city.collides(nx, ny, CAR.width / 2)) {
          car.x = nx;
          car.y = ny;
        } else {
          car.speed *= 0.5;
          car.angle += 0.6 * dt * (random() < 0.5 ? 1 : -1);
        }
        // A police ram hurts the player's car and the player; the ram pushes the
        // cop car back off the player, so it cannot glue itself to them.
        if (player.inCar && dist(car.x, car.y, player.x, player.y) < 58) {
          events = damageCar(player.inCar, 2.5 * dt * 10, events);
          car.x -= Math.cos(car.angle) * 46 * dt;
          car.y -= Math.sin(car.angle) * 46 * dt;
          if (player.inCar && player.inCar.speed < 8) {
            cop.bustT += dt;
            if (cop.bustT > POLICE.carCatchTime) return events | EVENT_BUSTED;
          } else cop.bustT = 0;
        }
        // Despawning far away keeps the chase near the player.
        if (dist(car.x, car.y, px, py) > 1400) {
          cops.splice(i, 1);
        }
      } else {
        const d = dist(cop.x, cop.y, px, py);
        if (d > POLICE.sight) {
          cop.bustT = 0;
          continue;
        }
        const a = angleTo(cop.x, cop.y, px, py);
        cop.angle = a;
        const next = slideMove(city, cop.x, cop.y, Math.cos(a) * POLICE.footSpeed * dt, Math.sin(a) * POLICE.footSpeed * dt, PED.radius);
        cop.x = next.x;
        cop.y = next.y;
        if (player.inCar) {
          cop.bustT = 0;
          continue;
        }
        if (d < POLICE.bustRadius) {
          cop.bustT += dt;
          if (cop.bustT > POLICE.catchTime) return events | EVENT_BUSTED;
        } else cop.bustT = 0;
      }
    }
    return events;
  }

  function stepGang(dt) {
    let events = 0;
    const px = player.x;
    const py = player.y;
    for (let i = gang.length - 1; i >= 0; i -= 1) {
      const g = gang[i];
      if (g.hp <= 0) {
        addParticles(g.x, g.y, '#8e2f2f', 12, 140);
        gang.splice(i, 1);
        continue;
      }
      const d = dist(g.x, g.y, px, py);
      g.shootT -= dt;
      if (d < 480) {
        g.angle = angleTo(g.x, g.y, px, py);
        if (d > 180) {
          const next = slideMove(city, g.x, g.y, Math.cos(g.angle) * g.speed * dt, Math.sin(g.angle) * g.speed * dt, PED.radius);
          g.x = next.x;
          g.y = next.y;
        }
        if (g.shootT <= 0 && d < 420) {
          g.shootT = 1.1 + random() * 0.7;
          tracers.push({ x1: g.x, y1: g.y, x2: px, y2: py, life: 0.12, maxLife: 0.12 });
          if (random() < 0.45 && player.invulnerable <= 0) {
            player.health -= 9;
            player.invulnerable = 0.4;
            player.lastDamage = state.elapsed;
            events |= EVENT_HIT;
            if (player.health <= 0) return events | EVENT_WASTED;
          }
        }
      }
    }
    if (gang.length === 0 && state.gangSpawned) {
      state.gangSpawned = false;
      return events | EVENT_GANG_DEAD;
    }
    return events;
  }

  function shootAt(wx, wy) {
    if (player.weapon !== 'pistol' || player.ammo <= 0 || player.shootCooldown > 0) return 0;
    player.shootCooldown = WEAPON.pistolCooldown;
    player.ammo -= 1;
    const ox = player.x;
    const oy = player.y;
    const a = angleTo(ox, oy, wx, wy);
    player.angle = a;
    let bestD = WEAPON.pistolRange;
    let best = null;
    let bestKind = null;
    const ex = ox + Math.cos(a) * WEAPON.pistolRange;
    const ey = oy + Math.sin(a) * WEAPON.pistolRange;
    function consider(tx, ty, radius, ref, kind) {
      const dx = tx - ox;
      const dy = ty - oy;
      const along = dx * Math.cos(a) + dy * Math.sin(a);
      if (along <= 0 || along > bestD) return;
      const perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
      if (perp < radius + 6) {
        bestD = along;
        best = ref;
        bestKind = kind;
      }
    }
    for (const ped of peds) consider(ped.x, ped.y, PED.radius, ped, 'ped');
    for (const g of gang) consider(g.x, g.y, PED.radius, g, 'gang');
    for (const cop of cops) {
      if (cop.kind === 'foot') consider(cop.x, cop.y, PED.radius, cop, 'cop');
      else consider(cop.car.x, cop.car.y, 30, cop.car, 'copcar');
    }
    for (const car of cars) {
      if (car !== player.inCar) consider(car.x, car.y, 30, car, 'car');
    }
    const hx = ox + Math.cos(a) * bestD;
    const hy = oy + Math.sin(a) * bestD;
    tracers.push({ x1: ox, y1: oy, x2: hx, y2: hy, life: 0.1, maxLife: 0.1 });
    addParticles(hx, hy, '#ffd23e', 3, 60);
    let events = EVENT_SHOT;
    if (best) {
      if (bestKind === 'ped') {
        best.state = 'flee';
        best.fleeX = ox;
        best.fleeY = oy;
        best.fleeT = 3;
        events |= EVENT_PED_HIT;
      } else if (bestKind === 'gang') {
        best.hp -= WEAPON.pistolDamage;
        addParticles(best.x, best.y, '#ff5a5a', 6, 120);
      } else if (bestKind === 'cop') {
        best.hp -= WEAPON.pistolDamage;
        if (best.hp <= 0) {
          const idx = cops.indexOf(best);
          if (idx >= 0) cops.splice(idx, 1);
          events |= EVENT_COP_KILLED;
        }
      } else if (bestKind === 'copcar') {
        events = damageCar(best, WEAPON.pistolDamage, events);
      } else if (bestKind === 'car') {
        events = damageCar(best, WEAPON.pistolDamage, events);
      }
    }
    void ex;
    void ey;
    return events;
  }

  function punch() {
    if (player.punchCooldown > 0) return 0;
    player.punchCooldown = 0.45;
    let events = 0;
    const range = PLAYER.punchRange + 14;
    function hit(tx, ty, ref, kind) {
      const d = dist(player.x, player.y, tx, ty);
      if (d > range) return;
      const a = angleTo(player.x, player.y, tx, ty);
      if (Math.abs(((a - player.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > PLAYER.punchArc) return;
      if (kind === 'ped') {
        ref.state = 'flee';
        ref.fleeX = player.x;
        ref.fleeY = player.y;
        ref.fleeT = 3;
        events |= EVENT_PED_HIT;
      } else if (kind === 'gang') {
        ref.hp -= PLAYER.punchDamage;
      } else if (kind === 'cop') {
        ref.hp -= PLAYER.punchDamage;
        if (ref.hp <= 0) {
          const idx = cops.indexOf(ref);
          if (idx >= 0) cops.splice(idx, 1);
          events |= EVENT_COP_KILLED;
        }
      }
    }
    for (const ped of peds) hit(ped.x, ped.y, ped, 'ped');
    for (const g of gang) hit(g.x, g.y, g, 'gang');
    for (const cop of cops) if (cop.kind === 'foot') hit(cop.x, cop.y, cop, 'cop');
    return events;
  }

  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) tracers.splice(i, 1);
    }
  }

  function collectPickups() {
    let events = 0;
    const px = player.x;
    const py = player.y;
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pk = pickups[i];
      if (dist(px, py, pk.x, pk.y) < 42) {
        if (pk.kind === 'ammo') player.ammo += pk.amount;
        else if (pk.kind === 'health') player.health = Math.min(PLAYER.health, player.health + pk.amount);
        else if (pk.kind === 'cash') player.cash += pk.amount;
        pickups.splice(i, 1);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  /**
   * One fixed step. `move` is the normalised input direction, `actions` the
   * ACTION_* flags taken this frame, `clicked` whether the mouse was clicked,
   * `view` converts window pixels to world coordinates for the mouse aim and
   * `target` is the mission marker (or null). Returns the EVENT_* flags.
   */
  function step(dt, input, view, target, actions, clicked) {
    let events = 0;
    state.elapsed += dt;
    if (player.shootCooldown > 0) player.shootCooldown -= dt;
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;

    const move = input.move();
    if (actions & 4) events |= enterExitCar(0);
    if (actions & 8) events |= punch();

    if (player.inCar) {
      const car = player.inCar;
      if (driveCar(car, dt, move)) events |= EVENT_CRASH;
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      // Running over a pedestrian while driving.
      for (const ped of peds) {
        if (ped.state !== 'flee' && dist(car.x, car.y, ped.x, ped.y) < 34 && Math.abs(car.speed) > 60) {
          ped.state = 'flee';
          ped.fleeX = car.x;
          ped.fleeY = car.y;
          ped.fleeT = 3;
          events |= EVENT_PED_HIT;
          car.hp -= 4;
        }
      }
    } else {
      const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const next = slideMove(city, player.x, player.y, move.x * speed * dt, move.y * speed * dt, PLAYER.radius);
      player.x = next.x;
      player.y = next.y;
      if (move.x !== 0 || move.y !== 0) player.angle = Math.atan2(move.y, move.x);
    }

    if (clicked) {
      const world = view(input.mouse.x, input.mouse.y);
      events |= shootAt(world.x, world.y);
    }

    // Wanted: fresh police arrive while the heat is on; the level fades when clean.
    if (player.wanted > 0) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= WANTED.decaySeconds) {
        state.wantedTimer = 0;
        player.wanted = Math.max(0, player.wanted - 1);
      }
      state.copTimer -= dt;
      const wantCars = Math.min(3, player.wanted * WANTED.copCarPerStar);
      const wantFoot = Math.min(4, player.wanted * WANTED.footCopPerStar);
      const haveCars = cops.filter((c) => c.kind === 'car').length;
      const haveFoot = cops.filter((c) => c.kind === 'foot').length;
      if (state.copTimer <= 0) {
        state.copTimer = 2.5;
        if (haveCars < wantCars) spawnCopCar(player.x, player.y);
        else if (haveFoot < wantFoot) spawnFootCop(player.x, player.y);
      }
    }

    // Traffic and pedestrians top up over time.
    state.trafficTimer -= dt;
    if (state.trafficTimer <= 0) {
      state.trafficTimer = 4;
      const traffic = cars.filter((c) => c.kind === 'traffic' && !c.wrecked).length;
      if (traffic < 14) spawnTraffic(2);
      if (peds.length < 24) spawnPeds(3);
    }

    stepTraffic(dt);
    stepPeds(dt, player.inCar && Math.abs(player.inCar.speed) > 200 ? { x: player.x, y: player.y } : null);
    events |= stepPolice(dt);
    events |= stepGang(dt);
    events |= collectPickups();
    stepParticles(dt);

    // Slow health regen when the player is calm and unhurt for a while.
    if (player.wanted === 0 && player.health > 0 && player.health < PLAYER.health && state.elapsed - player.lastDamage > 10) {
      player.health = Math.min(PLAYER.health, player.health + 2 * dt);
    }

    // Reached the mission marker?
    if (target && dist(player.x, player.y, target.x, target.y) < 90) {
      events |= EVENT_TARGET;
    }
    return events;
  }

  return {
    player,
    cars,
    peds,
    cops,
    gang,
    pickups,
    particles,
    tracers,
    state,
    reset,
    spawnCar,
    spawnTraffic,
    spawnPeds,
    spawnCopCar,
    spawnFootCop,
    spawnGang,
    addPickup,
    addParticles,
    enterExitCar,
    shootAt,
    punch,
    damageCar,
    step,
  };
}
