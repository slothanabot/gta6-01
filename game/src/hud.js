// HUD: health, cash, wanted stars, mission tracker, speed, message feed,
// the minimap, and the start / pause / busted / wasted / story-done screens.
// All drawn on the game canvas. Original code for Marina Bay.
import { clamp, fmtCash } from './util.js';
import { missionTarget, MISSIONS } from './missions.js';
import { WATER_X, WORLD_W, WORLD_H } from './world.js';

function drawStars(ctx, wanted, x, y) {
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#f1c40f' : 'rgba(255,255,255,0.35)';
    ctx.strokeStyle = '#7a5c00';
    ctx.lineWidth = 1;
    const cx = x + i * 26;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
      const px = cx + Math.cos(a) * 10;
      const py = y + Math.sin(a) * 10;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

export function drawMinimap(ctx, game, x, y, size) {
  const s = size / WORLD_W;
  const w = game.world;
  ctx.save();
  ctx.translate(x, y);
  // sea + land
  ctx.fillStyle = '#1b7fa8';
  ctx.fillRect(0, 0, size, size * (WORLD_H / WORLD_W));
  ctx.fillStyle = '#a9c47e';
  ctx.fillRect(WATER_X * s, 0, size - WATER_X * s, size * (WORLD_H / WORLD_W));
  // roads
  ctx.fillStyle = '#3d4450';
  for (const rx of w.vRoads) ctx.fillRect(rx * s - 1, 0, 2, size * (WORLD_H / WORLD_W));
  for (const ry of w.hRoads) ctx.fillRect(WATER_X * s, ry * s - 1, size - WATER_X * s, 2);
  // mission target
  const tgt = missionTarget(game);
  if (tgt) {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(tgt.x * s, tgt.y * s, 5, 0, Math.PI * 2); ctx.fill();
  }
  // police
  ctx.fillStyle = '#3498db';
  for (const pc of game.police) {
    ctx.beginPath(); ctx.arc(pc.x * s, pc.y * s, 3, 0, Math.PI * 2); ctx.fill();
  }
  // player arrow
  ctx.save();
  ctx.translate(game.player.x * s, game.player.y * s);
  ctx.rotate(game.player.inVehicle ? game.player.inVehicle.angle : game.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // frame + label
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size * (WORLD_H / WORLD_W));
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MARINA BAY', 6, size * (WORLD_H / WORLD_W) - 6);
  ctx.restore();
}

export function drawHud(ctx, game, vw, vh) {
  const p = game.player;
  ctx.save();
  // Top-left: health + cash + wanted.
  ctx.fillStyle = 'rgba(6,34,48,0.62)';
  ctx.beginPath(); ctx.roundRect(12, 12, 250, 84, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RICO MARLIN', 24, 34);
  // health bar
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 42, 150, 12);
  ctx.fillStyle = p.hp > 30 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(24, 42, 150 * clamp(p.hp / p.maxHp, 0, 1), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText(Math.ceil(p.hp) + ' HP', 180, 52);
  // cash
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(fmtCash(p.cash), 24, 76);
  // pistol
  if (p.hasPistol) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = '12px sans-serif';
    ctx.fillText('Pistol  ' + p.ammo, 130, 76);
  }
  drawStars(ctx, p.wanted, 24, 108);
  // Top-right: mission tracker.
  const tgt = missionTarget(game);
  ctx.fillStyle = 'rgba(6,34,48,0.62)';
  ctx.beginPath(); ctx.roundRect(vw - 322, 12, 310, 64, 10); ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  if (game.mission) {
    ctx.fillText(MISSIONS[game.mission.index].title, vw - 310, 34);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    wrapText(ctx, tgt ? tgt.label : '...', vw - 310, 54, 286, 15);
  } else if (game.storyDone) {
    ctx.fillText('STORY COMPLETE', vw - 310, 34);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText('Marina Bay is yours. Free roam!', vw - 310, 54);
  } else {
    ctx.fillText('NO ACTIVE JOB', vw - 310, 34);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText('Press N to call Sal for work.', vw - 310, 54);
  }
  // Bottom-right: minimap.
  drawMinimap(ctx, game, vw - 202, vh - 168, 190);
  // Bottom-left: speed when driving.
  if (p.inVehicle) {
    const kmh = Math.round(Math.abs(p.inVehicle.speed) * 0.45);
    ctx.fillStyle = 'rgba(6,34,48,0.62)';
    ctx.beginPath(); ctx.roundRect(12, vh - 66, 150, 54, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(kmh + ' km/h', 26, vh - 32);
    ctx.fillStyle = '#9fd8ef';
    ctx.font = '11px sans-serif';
    ctx.fillText(p.inVehicle.type.name + (p.inVehicle.police ? ' (stolen!)' : ''), 26, vh - 18);
  }
  // Message feed.
  ctx.font = '13px sans-serif';
  let my = vh - 190;
  const msgs = game.messages.slice(-4);
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const age = game.time - m.at;
    if (age > 9) continue;
    ctx.globalAlpha = age > 7 ? (9 - age) / 2 : 1;
    ctx.fillStyle = 'rgba(6,34,48,0.7)';
    const wdt = ctx.measureText(m.text).width + 18;
    ctx.beginPath(); ctx.roundRect(12, my - 16, Math.min(wdt, vw - 240), 20, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(m.text, 21, my - 2);
    my -= 24;
  }
  ctx.globalAlpha = 1;
  // Controls reminder, small.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '11px sans-serif';
  ctx.fillText('E enter/exit vehicle · Space shoot · F punch · M mute · P pause', 12, vh - 12);
  ctx.restore();
}

export function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = wd;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function panel(ctx, vw, vh, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,24,36,0.78)';
  ctx.fillRect(0, 0, vw, vh);
  const pw = Math.min(620, vw - 60);
  const ph = 110 + lines.length * 24;
  const px = (vw - pw) / 2;
  const py = (vh - ph) / 2;
  ctx.fillStyle = '#0d2f42';
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 14); ctx.fill();
  ctx.strokeStyle = accent || '#f1c40f';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = accent || '#f1c40f';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, vw / 2, py + 52);
  ctx.fillStyle = '#eaf6fb';
  ctx.font = '15px sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, vw / 2, py + 92 + i * 24));
  ctx.restore();
}

