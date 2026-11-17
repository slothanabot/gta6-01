// The player: Rico Marlin, smuggler-courier of Marina Bay. On foot he runs,
// punches and shoots; near a car or boat he can steal it and drive.
// Wanted stars rise with crimes and fall when the player stays out of sight.
import { clamp, dist, angleTo, circleRectHit } from './util.js';
import { isWater, collideBuildings } from './world.js';

export function makePlayer(world) {
  return {
    x: world.spawn.x, y: world.spawn.y,
    angle: world.spawn.angle,
    speed: 0,
    hp: 100, maxHp: 100,
    cash: 250,
    hasPistol: false, ammo: 0,
    inVehicle: null,
    wanted: 0,
    wantedT: 0,
    punchT: 0,
    shootT: 0,
    aimAngle: 0,
    invulnT: 0,
    bob: 0,
  };
}

export function addWanted(player, n, audio) {
  const before = player.wanted;
  player.wanted = clamp(player.wanted + n, 0, 5);
  player.wantedT = 0;
  if (player.wanted > before && audio) audio.phone();
}

export function updatePlayerOnFoot(game, dt) {
  const { player, input, world, peds } = game;
  const run = input.held('ShiftLeft', 'ShiftRight');
  const sp = run ? 235 : 150;
  let mx = 0, my = 0;
  if (input.held('KeyW', 'ArrowUp')) my -= 1;
  if (input.held('KeyS', 'ArrowDown')) my += 1;
  if (input.held('KeyA', 'ArrowLeft')) mx -= 1;
  if (input.held('KeyD', 'ArrowRight')) mx += 1;
  if (mx || my) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    player.angle = Math.atan2(my, mx);
    const ox = player.x;
    const oy = player.y;
    const nx = player.x + mx * sp * dt;
    const ny = player.y + my * sp * dt;
    if (!collideBuildings(world, nx, player.y, 11)) player.x = nx;
    if (!collideBuildings(world, player.x, ny, 11)) player.y = ny;
    player.x = clamp(player.x, 30, 3170);
    player.y = clamp(player.y, 30, 2370);
    player.bob += dt * 11;
    // Deep water is off limits on foot: stay on the sand and the piers.
    if (isWater(world, player.x, player.y)) {
      player.x = ox;
      player.y = oy;
    }
  }
  // Aim with the mouse.
  player.aimAngle = Math.atan2(input.mouse.worldY - player.y, input.mouse.worldX - player.x);
  player.punchT -= dt;
  player.shootT -= dt;
  player.invulnT -= dt;

  // Punch: short range, knocks a ped down.
  if (input.wasPressed('KeyF') && player.punchT <= 0) {
    player.punchT = 0.35;
    game.audio.punch();
    const fx = player.x + Math.cos(player.angle) * 26;
    const fy = player.y + Math.sin(player.angle) * 26;
    for (const p of peds) {
      if (!p.down && dist(p.x, p.y, fx, fy) < 26) {
        p.down = true; p.downT = 4; p.panic = 3;
        addWanted(player, 1, game.audio);
        game.addMessage('You knocked a pedestrian down. The law noticed.');
        game.addDanger(player.x, player.y);
        break;
      }
    }
    for (const e of game.enemies) {
      if (!e.down && dist(e.x, e.y, fx, fy) < 30) {
        e.hp -= 34;
        game.addMessage('You landed a punch.');
        if (e.hp <= 0) { e.down = true; e.downT = 999; }
        break;
      }
    }
  }
  // Shoot toward the mouse.
  if ((input.mouse.down || input.wasPressed('Space')) && player.shootT <= 0 && player.hasPistol && player.ammo > 0) {
    player.shootT = 0.22;
    player.ammo -= 1;
    player.aimAngle = Math.atan2(input.mouse.worldY - player.y, input.mouse.worldX - player.x);
    game.audio.shoot();
    game.fireBullet(player.x, player.y, player.aimAngle, true);
    addWanted(player, 1, game.audio);
    game.addDanger(player.x, player.y);
  }
  // Pickups.
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    if (dist(player.x, player.y, pk.x, pk.y) < 26) {
      pk.taken = true;
      if (pk.kind === 'health') { player.hp = Math.min(player.maxHp, player.hp + 50); game.addMessage('Health kit +50.'); }
      if (pk.kind === 'ammo') { player.hasPistol = true; player.ammo += 24; game.addMessage('Pistol ammo +24.'); }
      if (pk.kind === 'cash') { player.cash += 150; game.addMessage('Found a dropped wallet: +$150.'); game.audio.cash(); }
      game.audio.pickup();
    }
  }
}

export function drawPlayer(ctx, player, t) {
  if (player.inVehicle) return;
  const bob = Math.sin(player.bob) * 1.5;
  ctx.save();
  ctx.translate(player.x, player.y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 7, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // legs
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-4, 1 + bob, 3, 8);
  ctx.fillRect(1, 1 - bob, 3, 8);
  // jacket: teal courier jacket, white tee
  ctx.fillStyle = '#0e7c7b';
  ctx.fillRect(-7, -8, 14, 11);
  ctx.fillStyle = '#f5f5f0';
  ctx.fillRect(-2, -8, 4, 11);
  // head + cap
  ctx.fillStyle = '#d9a066';
  ctx.beginPath(); ctx.arc(0, -12, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e67e22';
  ctx.beginPath(); ctx.arc(0, -13, 5.5, Math.PI, 0); ctx.fill();
  ctx.fillRect(-5, -14, 11, 3);
  // pistol in hand when armed
  if (player.hasPistol) {
    const a = player.aimAngle;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6 - 4);
    ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15 - 4);
    ctx.stroke();
  }
  // punch swing
  if (player.punchT > 0.15) {
    ctx.fillStyle = '#d9a066';
    ctx.beginPath();
    ctx.arc(Math.cos(player.angle) * 16, Math.sin(player.angle) * 16 - 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
