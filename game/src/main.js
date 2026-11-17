// Marina Bay: Smuggler's Run — entry point and game loop.
// A sunny coastal open-world crime game: explore Marina Bay on foot, by car
// and by boat; steal vehicles; dodge police cruisers and the coast guard;
// run six story jobs for the Harbor Crew; save automatically.
// Original code, written for the make.fun gta6-01 bounty.
import { makeWorld, drawWorld, isWater, collideBuildings, WORLD_W, WORLD_H } from './world.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { makePlayer, updatePlayerOnFoot, drawPlayer, addWanted } from './player.js';
import { makeCar, makeBoat, makePoliceCar, makeCoastGuard, spawnTraffic, updateTrafficCar, updateTrafficBoat, updatePoliceCar, updateCoastGuard, driveVehicle, moveVehicle, drawVehicles } from './vehicles.js';
import { makePeds, updatePeds, drawPeds, pedAt } from './peds.js';
import { MISSIONS, startMission, updateMission, updateEnemies, drawEnemies, drawMissionMarkers, missionTarget } from './missions.js';
import { drawHud, drawMenu, drawPause, drawBusted, drawWasted, drawStoryDone } from './hud.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { setupShot } from './shots.js';
import { clamp, dist, angleTo } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

window.addEventListener('error', (e) => {
  document.body.dataset.error = String(e.message || e.error || 'error');
  document.title = 'ERR: ' + String(e.message || 'error');
});

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

const game = {
  world: null,
  player: null,
  cars: [],
  boats: [],
  police: [], // cruisers + cutters that chase the player
  coastguard: [],
  enemies: [],
  peds: [],
  bullets: [],
  messages: [],
  time: 0,
  state: 'menu', // menu | play | pause | busted | wasted | storydone
  mission: null,
  missionIndex: 0,
  completedMissions: [],
  storyDone: false,
  hasSave: false,
  danger: null,
  cam: { x: 0, y: 0, w: 1280, h: 720 },
  input: null,
  audio: null,
  bustedFine: 0,
  saveGame,
  addMessage,
  addDanger,
  fireBullet,
  removeVehicle,
  spawnPolice,
  update,
};

function addMessage(text) {
  game.messages.push({ text, at: game.time });
  if (game.messages.length > 12) game.messages.shift();
  if (statusEl) statusEl.textContent = text;
}

function addDanger(x, y) {
  game.danger = { x, y, at: game.time };
}

function fireBullet(x, y, angle, fromPlayer) {
  game.bullets.push({ x, y, angle, fromPlayer, life: 0.9, speed: 620 });
}

function removeVehicle(v) {
  game.cars = game.cars.filter((c) => c.id !== v.id);
  game.boats = game.boats.filter((b) => b.id !== v.id);
  game.police = game.police.filter((c) => c.id !== v.id);
}

function spawnPolice(n) {
  const p = game.player;
  const w = game.world;
  for (let i = 0; i < n; i++) {
    if (p.inVehicle && p.inVehicle.kind === 'boat') {
      const cg = makeCoastGuard(w, clamp(p.x + 260, 60, 400), clamp(p.y + (i % 2 ? 200 : -200), 100, 2200));
      game.coastguard.push(cg);
      game.police.push(cg);
    } else {
      const rx = p.x + (i % 2 ? 420 : -420);
      const ry = p.y + (i % 3 ? 260 : -260);
      const pc = makePoliceCar(w, clamp(rx, 560, 3100), clamp(ry, 100, 2300));
      game.police.push(pc);
    }
  }
}

function saveGame() {
  writeSave(game);
}

