// Vehicles: cars on the roads, boats on the bay, traffic that follows the
// road grid, police cruisers that chase the player, and coast guard cutters
// that hunt smugglers on the water. All original code for Marina Bay.
import { mulberry32, randRange, pick, clamp, dist, angleTo, angleLerp, circleRectHit } from './util.js';
import { isWater, collideBuildings, nearestRoadPoint, WORLD_W, WORLD_H } from './world.js';

const CAR_TYPES = [
  { name: 'Sedan', color: '#c0392b', len: 46, wid: 22, top: 95, accel: 210, max: 300 },
  { name: 'Sedan', color: '#2980b9', len: 46, wid: 22, top: 92, accel: 205, max: 290 },
  { name: 'Taxi', color: '#f1c40f', len: 46, wid: 22, top: 90, accel: 200, max: 280 },
  { name: 'Pickup', color: '#7f8c8d', len: 52, wid: 24, top: 80, accel: 180, max: 260 },
  { name: 'Sports', color: '#e74c3c', len: 48, wid: 22, top: 130, accel: 300, max: 420 },
  { name: 'Sports', color: '#8e44ad', len: 48, wid: 22, top: 128, accel: 295, max: 410 },
  { name: 'Van', color: '#ecf0f1', len: 56, wid: 25, top: 72, accel: 160, max: 230 },
  { name: 'Beetle', color: '#16a085', len: 40, wid: 21, top: 88, accel: 190, max: 270 },
];
const BOAT_TYPES = [
  { name: 'Speedboat', color: '#e74c3c', len: 52, wid: 20, top: 120, accel: 260, max: 380 },
  { name: 'Fishing boat', color: '#f4ead2', len: 58, wid: 24, top: 75, accel: 150, max: 220 },
  { name: 'Jet ski', color: '#f39c12', len: 34, wid: 14, top: 110, accel: 280, max: 340 },
];

let nextId = 1;

export function makeCar(world, x, y, angle, kind) {
  const t = kind || pick(Math.random, CAR_TYPES);
  return {
    id: nextId++, kind: 'car', type: t, x, y, angle,
    speed: 0, color: t.color, len: t.len, wid: t.wid,
    traffic: false, police: false, targetAngle: angle, stuckT: 0,
    siren: false, hp: 100, smoke: 0,
  };
}

export function makeBoat(world, x, y, angle, kind) {
  const t = kind || pick(Math.random, BOAT_TYPES);
  return {
    id: nextId++, kind: 'boat', type: t, x, y, angle,
    speed: 0, color: t.color, len: t.len, wid: t.wid,
    traffic: false, police: false, coastguard: false, targetAngle: angle,
    hp: 100, smoke: 0, wakeT: 0,
  };
}

export function makePoliceCar(world, x, y) {
  const v = makeCar(world, x, y, 0, { name: 'Cruiser', color: '#2c3e50', len: 48, wid: 23, top: 110, accel: 290, max: 400 });
  v.police = true;
  v.siren = true;
  return v;
}

export function makeCoastGuard(world, x, y) {
  const v = makeBoat(world, x, y, 0, { name: 'Cutter', color: '#ffffff', len: 64, wid: 26, top: 95, accel: 240, max: 330 });
  v.coastguard = true;
  v.police = true;
  v.siren = true;
  return v;
}

export function spawnTraffic(world, cars, boats, nCars, nBoats) {
  const rng = mulberry32(4242);
  for (let i = 0; i < nCars; i++) {
    const rx = pick(rng, world.vRoads);
    const ry = pick(rng, world.hRoads);
    const vertical = rng() < 0.5;
    const x = vertical ? rx + (rng() < 0.5 ? -13 : 13) : randRange(rng, 560, 3100);
    const y = vertical ? randRange(rng, 80, 2300) : ry + (rng() < 0.5 ? -13 : 13);
    // Each traffic car owns one road and one direction: it never turns
    // across a block, so it can never end up driving over buildings.
    const axis = vertical ? 'v' : 'h';
    const dir = vertical ? (rng() < 0.5 ? 1 : -1) : (rng() < 0.5 ? 1 : -1);
    const angle = axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const c = makeCar(world, x, y, angle);
    c.traffic = true;
    c.axis = axis;
    c.dir = dir;
    c.road = axis === 'v' ? rx : ry;
    c.speed = randRange(rng, 60, 130);
    cars.push(c);
  }
  for (let i = 0; i < nBoats; i++) {
    const b = makeBoat(world, randRange(rng, 90, 380), randRange(rng, 200, 2200), randRange(rng, 0, Math.PI * 2));
    b.traffic = true;
    b.speed = randRange(rng, 30, 70);
    boats.push(b);
  }
}

