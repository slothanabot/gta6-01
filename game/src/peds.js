// Pedestrians: beachgoers, shoppers and dock workers who stroll the
// sidewalks, panic and run from gunfire, and can be bumped (which the
// police notice). Original code for Marina Bay.
import { mulberry32, randRange, pick, clamp, dist, angleTo, circleRectHit } from './util.js';
import { isWater, collideBuildings, nearestRoadPoint } from './world.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2ecc71'];
const PANTS = ['#2c3e50', '#7f8c8d', '#34495e', '#5d6d7e'];

export function makePeds(world, count) {
  const rng = mulberry32(777);
  const peds = [];
  for (let i = 0; i < count; i++) {
    let x, y, tries = 0;
    do {
      x = randRange(rng, 480, 3100);
      y = randRange(rng, 90, 2320);
      tries++;
    } while (tries < 20 && (isWater(world, x, y) || collideBuildings(world, x, y, 16)));
    peds.push({
      x, y,
      angle: randRange(rng, 0, Math.PI * 2),
      speed: randRange(rng, 22, 46),
      shirt: pick(rng, SHIRTS),
      pants: pick(rng, PANTS),
      skin: pick(rng, ['#f2c89b', '#d9a066', '#a9714b', '#f7d7b0']),
      panic: 0,
      wanderT: randRange(rng, 1, 4),
      down: false,
      downT: 0,
      bob: randRange(rng, 0, Math.PI * 2),
    });
  }
  return peds;
}

export function updatePeds(world, peds, dt, danger) {
  for (const p of peds) {
    if (p.down) {
      p.downT -= dt;
      if (p.downT <= 0) p.down = false;
      continue;
    }
    if (danger) {
      const d = dist(p.x, p.y, danger.x, danger.y);
      if (d < 260) p.panic = Math.max(p.panic, 2.5);
    }
    if (p.panic > 0) {
      p.panic -= dt;
      const away = danger ? angleTo(danger.x, danger.y, p.x, p.y) : p.angle;
      p.angle = away;
      const sp = 130;
      const nx = p.x + Math.cos(p.angle) * sp * dt;
      const ny = p.y + Math.sin(p.angle) * sp * dt;
      if (!isWater(world, nx, ny) && !collideBuildings(world, nx, ny, 12)) { p.x = nx; p.y = ny; }
      p.bob += dt * 14;
      continue;
    }
    p.wanderT -= dt;
    if (p.wanderT <= 0) {
      p.wanderT = randRange(Math.random, 2, 6);
      const rp = nearestRoadPoint(world, p.x, p.y);
      if (rp) p.angle = Math.atan2(rp.y - p.y, rp.x - p.x) + (Math.random() - 0.5) * 1.2;
      else p.angle = Math.random() * Math.PI * 2;
    }
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (nx > 460 && nx < 3160 && ny > 60 && ny < 2340 && !isWater(world, nx, ny) && !collideBuildings(world, nx, ny, 12)) {
      p.x = nx; p.y = ny;
      p.bob += dt * 7;
    } else {
      p.angle += Math.PI / 2;
    }
  }
}

export function drawPeds(ctx, peds, cam) {
  for (const p of peds) {
    if (p.x < cam.x - 30 || p.x > cam.x + cam.w + 30 || p.y < cam.y - 30 || p.y > cam.y + cam.h + 30) continue;
    const bob = Math.sin(p.bob) * 1.5;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.arc(11, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 6, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.fillStyle = p.pants;
    ctx.fillRect(-4, 1 + bob, 3, 8);
    ctx.fillRect(1, 1 - bob, 3, 8);
    // body
    ctx.fillStyle = p.shirt;
    ctx.fillRect(-6, -8, 12, 11);
    // head
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(0, -12, 5.5, 0, Math.PI * 2); ctx.fill();
    // panic mark
    if (p.panic > 0) {
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -22);
    }
    ctx.restore();
  }
}

export function pedAt(peds, x, y, r) {
  for (const p of peds) {
    if (!p.down && dist(p.x, p.y, x, y) < r + 9) return p;
  }
  return null;
}