export function drawMenu(ctx, game, vw, vh) {
  const t = game.time;
  // Sunny title backdrop: sea gradient + sun.
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, '#7ec8e3');
  g.addColorStop(0.55, '#3fb3d9');
  g.addColorStop(1, '#e8d39a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath(); ctx.arc(vw - 170, 120, 58, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,243,176,0.35)';
  ctx.beginPath(); ctx.arc(vw - 170, 120, 84, 0, Math.PI * 2); ctx.fill();
  // little boat bobbing
  const bx = vw / 2 + Math.sin(t * 0.5) * 30;
  const by = vh * 0.62 + Math.sin(t * 1.2) * 4;
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(bx - 70, by); ctx.lineTo(bx + 70, by); ctx.lineTo(bx + 50, by + 22); ctx.lineTo(bx - 50, by + 22);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 52); ctx.lineTo(bx + 46, by); ctx.closePath(); ctx.fill();
  // Title.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0b2a3a';
  ctx.font = 'bold 54px "Trebuchet MS", sans-serif';
  ctx.fillText('MARINA BAY', vw / 2, 150);
  ctx.fillStyle = '#c0392b';
  ctx.font = 'bold 34px "Trebuchet MS", sans-serif';
  ctx.fillText("SMUGGLER'S RUN", vw / 2, 196);
  ctx.fillStyle = '#0b2a3a';
  ctx.font = '16px sans-serif';
  ctx.fillText('A sunny coastal smuggler-courier story — boats, cars, cops and one last big score.', vw / 2, 232);
  ctx.font = '15px sans-serif';
  const lines = [
    'You are Rico Marlin, courier for the Harbor Crew.',
    'Run packages by boat and by car, dodge the coast guard,',
    'and keep the cops off your tail. Six jobs. One big score.',
    '',
    'WASD move / drive · E enter or exit a vehicle · Space shoot · F punch',
    'Shift run · M mute · P pause · progress saves automatically',
  ];
  lines.forEach((ln, i) => ctx.fillText(ln, vw / 2, 300 + i * 24));
  const blink = Math.floor(t * 1.6) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#0b2a3a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(game.hasSave ? 'CLICK OR PRESS ENTER — CONTINUE' : 'CLICK OR PRESS ENTER — START', vw / 2, vh - 90);
  }
  ctx.fillStyle = 'rgba(11,42,58,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('An original game. No real places, people or brands. Keyboard + mouse, plays offline.', vw / 2, vh - 40);
}

export function drawPause(ctx, vw, vh) {
  panel(ctx, vw, vh, 'PAUSED', ['Press P or Esc to keep playing.', 'Progress is saved automatically after every job.'], '#9fd8ef');
}

export function drawBusted(ctx, vw, vh, cash) {
  panel(ctx, vw, vh, 'BUSTED!', ['The Marina Bay police took you in.', 'You lost $' + cash + ' in fines. The crew bailed you out.'], '#3498db');
}

export function drawWasted(ctx, vw, vh) {
  panel(ctx, vw, vh, 'WASTED', ['Rico woke up at the clinic, patched up and poorer.', 'Press Enter to get back on the streets.'], '#e74c3c');
}

export function drawStoryDone(ctx, vw, vh) {
  panel(ctx, vw, vh, 'THE BIG SCORE!', ['All six jobs done. Marina Bay is your town now, Rico.', 'Keep free-roaming, or press R to play the story again.'], '#2ecc71');
}