function nearestVehicle(maxD) {
  const p = game.player;
  let best = null;
  let bestD = maxD;
  for (const v of [...game.cars, ...game.boats]) {
    if (v.police || v.target) continue;
    const d = dist(p.x, p.y, v.x, v.y);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

function enterVehicle(v) {
  const p = game.player;
  p.inVehicle = v;
  p.x = v.x; p.y = v.y;
  if (v.traffic) {
    addWanted(p, 1, game.audio);
    addMessage('You stole a ' + v.type.name.toLowerCase() + '! The owner called it in.');
  } else {
    addMessage('You took the ' + v.type.name.toLowerCase() + '.');
  }
  if (v.kind === 'boat') addMessage('On the water. Watch for the coast guard.');
  game.audio.setEngine(true, 0);
}

function exitVehicle() {
  const p = game.player;
  const v = p.inVehicle;
  if (!v) return;
  p.inVehicle = null;
  const side = v.angle + Math.PI / 2;
  p.x = v.x + Math.cos(side) * (v.wid / 2 + 14);
  p.y = v.y + Math.sin(side) * (v.wid / 2 + 14);
  if (collideBuildings(game.world, p.x, p.y, 12) || isWater(game.world, p.x, p.y)) {
    p.x = v.x - Math.cos(side) * (v.wid / 2 + 14);
    p.y = v.y - Math.sin(side) * (v.wid / 2 + 14);
  }
  game.audio.setEngine(false, 0);
}

function updateBullets(dt) {
  for (const b of game.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (collideBuildings(game.world, b.x, b.y, 2)) b.life = 0;
  }
  const p = game.player;
  for (const b of game.bullets) {
    if (b.life <= 0) continue;
    if (b.fromPlayer) {
      for (const e of game.enemies) {
        if (!e.down && dist(b.x, b.y, e.x, e.y) < 14) {
          e.hp -= 34;
          b.life = 0;
          if (e.hp <= 0) { e.down = true; e.downT = 999; addMessage('Guard down.'); }
          break;
        }
      }
      if (b.life > 0) {
        const ped = pedAt(game.peds, b.x, b.y, 6);
        if (ped) {
          ped.down = true; ped.downT = 5; ped.panic = 3;
          b.life = 0;
          addWanted(p, 1, game.audio);
          addMessage('You hit a bystander! The cops are coming.');
        }
      }
    } else {
      if (!p.inVehicle && p.invulnT <= 0 && dist(b.x, b.y, p.x, p.y) < 13) {
        p.hp -= 9;
        p.invulnT = 0.3;
        b.life = 0;
        if (p.hp <= 0) return 'wasted';
      } else if (p.inVehicle && dist(b.x, b.y, p.x, p.y) < 26) {
        p.inVehicle.hp -= 8;
        p.inVehicle.smoke = 1;
        b.life = 0;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
  return null;
}

function updateWanted(dt) {
  const p = game.player;
  if (p.wanted <= 0) {
    if (game.police.length) {
      game.police = game.police.filter((pc) => dist(pc.x, pc.y, p.x, p.y) < 900);
      if (!game.police.length) game.coastguard = [];
    }
    game.audio.setSiren(false);
    return;
  }
  game.maxWanted = Math.max(game.maxWanted || 0, p.wanted);
  const wantPolice = Math.min(p.wanted, 3);
  const cars = game.police.filter((pc) => pc.kind === 'car').length;
  const boats = game.police.filter((pc) => pc.kind === 'boat').length;
  const onWater = p.inVehicle && p.inVehicle.kind === 'boat';
  if (onWater) {
    if (boats < Math.min(p.wanted, 2)) spawnPolice(1);
  } else if (cars < wantPolice) {
    spawnPolice(wantPolice - cars);
  }
  game.audio.setSiren(true);
  // Cool off when no police can see the player for a while.
  const nearest = game.police.reduce((m, pc) => Math.min(m, dist(pc.x, pc.y, p.x, p.y)), Infinity);
  if (nearest > 520) {
    p.wantedT += dt;
    if (p.wantedT > 12) {
      p.wanted -= 1;
      p.wantedT = 0;
      addMessage(p.wanted > 0 ? 'Heat dying down… ' + p.wanted + ' stars left.' : 'You lost them. Clean — for now.');
      if (p.wanted === 0) game.audio.setSiren(false);
    }
  } else {
    p.wantedT = 0;
  }
}

function updateDriving(dt) {
  const p = game.player;
  const v = p.inVehicle;
  const onWater = v.kind === 'boat';
  driveVehicle(v, game.input, dt, onWater);
  const ok = moveVehicle(game.world, v, dt);
  if (!ok && Math.abs(v.speed) > 120) {
    game.audio.crash();
    v.hp -= 8;
    v.smoke = 1;
  }
  p.x = v.x; p.y = v.y;
  game.audio.setEngine(true, Math.abs(v.speed) / v.type.max);
  // Bump traffic.
  const others = v.kind === 'boat' ? game.boats : game.cars;
  for (const o of others) {
    if (o.id === v.id || o.police) continue;
    if (dist(v.x, v.y, o.x, o.y) < (v.len + o.len) / 2 - 6) {
      const push = angleTo(o.x, o.y, v.x, v.y);
      const rel = Math.abs(v.speed - o.speed);
      if (rel > 60) {
        game.audio.crash();
        v.hp -= 4; o.hp -= 4;
        if (o.traffic) addWanted(p, 1, game.audio);
      }
      v.x += Math.cos(push) * 6;
      v.y += Math.sin(push) * 6;
      o.x -= Math.cos(push) * 6;
      o.y -= Math.sin(push) * 6;
      const tmp = v.speed;
      v.speed = o.speed * 0.5;
      o.speed = tmp * 0.5;
    }
  }
  // Run over peds (the law notices).
  const ped = pedAt(game.peds, v.x, v.y, v.len / 2);
  if (ped && Math.abs(v.speed) > 40) {
    ped.down = true; ped.downT = 5; ped.panic = 3;
    addWanted(p, 1, game.audio);
    addMessage('You ran someone over! The cops are coming.');
    game.addDanger(v.x, v.y);
  }
  // Police ram: busted if they pin the car.
  for (const pc of game.police) {
    if (pc.kind !== 'car') continue;
    if (dist(pc.x, pc.y, v.x, v.y) < 40 && Math.abs(v.speed) < 25 && p.wanted > 0) {
      return 'busted';
    }
    if (dist(pc.x, pc.y, v.x, v.y) < 44 && Math.abs(v.speed) > 80) {
      v.hp -= 6;
      game.audio.crash();
    }
  }
  // Coast guard rams the boat.
  for (const cg of game.coastguard) {
    if (dist(cg.x, cg.y, v.x, v.y) < 46) {
      v.hp -= 6;
      game.audio.crash();
      if (Math.abs(v.speed) < 25 && p.wanted > 0) return 'busted';
    }
  }
  if (v.hp <= 0) {
    v.speed = 0;
    v.smoke = 1;
    addMessage('Your ' + v.type.name.toLowerCase() + ' is wrecked. Get out!');
  }
  return null;
}

function update(dt, silent) {
  game.time += dt;
  const p = game.player;
  const input = game.input;
  if (game.state !== 'play') return;
  // Enter / exit vehicle.
  if (input.wasPressed('KeyE')) {
    if (p.inVehicle) exitVehicle();
    else {
      const v = nearestVehicle(52);
      if (v) enterVehicle(v);
    }
  }
  if (p.inVehicle) {
    const result = updateDriving(dt);
    if (result === 'busted') return bustPlayer();
  } else {
    updatePlayerOnFoot(game, dt);
    game.audio.setEngine(false, 0);
    // Busted on foot: a cruiser touches Rico.
    for (const pc of game.police) {
      if (pc.kind === 'car' && p.wanted > 0 && dist(pc.x, pc.y, p.x, p.y) < 30) {
        return bustPlayer();
      }
    }
  }
  // Traffic + police.
  for (const c of game.cars) {
    if (c === p.inVehicle || c.police) continue;
    if (c.traffic) updateTrafficCar(game.world, game.cars, c, dt);
  }
  for (const b of game.boats) {
    if (b === p.inVehicle) continue;
    if (b.traffic) updateTrafficBoat(game.world, b, dt);
  }
  for (const pc of game.police) {
    if (pc.kind === 'car') updatePoliceCar(game.world, game.cars, pc, p.x, p.y, dt);
    else updateCoastGuard(game.world, pc, p.x, p.y, dt);
  }
  updatePeds(game.world, game.peds, dt, game.danger && game.time - game.danger.at < 1 ? game.danger : null);
  updateEnemies(game, dt);
  updateMission(game, dt);
  const dead = updateBullets(dt);
  if (dead === 'wasted') return wastePlayer();
  if (p.hp <= 0) return wastePlayer();
  updateWanted(dt);
  // Camera follows the player.
  const vw = game.cam.w;
  const vh = game.cam.h;
  game.cam.x = clamp(p.x - vw / 2, 0, WORLD_W - vw);
  game.cam.y = clamp(p.y - vh / 2, 0, WORLD_H - vh);
  // Mouse world position for aiming.
  const scale = canvas.width / canvas.clientWidth;
  input.mouse.worldX = game.cam.x + input.mouse.x * scale;
  input.mouse.worldY = game.cam.y + input.mouse.y * scale;
  if (!silent) input.endFrame();
}

function bustPlayer() {
  const p = game.player;
  const fine = Math.min(400, Math.floor(p.cash * 0.25));
  p.cash -= fine;
  game.bustedFine = fine;
  p.wanted = 0;
  game.police = [];
  game.coastguard = [];
  game.audio.setSiren(false);
  game.audio.setEngine(false, 0);
  game.audio.busted();
  if (p.inVehicle) { p.inVehicle.speed = 0; p.inVehicle = null; }
  p.x = 980; p.y = 800; // outside the precinct, near the clinic
  p.hp = Math.max(p.hp, 60);
  game.state = 'busted';
  saveGame();
}

function wastePlayer() {
  const p = game.player;
  p.cash = Math.max(0, p.cash - 150);
  p.hp = p.maxHp;
  p.wanted = 0;
  game.police = [];
  game.coastguard = [];
  game.audio.setSiren(false);
  game.audio.setEngine(false, 0);
  game.audio.wasted();
  if (p.inVehicle) { p.inVehicle.speed = 0; p.inVehicle = null; }
  p.x = 980; p.y = 800;
  game.state = 'wasted';
  saveGame();
}

function render() {
  const vw = canvas.width;
  const vh = canvas.height;
  ctx.clearRect(0, 0, vw, vh);
  if (game.state === 'menu') {
    drawMenu(ctx, game, vw, vh);
    return;
  }
  const cam = game.cam;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, game.world, cam, game.time);
  drawMissionMarkers(ctx, game, cam);
  drawPeds(ctx, game.peds, cam);
  drawVehicles(ctx, game.cars, game.time, cam);
  drawVehicles(ctx, game.boats, game.time, cam);
  drawEnemies(ctx, game.enemies, game.time);
  drawPlayer(ctx, game.player, game.time);
  // Bullets.
  ctx.fillStyle = '#ffe14d';
  for (const b of game.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Mouse crosshair.
  if (!game.player.inVehicle && game.state === 'play') {
    const mx = game.input.mouse.worldX;
    const my = game.input.mouse.worldY;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13);
    ctx.stroke();
  }
  ctx.restore();
  if (!game.hideHud) drawHud(ctx, game, vw, vh);
  if (game.state === 'pause') drawPause(ctx, vw, vh);
  if (game.state === 'busted') drawBusted(ctx, vw, vh, game.bustedFine);
  if (game.state === 'wasted') drawWasted(ctx, vw, vh);
  if (game.state === 'storydone') drawStoryDone(ctx, vw, vh);
}

function startPlay(fromSave) {
  game.state = 'play';
  game.audio.unlock();
  game.audio.startMusic();
  game.audio.startWaves();
  if (!game.mission && !game.storyDone && game.missionIndex < MISSIONS.length) {
    startMission(game, game.missionIndex);
  }
}

function init() {
  game.world = makeWorld();
  game.player = makePlayer(game.world);
  game.input = makeInput(canvas);
  game.audio = makeAudio();
  game.peds = makePeds(game.world, 46);
  spawnTraffic(game.world, game.cars, game.boats, 14, 5);
  // Parked vehicles, all on road shoulders: a sports car by the marina,
  // sedans in town, boats at the piers.
  const sports = makeCar(game.world, 586, 1620, -Math.PI / 2, { name: 'Sports', color: '#e74c3c', len: 48, wid: 22, top: 130, accel: 300, max: 420 });
  game.cars.push(sports);
  game.cars.push(makeCar(game.world, 973, 900, Math.PI / 2));
  game.cars.push(makeCar(game.world, 1373, 1560, -Math.PI / 2));
  game.cars.push(makeCar(game.world, 2173, 760, Math.PI / 2));
  game.boats.push(makeBoat(game.world, 460, 1513, 0, { name: 'Speedboat', color: '#e74c3c', len: 52, wid: 20, top: 120, accel: 260, max: 380 }));
  game.boats.push(makeBoat(game.world, 455, 1763, 0, { name: 'Fishing boat', color: '#f4ead2', len: 58, wid: 24, top: 75, accel: 150, max: 220 }));
  game.boats.push(makeBoat(game.world, 445, 2023, 0, { name: 'Jet ski', color: '#f39c12', len: 34, wid: 14, top: 110, accel: 280, max: 340 }));
  // Restore a save, if one exists.
  const save = loadSave();
  if (save) {
    game.hasSave = true;
    game.player.cash = save.cash;
    game.player.hasPistol = !!save.hasPistol;
    game.player.ammo = save.ammo || 0;
    game.missionIndex = save.missionIndex || 0;
    game.completedMissions = save.completed || [];
    game.maxWanted = save.maxWanted || 0;
    if (game.missionIndex >= MISSIONS.length) game.storyDone = true;
    game.player.x = save.px || game.player.x;
    game.player.y = save.py || game.player.y;
  }
  addMessage('Welcome to Marina Bay, Rico.');
  // Shot mode for screenshots: deterministic scenes, rendered once and
  // frozen — the live loop would drive the subject out of frame before the
  // screenshot lands.
  if (shotName) {
    setupShot(game, shotName);
    render();
    window.__gameReady = true;
  }
  // Global keys.
  window.addEventListener('keydown', (e) => {
    if (game.state === 'menu' && (e.code === 'Enter' || e.code === 'Space')) startPlay();
    else if (game.state === 'busted' && e.code === 'Enter') { game.state = 'play'; addMessage('Back on the streets. Stay clean, Rico.'); }
    else if (game.state === 'wasted' && e.code === 'Enter') { game.state = 'play'; }
    else if (game.state === 'storydone' && e.code === 'Enter') { game.state = 'play'; }
    else if (game.state === 'play' && (e.code === 'KeyP' || e.code === 'Escape')) game.state = 'pause';
    else if (game.state === 'pause' && (e.code === 'KeyP' || e.code === 'Escape')) game.state = 'play';
    else if (game.state === 'play' && e.code === 'KeyM') {
      const m = game.audio.toggleMute();
      addMessage(m ? 'Sound muted.' : 'Sound on.');
    } else if (game.state === 'play' && e.code === 'KeyH') {
      game.hideHud = !game.hideHud;
    } else if (game.state === 'play' && e.code === 'KeyN' && !game.mission && !game.storyDone) {
      startMission(game, game.missionIndex);
    } else if (game.state === 'storydone' && e.code === 'KeyR') {
      clearSave();
      game.completedMissions = [];
      game.missionIndex = 0;
      game.storyDone = false;
      game.player.cash = 250;
      startMission(game, 0);
      game.state = 'play';
    }
  });
  canvas.addEventListener('click', () => {
    if (game.state === 'menu') startPlay();
    else if (game.state === 'busted' || game.state === 'wasted' || game.state === 'storydone') game.state = 'play';
  });
  // Watch for the final mission completing to show the ending screen.
  const origAdd = addMessage;
  game._checkStory = () => {
    if (game.storyDone && game.state === 'play') game.state = 'storydone';
  };
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (game.state === 'play') {
      update(dt, false);
      game._checkStory();
    } else {
      game.time += dt;
      game.input.endFrame();
    }
    render();
    requestAnimationFrame(frame);
  }
  // In shot mode the frame is already rendered above; do not start the live
  // loop, or the subject drives out of frame before the screenshot lands.
  if (!shotName) requestAnimationFrame(frame);
}

init();