function forwardBlocked(world, cars, v, look) {
  const fx = v.x + Math.cos(v.angle) * look;
  const fy = v.y + Math.sin(v.angle) * look;
  if (collideBuildings(world, fx, fy, 14)) return true;
  for (const o of cars) {
    if (o.id === v.id) continue;
    if (dist(fx, fy, o.x, o.y) < 34) return true;
  }
  return false;
}

export function updateTrafficCar(world, cars, c, dt) {
  // Follow the car's own road: steer along its axis, nudge back toward the
  // centreline, turn around at the ends of the road. Never cut across blocks.
  const along = c.axis === 'v' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
  const off = c.axis === 'v' ? (c.x - c.road) : (c.y - c.road);
  const want = along + clamp(-off * 0.006, -0.35, 0.35);
  c.angle = angleLerp(c.angle, want, clamp(dt * 2.2, 0, 1));
  const blocked = forwardBlocked(world, cars, c, 52);
  const target = blocked ? 0 : 110;
  c.speed += clamp(target - c.speed, -260 * dt, 120 * dt);
  if (c.speed < 0) c.speed = 0;
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  // Turn around at the ends of the road.
  if (c.axis === 'v' && (c.y < 70 || c.y > WORLD_H - 70)) c.dir *= -1;
  if (c.axis === 'h' && (c.x < 540 || c.x > WORLD_W - 50)) c.dir *= -1;
  c.x = clamp(c.x, 500, WORLD_W - 40);
  c.y = clamp(c.y, 50, WORLD_H - 40);
  const hit = collideBuildings(world, c.x, c.y, 15);
  if (hit) {
    // Bumped into something: turn around instead of ploughing through it.
    c.dir *= -1;
    c.angle += Math.PI;
    c.speed *= 0.4;
  }
}

export function updateTrafficBoat(world, b, dt) {
  b.angle += Math.sin(b.x * 0.001 + b.y * 0.001) * dt * 0.3;
  b.speed = clamp(b.speed, 25, 70);
  b.x += Math.cos(b.angle) * b.speed * dt;
  b.y += Math.sin(b.angle) * b.speed * dt;
  if (b.x < 60 || b.x > 400) b.angle = Math.PI - b.angle;
  if (b.y < 80 || b.y > 2320) b.angle = -b.angle;
  b.x = clamp(b.x, 50, 410);
  b.y = clamp(b.y, 60, 2340);
}

export function updatePoliceCar(world, cars, pc, px, py, dt) {
  const d = dist(pc.x, pc.y, px, py);
  const want = angleTo(pc.x, pc.y, px, py);
  pc.angle = angleLerp(pc.angle, want, clamp(dt * 3.0, 0, 1));
  const target = d > 90 ? pc.type.max : pc.type.max * 0.55;
  pc.speed += clamp(target - pc.speed, -320 * dt, pc.type.accel * dt);
  const nx = pc.x + Math.cos(pc.angle) * pc.speed * dt;
  const ny = pc.y + Math.sin(pc.angle) * pc.speed * dt;
  if (!collideBuildings(world, nx, ny, 15)) { pc.x = nx; pc.y = ny; }
  else { pc.angle += 0.9 * dt * 4; pc.speed *= 0.6; }
  pc.x = clamp(pc.x, 480, WORLD_W - 30);
  pc.y = clamp(pc.y, 40, WORLD_H - 30);
}

export function updateCoastGuard(world, cg, px, py, dt) {
  const want = angleTo(cg.x, cg.y, px, py);
  cg.angle = angleLerp(cg.angle, want, clamp(dt * 2.4, 0, 1));
  const d = dist(cg.x, cg.y, px, py);
  const target = d > 80 ? cg.type.max : cg.type.max * 0.5;
  cg.speed += clamp(target - cg.speed, -260 * dt, cg.type.accel * dt);
  cg.x += Math.cos(cg.angle) * cg.speed * dt;
  cg.y += Math.sin(cg.angle) * cg.speed * dt;
  if (cg.x > 430) cg.x = 430;
  cg.x = clamp(cg.x, 50, 430);
  cg.y = clamp(cg.y, 60, 2340);
}

