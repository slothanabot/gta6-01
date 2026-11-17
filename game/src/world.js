// Marina Bay: the city itself. A fixed-seed coastal town, 3200 x 2400.
// West is ocean + sand, south-west is the marina and docks, the middle is
// Old Town, east is the industrial docks, north is the hillside houses.
// Roads form a grid; buildings sit inside the blocks. All original.
import { mulberry32, randRange, pick, clamp } from './util.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const WATER_X = 430; // everything west of this is sea

export function makeWorld() {
  const rng = mulberry32(20261117);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const piers = [];
  const pickups = []; // health / ammo crates placed around town

  // Road centrelines: verticals and horizontals on a 400 grid, offset so
  // the beach road hugs the coast.
  const vRoads = [560, 960, 1360, 1760, 2160, 2560, 2960];
  const hRoads = [320, 720, 1120, 1520, 1920, 2240];

  const roadRects = [];
  for (const x of vRoads) roadRects.push({ x: x - 26, y: 0, w: 52, h: WORLD_H, vert: true });
  for (const y of hRoads) roadRects.push({ x: WATER_X, y: y - 26, w: WORLD_W - WATER_X, h: 52, vert: false });

  function onRoad(x, y, pad) {
    for (const r of roadRects) {
      if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return true;
    }
    return false;
  }

  // Buildings fill the blocks between roads.
  const palettes = {
    town: ['#e8b04b', '#d97b4f', '#c96f5a', '#e6d3a3', '#9db8a6', '#b5674c'],
    hills: ['#f2e3c6', '#e0a899', '#cfe0d8', '#d9c27a'],
    docks: ['#8d99a6', '#7a8894', '#a67c52', '#6f7f8c'],
    marina: ['#f4ead2', '#e8c98a', '#a8c8c0'],
  };
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 5; by++) {
      const x0 = (bx === 0 ? WATER_X + 70 : vRoads[bx - 1] + 46);
      const x1 = (bx >= 6 ? WORLD_W - 60 : vRoads[bx] - 46);
      const y0 = (by === 0 ? 60 : hRoads[by - 1] + 46);
      const y1 = (by >= 5 ? WORLD_H - 60 : hRoads[by] - 46);
      const district = bx >= 5 ? 'docks' : by === 0 ? 'hills' : bx === 0 ? 'marina' : 'town';
      const palette = palettes[district];
      const count = district === 'docks' ? 2 : 2 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i++) {
        const w = randRange(rng, 90, district === 'docks' ? 260 : 150);
        const h = randRange(rng, 80, district === 'docks' ? 150 : 130);
        const x = randRange(rng, x0, Math.max(x0 + 1, x1 - w));
        const y = randRange(rng, y0, Math.max(y0 + 1, y1 - h));
        const b = {
          x, y, w, h,
          color: pick(rng, palette),
          roof: rng() < 0.3 ? '#b8452f' : rng() < 0.5 ? '#5d6b73' : '#8a6d4b',
          floors: 1 + Math.floor(rng() * (district === 'town' ? 3 : 1)),
          district,
        };
        let clash = false;
        for (const o of buildings) {
          if (b.x < o.x + o.w + 18 && b.x + b.w + 18 > o.x && b.y < o.y + o.h + 18 && b.y + b.h + 18 > o.y) { clash = true; break; }
        }
        if (!clash) buildings.push(b);
      }
    }
  }

  // Palm trees along the beach road and scattered in town.
  for (let y = 80; y < WORLD_H - 60; y += 130) {
    trees.push({ x: WATER_X + 62 + randRange(rng, -8, 8), y: y + randRange(rng, -20, 20), palm: true });
  }
  for (let i = 0; i < 90; i++) {
    const x = randRange(rng, WATER_X + 90, WORLD_W - 80);
    const y = randRange(rng, 80, WORLD_H - 80);
    if (!onRoad(x, y, 40) && !buildings.some((b) => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20)) {
      trees.push({ x, y, palm: rng() < 0.55 });
    }
  }

  // Street lamps along the main roads.
  for (const x of vRoads) for (let y = 140; y < WORLD_H; y += 400) lamps.push({ x: x + 34, y });
  for (const y of hRoads) for (let x = WATER_X + 140; x < WORLD_W; x += 400) lamps.push({ x, y: y + 34 });

  // Marina piers jutting into the sea, south-west.
  piers.push({ x: 300, y: 1500, w: 130, h: 26 });
  piers.push({ x: 300, y: 1750, w: 150, h: 26 });
  piers.push({ x: 310, y: 2010, w: 120, h: 26 });
  piers.push({ x: 330, y: 900, w: 100, h: 24 });

  // Pickups: health kits near the clinic and beach, ammo near the docks.
  pickups.push({ x: 1000, y: 760, kind: 'health' });
  pickups.push({ x: 500, y: 1150, kind: 'health' });
  pickups.push({ x: 2200, y: 1560, kind: 'ammo' });
  pickups.push({ x: 2900, y: 700, kind: 'ammo' });
  pickups.push({ x: 1400, y: 1900, kind: 'health' });
  pickups.push({ x: 620, y: 2050, kind: 'cash' });

  const world = {
    buildings, trees, lamps, piers, pickups, vRoads, hRoads,
    spawn: { x: 620, y: 1560, angle: -Math.PI / 2 }, // marina car park
    beachBar: { x: 560, y: 1080 },
    marinaOffice: { x: 700, y: 1560 },
    chopShop: { x: 2880, y: 1560 },
    warehouse: { x: 2700, y: 760 },
    lighthouse: { x: 500, y: 260 },
    clinic: { x: 980, y: 740 },
  };
  return world;
}

