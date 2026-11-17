// hud.js — DOM HUD updates and the circular minimap (canvas): roads, beach,
// ocean, player arrow, traffic dots, police dots and the mission marker.
import { repTitle } from './missions.js';

const MINIMAP_SCALE = 220 / 480; // minimap px per world unit (world spans ~480)

export function updateHud(state) {
  const $ = (id) => document.getElementById(id);
  $('cash-value').textContent = Math.floor(state.cash).toLocaleString('en-US');
  $('health-fill').style.width = Math.max(0, state.health) + '%';
  $('health-text').textContent = Math.max(0, Math.round(state.health));
  $('rep-value').textContent = repTitle(state.cash);
  const wanted = $('wanted');
  let stars = '';
  for (let i = 0; i < 5; i++) stars += `<span class="star${i < state.wanted ? '' : ' off'}">★</span>`;
  wanted.innerHTML = stars;
  $('clock').innerHTML = `DAY ${state.day} &middot; ${state.clock}`;
  $('objective-title').textContent = state.missionTitle;
  $('objective-text').textContent = state.objectiveText;
  $('objective-dist').textContent = state.objectiveDist ? `${Math.round(state.objectiveDist)} m — ${state.objectiveHint || ''}` : '';
  // weapon box
  const wb = $('weapon-box');
  if (state.inCar) { wb.classList.add('hidden'); }
  else {
    wb.classList.remove('hidden');
    $('weapon-icon').textContent = state.weapon.icon;
    $('weapon-name').textContent = state.weapon.name;
    $('weapon-ammo').textContent = state.weapon.ammo === Infinity ? '∞' : `${state.ammo} / ${state.reserve}`;
  }
  const sb = $('speed-box');
  if (state.inCar) {
    sb.classList.remove('hidden');
    $('speed-value').textContent = Math.round(Math.abs(state.speed) * 3.6);
  } else sb.classList.add('hidden');
  // crosshair: hidden while driving, and unarmed fists hide it unless attacking
  $('crosshair').classList.toggle('hidden', state.inCar || (state.weapon.name === 'FISTS' && !state.aiming));
  $('interact').classList.toggle('hidden', !state.interactText);
  if (state.interactText) $('interact-text').textContent = state.interactText;
  $('damage').style.opacity = state.damageFlash > 0 ? Math.min(1, state.damageFlash) : 0;
}

export function showBanner(title, sub) {
  const b = document.getElementById('mission-banner');
  b.innerHTML = `${title}<small>${sub || ''}</small>`;
  b.classList.remove('hidden');
  setTimeout(() => b.classList.add('hidden'), 2600);
}

export function showToast(text, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

export function drawMinimap(state) {
  const cv = document.getElementById('minimap');
  const g = cv.getContext('2d');
  const W = 220, C = W / 2;
  g.clearRect(0, 0, W, W);
  g.save();
  g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.clip();
  // water background (ocean east + bay south)
  g.fillStyle = '#0f3a52'; g.fillRect(0, 0, W, W);
  const toMap = (x, z) => [C + x * MINIMAP_SCALE, C + z * MINIMAP_SCALE];
  // land
  g.fillStyle = '#2e6b46';
  g.fillRect(...toMap(-210, -210), 420 * MINIMAP_SCALE, 420 * MINIMAP_SCALE);
  // beach + sand
  g.fillStyle = '#e8d39a';
  const [bx, by] = toMap(150, -210);
  g.fillRect(bx, by, 80 * MINIMAP_SCALE, 420 * MINIMAP_SCALE);
  // roads
  g.strokeStyle = '#3a3f46'; g.lineWidth = 5;
  for (const x of [-150, -100, -50, 0, 50, 100, 150]) {
    const [ax, ay] = toMap(x, -210), [cx2, cy2] = toMap(x, 210);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(cx2, cy2); g.stroke();
  }
  for (const z of [-150, -100, -50, 0, 50, 100, 150]) {
    const [ax, ay] = toMap(-210, z), [cx2, cy2] = toMap(210, z);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(cx2, cy2); g.stroke();
  }
  // mission marker (pulsing gold diamond)
  if (state.missionTarget) {
    const [mx, my] = toMap(state.missionTarget.x, state.missionTarget.z);
    const pulse = 7 + Math.sin(performance.now() / 200) * 2;
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.moveTo(mx, my - pulse); g.lineTo(mx + pulse, my); g.lineTo(mx, my + pulse); g.lineTo(mx - pulse, my); g.closePath(); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
  }
  // traffic (white dots) + police (flashing blue/red)
  for (const c of state.traffic || []) {
    const [x, y] = toMap(c.x, c.z);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
  }
  for (const p of state.police || []) {
    if (!p.active) continue;
    const [x, y] = toMap(p.x, p.z);
    g.fillStyle = Math.floor(performance.now() / 250) % 2 ? '#ff4444' : '#4488ff';
    g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
  }
  // player arrow (rotates with heading)
  const [px, py] = toMap(state.player.x, state.player.z);
  g.save();
  g.translate(px, py); g.rotate(state.player.heading);
  g.fillStyle = '#7dff9a'; g.strokeStyle = '#06283a'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.closePath(); g.fill(); g.stroke();
  g.restore();
  g.restore();
  // north tick
  g.fillStyle = '#fff'; g.font = 'bold 11px Trebuchet MS'; g.textAlign = 'center';
  g.fillText('N', C, 14);
}