export function driveVehicle(v, input, dt, onWater) {
  const up = input.held('KeyW', 'ArrowUp');
  const down = input.held('KeyS', 'ArrowDown');
  const left = input.held('KeyA', 'ArrowLeft');
  const right = input.held('KeyD', 'ArrowRight');
  const grip = onWater ? 1.6 : 2.6;
  if (up) v.speed += v.type.accel * dt;
  if (down) v.speed -= v.type.accel * 0.8 * dt;
  if (!up && !down) v.speed -= v.speed * 0.7 * dt;
  v.speed = clamp(v.speed, -v.type.max * 0.45, v.type.max);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const dir = v.speed >= 0 ? 1 : -1;
  v.angle += steer * grip * dt * clamp(Math.abs(v.speed) / 90, 0, 1) * dir;
  return { moved: Math.abs(v.speed) > 5 };
}

export function moveVehicle(world, v, dt) {
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  if (v.kind === 'boat') {
    if (nx > 40 && nx < 425 && ny > 50 && ny < 2350) { v.x = nx; v.y = ny; }
    else v.speed *= 0.5;
    return true;
  }
  const hit = collideBuildings(world, nx, ny, 14);
  if (hit) {
    v.speed *= -0.25;
    return false;
  }
  if (nx < 460 || nx > WORLD_W - 30 || ny < 40 || ny > WORLD_H - 30) {
    v.speed *= 0.4;
    return false;
  }
  v.x = nx; v.y = ny;
  return true;
}

export function drawVehicle(ctx, v, t) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 3, v.len / 2, v.wid / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();
  if (v.kind === 'boat') {
    // hull
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.moveTo(v.len / 2, 0);
    ctx.lineTo(v.len / 4, -v.wid / 2);
    ctx.lineTo(-v.len / 2, -v.wid / 2);
    ctx.lineTo(-v.len / 2, v.wid / 2);
    ctx.lineTo(v.len / 4, v.wid / 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-v.len / 6, -v.wid / 4, v.len / 3, v.wid / 2);
    if (v.coastguard) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-v.len / 2, -v.wid / 2, 6, v.wid);
      ctx.fillStyle = '#2980b9';
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CG', 0, 3);
    }
    // wake
    if (Math.abs(v.speed) > 40) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(-v.len / 2 - 8 - (t * 30 % 18), 0, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const L = v.len, W = v.wid;
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -W / 2, L, W, 7);
    ctx.fill();
    // windows
    ctx.fillStyle = '#1d2b36';
    ctx.fillRect(-L / 6, -W / 2 + 3, L / 3, W - 6);
    ctx.fillStyle = v.type.name === 'Taxi' ? '#f39c12' : 'rgba(255,255,255,0.25)';
    ctx.fillRect(L / 2 - 8, -W / 2 + 2, 5, W - 4);
    // headlights / taillights
    ctx.fillStyle = '#ffe9a3';
    ctx.fillRect(L / 2 - 2, -W / 2 + 2, 2, 4);
    ctx.fillRect(L / 2 - 2, W / 2 - 6, 2, 4);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-L / 2, -W / 2 + 2, 2, 4);
    ctx.fillRect(-L / 2, W / 2 - 6, 2, 4);
    if (v.police) {
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(-L / 4, -W / 2, L / 2, W);
      ctx.fillStyle = '#2c3e50';
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
      const blink = Math.floor(t * 4) % 2 === 0;
      ctx.fillStyle = blink ? '#e74c3c' : '#3498db';
      ctx.beginPath(); ctx.arc(-6, -W / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blink ? '#3498db' : '#e74c3c';
      ctx.beginPath(); ctx.arc(6, -W / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (v.smoke > 0) {
      ctx.fillStyle = 'rgba(120,120,120,0.6)';
      ctx.beginPath(); ctx.arc(-L / 2 - 6, (Math.sin(t * 9) * 4), 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

export function drawVehicles(ctx, list, t, cam) {
  for (const v of list) {
    if (v.x < cam.x - 80 || v.x > cam.x + cam.w + 80 || v.y < cam.y - 80 || v.y > cam.y + cam.h + 80) continue;
    drawVehicle(ctx, v, t);
  }
}