export function isWater(world, x, y) {
  if (x < WATER_X) {
    for (const p of world.piers) {
      if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return false;
    }
    return true;
  }
  return false;
}

export function collideBuildings(world, x, y, r) {
  for (const b of world.buildings) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

export function nearestRoadPoint(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of world.vRoads) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vert: true }; }
  }
  for (const ry of world.hRoads) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vert: false }; }
  }
  return best;
}

export function drawWorld(ctx, world, cam, t) {
  const { x: cx, y: cy, w: vw, h: vh } = cam;
  // Sand + sea base.
  ctx.fillStyle = '#e8d39a';
  ctx.fillRect(cx, cy, vw, vh);
  const seaGrad = ctx.createLinearGradient(cx, 0, WATER_X, 0);
  seaGrad.addColorStop(0, '#1b7fa8');
  seaGrad.addColorStop(1, '#3fb3d9');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(cx, cy, Math.max(0, WATER_X - cx), vh);
  // Animated wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const wy = ((i * 173 + Math.floor(t * 24)) % (WORLD_H + 200)) - 100;
    if (wy < cy - 20 || wy > cy + vh + 20) continue;
    ctx.beginPath();
    const x0 = Math.max(cx, 40);
    for (let x = x0; x < WATER_X - 8; x += 24) {
      const yy = wy + Math.sin(x * 0.05 + t * 1.4 + i) * 4;
      if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Wet sand strip.
  ctx.fillStyle = '#dcc489';
  ctx.fillRect(WATER_X - 14, cy, 14, vh);
  // Grass / town ground east of the beach road.
  ctx.fillStyle = '#a9c47e';
  ctx.fillRect(Math.max(cx, WATER_X + 40), cy, vw, vh);
  // City blocks: pale pavement.
  ctx.fillStyle = '#c9bfa5';
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 5; by++) {
      const x0 = (bx === 0 ? WATER_X + 70 : world.vRoads[bx - 1] + 46);
      const x1 = (bx >= 6 ? WORLD_W - 60 : world.vRoads[bx] - 46);
      const y0 = (by === 0 ? 60 : world.hRoads[by - 1] + 46);
      const y1 = (by >= 5 ? WORLD_H - 60 : world.hRoads[by] - 46);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  // Roads.
  ctx.fillStyle = '#3d4450';
  for (const r of [{ x: 0, y: 0, w: 0, h: 0 }]) { /* noop keep linter calm */ }
  for (const x of world.vRoads) ctx.fillRect(x - 26, cy, 52, vh);
  for (const y of world.hRoads) ctx.fillRect(Math.max(cx, WATER_X), y - 26, vw, 52);
  // Road centre dashes.
  ctx.fillStyle = '#f4d35e';
  for (const x of world.vRoads) {
    for (let y = Math.floor(cy / 64) * 64; y < cy + vh; y += 64) ctx.fillRect(x - 2, y, 4, 30);
  }
  for (const y of world.hRoads) {
    for (let x = Math.floor(cx / 64) * 64; x < cx + vw; x += 64) {
      if (x < WATER_X) continue;
      ctx.fillRect(x, y - 2, 30, 4);
    }
  }
  // Piers.
  ctx.fillStyle = '#8a6d4b';
  for (const p of world.piers) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#6f5638';
    for (let x = p.x + 8; x < p.x + p.w; x += 18) ctx.fillRect(x, p.y, 3, p.h);
    ctx.fillStyle = '#8a6d4b';
  }
  // Lighthouse.
  ctx.fillStyle = '#f2ede4';
  ctx.fillRect(world.lighthouse.x - 12, world.lighthouse.y - 26, 24, 52);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(world.lighthouse.x - 12, world.lighthouse.y - 26, 24, 10);
  ctx.fillRect(world.lighthouse.x - 12, world.lighthouse.y - 2, 24, 10);
  // Buildings with windows and roof trim.
  for (const b of world.buildings) {
    if (b.x + b.w < cx || b.x > cx + vw || b.y + b.h < cy || b.y > cy + vh) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 30));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i + j) % 3 === 0) continue;
        ctx.fillRect(b.x + 8 + i * 26, b.y + 14 + j * 30, 12, 15);
      }
    }
  }
  // Trees and palms.
  for (const tr of world.trees) {
    if (tr.x < cx - 30 || tr.x > cx + vw + 30 || tr.y < cy - 30 || tr.y > cy + vh + 30) continue;
    if (tr.palm) {
      ctx.strokeStyle = '#7a5a33';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x + 4, tr.y - 16); ctx.stroke();
      ctx.fillStyle = '#3f9e4d';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(tr.x + 4 + Math.cos(a) * 11, tr.y - 16 + Math.sin(a) * 7, 12, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#5da24a';
      ctx.beginPath(); ctx.arc(tr.x, tr.y - 8, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(tr.x - 2, tr.y - 6, 4, 12);
    }
  }
  // Lamps.
  ctx.fillStyle = '#2c343c';
  for (const l of world.lamps) {
    if (l.x < cx || l.x > cx + vw || l.y < cy || l.y > cy + vh) continue;
    ctx.fillRect(l.x - 2, l.y - 10, 4, 20);
    ctx.fillStyle = '#ffe9a3';
    ctx.beginPath(); ctx.arc(l.x, l.y - 12, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c343c';
  }
}
