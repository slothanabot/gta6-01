// main.js — Marina Bay: Smuggler's Run. Bootstrap, game loop, player + driving
// controllers, wanted system, mission flow, camera, combat wiring and menus.
import * as THREE from 'three';
import { buildCity, collideCircle } from './city.js';
import { buildPlayerCharacter, animateCharacter } from './character.js';
import { makeCar, createTraffic, updateTraffic, createPoliceCar, updatePoliceCar, CAR_TYPES } from './vehicles.js';
import { createPedestrians, updatePedestrians, spawnGang, spawnAlly, npcShoot, updateNpcMovement } from './pedestrians.js';
import { MISSIONS, createMissionMarker, updateMissionMarker, distanceTo } from './missions.js';
import { WEAPONS, buildWeaponMesh, createMuzzleFlash, triggerMuzzleFlash, updateMuzzleFlash, createTracer, fireTracer, updateTracer, resolveAttack } from './combat.js';
import { updateHud, drawMinimap, showBanner, showToast } from './hud.js';
import { createAudio } from './audio.js';
import { createInput, consumeClick } from './input.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { parseShot, shotSetup } from './shots.js';

const $ = (id) => document.getElementById(id);
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c5e8);
scene.fog = new THREE.Fog(0x9fd4ee, 220, 520);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 900);
camera.position.set(150, 8, -8);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a9a6a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 2.0);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
sun.shadow.camera.far = 500;
scene.add(sun);

function setLoad(pct, text) {
  $('loading-bar').style.setProperty('--load', pct + '%');
  if (text) $('loading-text').textContent = text;
}

setLoad(15, 'Building Marina Bay…');
const city = buildCity(scene);
const colliders = city.colliders;

setLoad(40, 'Parking cars, waking pedestrians…');
const traffic = createTraffic(scene, 14);
const peds = createPedestrians(scene, 26, colliders);
const policeCar = createPoliceCar(scene);

// Player
const playerRig = buildPlayerCharacter();
scene.add(playerRig.group);
const player = {
  x: 150, z: -20, y: 0, vy: 0, heading: Math.PI, speed: 0, phase: 0,
  health: 100, cash: 250, onGround: true, lastHurt: -99, inCar: false,
  car: null, weapon: 'fists', ammo: 0, reserve: 0, attackCd: 0, aiming: false,
  damageFlash: 0,
};
playerRig.group.position.set(player.x, 0, player.z);

// Parked stealable cars along the roads
const parkedCars = [];
{
  const spots = [
    [8, -40, 0.2], [-42, 108, -1.4], [58, -92, 2.8], [108, 42, 1.6],
    [-92, 8, 0.4], [42, -148, -0.3], [-8, 158, 1.2], [158, 92, -1.57],
  ];
  spots.forEach(([x, z, h], i) => {
    const type = CAR_TYPES[i % CAR_TYPES.length];
    const mesh = makeCar(type);
    mesh.position.set(x, 0, z); mesh.rotation.y = h;
    scene.add(mesh);
    parkedCars.push({ mesh, x, z, heading: h, type, speed: 0, stolen: false });
  });
}

// Weapon pickups: pistol at the docks, knife on the boardwalk
const pickups = [];
function addPickup(kind, x, z) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x2a3138 }));
  base.position.y = 0.12; g.add(base);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.2),
    new THREE.MeshBasicMaterial({ color: kind === 'pistol' ? 0x7dff9a : 0xffd23e, transparent: true, opacity: 0.25 }));
  glow.position.y = 0.6; g.add(glow);
  const icon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: kind === 'pistol' ? 0x22262c : 0xd8dde2 }));
  icon.position.y = 0.7; g.add(icon);
  g.position.set(x, 0, z);
  scene.add(g);
  pickups.push({ kind, x, z, mesh: g, icon, taken: false });
}
addPickup('pistol', -146, 168);
addPickup('knife', 152, -32);

const marker = createMissionMarker(scene);
const muzzle = createMuzzleFlash(scene);
const tracer = createTracer(scene);
let audio = null;

const input = createInput();

// ---- game state ----
const S = {
  mode: 'menu', // menu | playing | paused | dead
  missionIndex: 0,
  missionStage: 0,
  timerLeft: 0,
  wanted: 0,
  wantedTimer: 0,
  noCrimeTimer: 0,
  day: 1,
  minutes: 9 * 60 + 41,
  gang: [],
  ally: null,
  gangCleared: false,
  storyDone: false,
  bustedTimer: 0,
  camYaw: Math.PI,
  camPos: new THREE.Vector3(150, 8, -8),
  menuAngle: 0,
  elapsed: 0,
  shot: parseShot(),
  shotSetup: null,
  shotFired: false,
};
S.shotSetup = shotSetup(S.shot);

function currentMission() { return MISSIONS[Math.min(S.missionIndex, MISSIONS.length - 1)]; }
function currentTarget() {
  const m = currentMission();
  if (m.targets) return m.targets[Math.min(S.missionStage, m.targets.length - 1)];
  return m.target;
}
function missionTitle() {
  if (S.storyDone) return 'FREE ROAM — STORY COMPLETE';
  const m = currentMission();
  return `MISSION ${S.missionIndex + 1}/5 — ${m.title}`;
}

function setWeapon(kind) {
  player.weapon = kind;
  playerRig.weaponMount.clear();
  if (kind !== 'fists') {
    const mesh = buildWeaponMesh(kind);
    mesh.rotation.x = -Math.PI / 2 + 0.3;
    playerRig.weaponMount.add(mesh);
  }
  const w = WEAPONS[kind];
  if (kind === 'pistol' && player.ammo === 0 && player.reserve === 0) { player.ammo = w.ammo; player.reserve = w.reserve; }
}

function addWanted(n, reason) {
  if (n <= 0) return;
  S.wanted = Math.min(5, S.wanted + n);
  S.noCrimeTimer = 0;
  if (S.wanted >= 1 && audio) audio.startSiren();
  showToast(`WANTED +${n}★ — ${reason}`);
}

function startMission(i) {
  S.missionIndex = i;
  S.missionStage = 0;
  S.gangCleared = false;
  const m = currentMission();
  S.timerLeft = m.timer || 0;
  // clear old gang/ally
  for (const g of S.gang) { scene.remove(g.rig.group); }
  S.gang = [];
  if (S.ally) { scene.remove(S.ally.rig.group); S.ally = null; }
  if (m.wanted) { S.wanted = Math.max(S.wanted, m.wanted); if (audio) audio.startSiren(); }
  if (m.gang) {
    S.gang = spawnGang(scene, m.target.x, m.target.z, 4);
    showToast('Red Tide gang guarding the lighthouse — 4 armed men');
  }
  if (m.ally) {
    S.ally = spawnAlly(scene, player.x + 3, player.z + 3);
    showToast('Mara joined you — press G near her to hand her a pistol');
  }
  marker.position.copy(currentTarget());
  marker.visible = true;
  showBanner(m.title, m.briefing);
  updateObjectiveHud();
}

function updateObjectiveHud() {
  // handled each frame by updateHud via state below
}

function completeMission() {
  const m = currentMission();
  player.cash += m.cash;
  if (audio) { audio.cash(); audio.missionDone(); }
  showBanner('MISSION COMPLETE', `+$${m.cash} — ${m.title}`);
  showToast(`+$${m.cash}  •  ${m.title} done`);
  doSave();
  if (S.missionIndex >= MISSIONS.length - 1) {
    S.storyDone = true;
    marker.visible = false;
    showBanner('STORY COMPLETE', 'You ran the whole Bay. Marina Bay is yours — free roam!');
    return;
  }
  startMission(S.missionIndex + 1);
}

function failMission(reason) {
  showToast(reason + ' — mission restarted');
  if (audio) audio.busted();
  startMission(S.missionIndex);
}

function doSave() {
  saveGame({
    cash: player.cash, missionIndex: S.missionIndex, health: player.health,
    x: player.x, z: player.z, weapon: player.weapon, ammo: player.ammo, reserve: player.reserve,
  });
}

function damagePlayer(amount, source) {
  if (S.mode !== 'playing') return;
  player.health -= amount;
  player.lastHurt = S.elapsed;
  player.damageFlash = 1;
  if (audio) audio.hurt();
  if (player.health <= 0) {
    player.health = 0;
    die(source === 'police' ? 'busted' : 'wasted');
  }
}

function die(kind) {
  S.mode = 'dead';
  if (audio) audio.busted();
  $('dead-text').textContent = kind === 'busted'
    ? 'The harbor patrol caught you. Your cash takes a hit, but the crew still needs its courier.'
    : 'You got taken down in the streets of Marina Bay. The clinic patched you up — for a price.';
  $('dead-screen').classList.remove('hidden');
  $('hud').classList.add('hidden');
}

function respawn() {
  player.health = 100;
  player.cash = Math.max(0, player.cash - 50);
  S.wanted = 0;
  if (audio) audio.stopSiren();
  policeCar.active = false;
  player.x = 25; player.z = 25; player.y = 0; player.vy = 0;
  if (player.inCar) exitCar();
  playerRig.group.position.set(player.x, 0, player.z);
  $('dead-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  S.mode = 'playing';
  showToast('Back on your feet — the Bay is still yours');
}

// ---- driving ----
function enterCar(car) {
  player.inCar = true;
  player.car = car;
  playerRig.group.visible = false;
  car.stolen = true;
  if (!car.wasStolenCounted) {
    car.wasStolenCounted = true;
    addWanted(1, 'Grand theft auto');
    showToast(`Stole the ${car.type.name}!`);
  }
  if (audio) audio.setEngine(0, true);
  updateDriving._eLock = true; // don't let the same keypress exit instantly
}

function exitCar() {
  const car = player.car;
  player.inCar = false;
  player.car = null;
  playerRig.group.visible = true;
  player.x = car.x + Math.cos(car.heading) * 2.5;
  player.z = car.z - Math.sin(car.heading) * 2.5;
  player.heading = car.heading;
  playerRig.group.position.set(player.x, 0, player.z);
  if (audio) audio.setEngine(0, false);
  updateOnFoot._eLock = true; // don't let the same keypress re-enter instantly
}

function updateDriving(dt) {
  const car = player.car;
  const k = input.keys;
  const accel = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 0.7 : 0);
  const maxSpeed = car.type.speed;
  car.speed += accel * 14 * dt;
  car.speed *= Math.max(0, 1 - 0.9 * dt); // drag
  if (!accel) car.speed *= Math.max(0, 1 - 1.4 * dt);
  car.speed = Math.max(-10, Math.min(maxSpeed, car.speed));
  const steer = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);
  const steerAmt = steer * 1.5 * dt * Math.min(1, Math.abs(car.speed) / 8) * (car.speed >= 0 ? 1 : -1);
  car.heading += steerAmt;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // bounds + buildings
  car.x = Math.max(city.bounds.minX, Math.min(city.bounds.maxX, car.x));
  car.z = Math.max(city.bounds.minZ, Math.min(city.bounds.maxZ, car.z));
  const pos = new THREE.Vector3(car.x, 0, car.z);
  collideCircle(pos, 1.7, colliders);
  if (pos.x !== car.x || pos.z !== car.z) car.speed *= 0.4;
  car.x = pos.x; car.z = pos.z;
  // bump traffic
  for (const t of traffic) {
    const d = Math.hypot(t.x - car.x, t.z - car.z);
    if (d < 3.4 && d > 0.01) {
      car.speed *= 0.55;
      t.x += (t.x - car.x) / d * 0.4; t.z += (t.z - car.z) / d * 0.4;
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // keep the player (camera, HUD, minimap) glued to the car while driving
  player.x = car.x; player.z = car.z; player.heading = car.heading;
  // wheels
  const spin = (car.speed / 0.36) * dt;
  for (const w of car.mesh.userData.wheels) {
    w.pivot.children[0].rotation.x += spin;
    w.pivot.children[1].rotation.x += spin;
    if (w.front) w.pivot.rotation.y = steer * 0.38;
  }
  // police ramming
  if (policeCar.active) {
    const d = Math.hypot(policeCar.x - car.x, policeCar.z - car.z);
    if (d < 3.6) {
      damagePlayer(6 * dt * 10, 'police');
      car.speed *= 0.985;
    }
  }
  if (audio) audio.setEngine(Math.abs(car.speed) / maxSpeed, true);
  // exit car
  if (k.KeyE && !updateDriving._eLock) {
    updateDriving._eLock = true;
    exitCar();
  }
  if (!k.KeyE) updateDriving._eLock = false;
}

// ---- on foot ----
function updateOnFoot(dt) {
  const k = input.keys;
  // camera-relative movement
  let fx = 0, fz = 0;
  if (k.KeyW || k.ArrowUp) { fx += Math.sin(S.camYaw); fz += Math.cos(S.camYaw); }
  if (k.KeyS || k.ArrowDown) { fx -= Math.sin(S.camYaw); fz -= Math.cos(S.camYaw); }
  if (k.KeyA || k.ArrowLeft) { fx -= Math.cos(S.camYaw); fz += Math.sin(S.camYaw); }
  if (k.KeyD || k.ArrowRight) { fx += Math.cos(S.camYaw); fz -= Math.sin(S.camYaw); }
  const len = Math.hypot(fx, fz);
  const sprint = k.ShiftLeft || k.ShiftRight;
  const targetSpeed = len > 0 ? (sprint ? 7.2 : 4.2) : 0;
  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 10);
  if (len > 0) {
    fx /= len; fz /= len;
    const targetHeading = Math.atan2(fx, fz);
    let dh = targetHeading - player.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    player.heading += Math.max(-8 * dt, Math.min(8 * dt, dh));
    player.x += fx * player.speed * dt;
    player.z += fz * player.speed * dt;
    player.phase += dt * player.speed * 2.1;
  }
  // jump
  if (k.Space && player.onGround) { player.vy = 7; player.onGround = false; }
  player.vy -= 22 * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) { player.y = 0; player.vy = 0; player.onGround = true; }
  // bounds + buildings
  player.x = Math.max(city.bounds.minX, Math.min(city.bounds.maxX, player.x));
  player.z = Math.max(city.bounds.minZ, Math.min(city.bounds.maxZ, player.z));
  const pos = new THREE.Vector3(player.x, 0, player.z);
  collideCircle(pos, 0.55, colliders);
  player.x = pos.x; player.z = pos.z;
  playerRig.group.position.set(player.x, player.y, player.z);
  playerRig.group.rotation.y = player.heading;
  animateCharacter(playerRig, player.phase, player.speed, dt);

  // interact: pickups, cars, ally arming
  let interactText = null;
  let nearestCar = null, nearestCarD = 4.5;
  for (const c of parkedCars) {
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < nearestCarD) { nearestCar = c; nearestCarD = d; }
  }
  let nearestPickup = null;
  for (const p of pickups) {
    if (p.taken) continue;
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (d < 3) nearestPickup = p;
  }
  const allyNear = S.ally && S.ally.alive && !S.ally.armed &&
    Math.hypot(S.ally.x - player.x, S.ally.z - player.z) < 3.5;
  if (nearestPickup) interactText = `pick up the ${nearestPickup.kind.toUpperCase()}`;
  else if (allyNear) interactText = 'hand Mara a pistol (G)';
  else if (nearestCar) interactText = `drive the ${nearestCar.type.name}`;
  S.interactText = interactText;
  if (k.KeyE && !updateOnFoot._eLock) {
    updateOnFoot._eLock = true;
    if (nearestPickup) {
      nearestPickup.taken = true;
      scene.remove(nearestPickup.mesh);
      setWeapon(nearestPickup.kind);
      if (audio) audio.pickup();
      showToast(`Picked up the ${nearestPickup.kind}! Press ${nearestPickup.kind === 'pistol' ? '2' : '1'} to use it`);
    } else if (nearestCar) {
      enterCar(nearestCar);
    }
  }
  if (!k.KeyE) updateOnFoot._eLock = false;
  if (k.KeyG && allyNear && !updateOnFoot._gLock) {
    updateOnFoot._gLock = true;
    S.ally.armed = true;
    const gun = buildWeaponMesh('pistol');
    gun.rotation.x = -Math.PI / 2 + 0.3;
    S.ally.rig.weaponMount.add(gun);
    S.ally.hasGun = true;
    if (audio) audio.pickup();
    showToast('Mara is armed — she will cover you!');
  }
  if (!k.KeyG) updateOnFoot._gLock = false;

  // weapon switching
  if (k.Digit1) setWeapon('knife');
  if (k.Digit2 && (player.ammo > 0 || player.reserve > 0)) setWeapon('pistol');
  if (k.KeyR && player.weapon === 'pistol' && player.reserve > 0 && player.ammo < WEAPONS.pistol.ammo) {
    const need = WEAPONS.pistol.ammo - player.ammo;
    const take = Math.min(need, player.reserve);
    player.ammo += take; player.reserve -= take;
    if (audio) audio.pickup();
  }
  // attack
  player.attackCd -= dt;
  const wantAttack = input.mouseDown || consumeClick(input);
  if (wantAttack && player.attackCd <= 0) {
    const w = WEAPONS[player.weapon];
    player.attackCd = w.cooldown;
    player.aiming = true;
    const dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    const origin = new THREE.Vector3(player.x, 1.4, player.z);
    const targets = [...S.gang, ...peds];
    const { hit, hitPoint } = resolveAttack(origin, dir, w, targets);
    if (player.weapon === 'pistol') {
      if (player.ammo <= 0) {
        showToast('Out of ammo — press R to reload');
      } else {
        player.ammo--;
        const muzzlePos = new THREE.Vector3(player.x + dir.x * 0.8, 1.5, player.z + dir.z * 0.8);
        triggerMuzzleFlash(muzzle, muzzlePos);
        fireTracer(tracer, muzzlePos, hitPoint);
        if (audio) audio.gunshot();
        if (hit) {
          hit.health -= w.damage;
          if (hit.health <= 0 && hit.alive) {
            hit.alive = false;
            hit.rig.group.visible = false;
            if (hit.kind === 'gang') { addWanted(0); showToast('Gang member down'); }
            else { addWanted(1, 'Assault'); }
          }
        } else {
          // missed shot in public still draws a little heat if police near
          if (Math.random() < 0.25) addWanted(1, 'Shots fired');
        }
      }
    } else {
      if (audio) audio.knifeSwing();
      if (hit) {
        hit.health -= w.damage;
        if (hit.health <= 0 && hit.alive) {
          hit.alive = false;
          hit.rig.group.visible = false;
          if (hit.kind === 'ped') addWanted(1, 'Assault');
        }
      }
    }
  } else if (!input.mouseDown) player.aiming = false;
  if (audio) audio.setEngine(0, false);
}

// ---- wanted / police ----
function updateWanted(dt) {
  S.noCrimeTimer += dt;
  if (S.wanted > 0 && S.noCrimeTimer > 18) {
    S.wantedTimer += dt;
    if (S.wantedTimer > 12) {
      S.wantedTimer = 0;
      S.wanted--;
      showToast(`Heat dying down… ${S.wanted}★ left`);
      if (S.wanted === 0 && audio) audio.stopSiren();
    }
  } else S.wantedTimer = 0;
  const shouldChase = S.wanted >= 1 && S.mode === 'playing';
  if (shouldChase && !policeCar.active) {
    policeCar.active = true;
    const a = Math.random() * Math.PI * 2;
    // spawn on land inside the city, never on the bay/ocean
    policeCar.x = Math.max(-190, Math.min(190, player.x + Math.sin(a) * 55));
    policeCar.z = Math.max(-190, Math.min(190, player.z + Math.cos(a) * 55));
    policeCar.heading = Math.atan2(player.x - policeCar.x, player.z - policeCar.z);
  }
  if (!shouldChase && policeCar.active) policeCar.active = false;
  if (policeCar.active) {
    const target = player.inCar && player.car ? player.car : player;
    updatePoliceCar(policeCar, target, dt, colliders);
    // busted: police car sits on the player
    const d = Math.hypot(policeCar.x - player.x, policeCar.z - player.z);
    if (d < 3.2 && !player.inCar) {
      S.bustedTimer += dt;
      if (S.bustedTimer > 2.5) { S.bustedTimer = 0; die('busted'); }
    } else S.bustedTimer = 0;
  }
}

// ---- missions ----
function updateMissions(dt) {
  if (S.storyDone || S.mode !== 'playing') return;
  const m = currentMission();
  const target = currentTarget();
  const d = distanceTo(player, target);
  if (m.timer) {
    S.timerLeft -= dt;
    if (S.timerLeft <= 0) { failMission('Out of time'); return; }
  }
  if (m.id === 'm5') {
    if (d < 4) {
      if (S.missionStage < m.targets.length - 1) {
        S.missionStage++;
        player.cash += 150;
        showToast(`Drop ${S.missionStage} done — +$150, next drop marked`);
        if (audio) audio.cash();
        marker.position.copy(currentTarget());
        marker.visible = true;
      } else completeMission();
    }
    return;
  }
  if (m.id === 'm4') {
    const alive = S.gang.filter(g => g.alive).length;
    if (alive === 0 && !S.gangCleared) {
      S.gangCleared = true;
      showToast('Lighthouse clear — make the drop!');
      if (audio) audio.missionDone();
    }
    if (d < 4 && S.gangCleared) completeMission();
    return;
  }
  if (m.id === 'm3') {
    if (d < 4) {
      if (S.wanted === 0) completeMission();
      else if (S.elapsed - (S._m3toast || 0) > 3) {
        S._m3toast = S.elapsed;
        showToast('Too hot! Lose the wanted level first — stay out of sight');
      }
    }
    return;
  }
  if (d < 4) completeMission();
}

// ---- camera ----
function updateCamera(dt) {
  if (S.mode === 'menu') {
    S.menuAngle += dt * 0.25;
    const px = player.x, pz = player.z;
    const r = 3.1;
    const cx = px + Math.sin(S.menuAngle) * r;
    const cz = pz + Math.cos(S.menuAngle) * r;
    camera.position.lerp(new THREE.Vector3(cx, 1.9, cz), Math.min(1, dt * 3));
    camera.lookAt(px, 1.45, pz);
    camera.up.set(0, 1, 0);
    return;
  }
  const heading = player.inCar && player.car ? player.car.heading : player.heading;
  // mouse orbit nudges the yaw; camera yaw eases toward the heading
  S.camYaw += input.orbitDX * 0.004;
  input.orbitDX *= 0.9;
  let dh = heading - S.camYaw;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  S.camYaw += dh * Math.min(1, dt * 2.2);
  const dist = player.inCar ? 13.5 : 8.5;
  const height = player.inCar ? 6.2 : 4.4;
  const back = new THREE.Vector3(-Math.sin(S.camYaw), 0, -Math.cos(S.camYaw));
  const side = new THREE.Vector3(Math.cos(S.camYaw), 0, -Math.sin(S.camYaw));
  const target = new THREE.Vector3(
    player.x + back.x * dist + side.x * 2.2,
    height,
    player.z + back.z * dist + side.z * 2.2);
  camera.position.lerp(target, Math.min(1, dt * 5));
  const look = new THREE.Vector3(
    player.x + Math.sin(S.camYaw) * 3, 1.6, player.z + Math.cos(S.camYaw) * 3);
  camera.lookAt(look);
  camera.up.set(0, 1, 0); // never roll the camera
}

// ---- HUD state ----
function hudState() {
  const m = currentMission();
  const target = S.storyDone ? null : currentTarget();
  const d = target ? distanceTo(player, target) : 0;
  let hint = '';
  if (!S.storyDone) {
    if (m.id === 'm2') hint = `TIME ${Math.max(0, Math.ceil(S.timerLeft))}s`;
    if (m.id === 'm5') hint = `DROP ${S.missionStage + 1}/3 • TIME ${Math.max(0, Math.ceil(S.timerLeft))}s`;
    if (m.id === 'm3' && S.wanted > 0) hint = 'LOSE THE HEAT';
  }
  return {
    cash: player.cash, health: player.health, wanted: S.wanted,
    day: S.day, clock: clockString(),
    missionTitle: missionTitle(),
    objectiveText: S.storyDone ? 'Free roam — explore Marina Bay, steal cars, dodge the patrol.' : m.objective,
    objectiveDist: target ? d : 0, objectiveHint: hint,
    weapon: WEAPONS[player.weapon], ammo: player.ammo, reserve: player.reserve,
    inCar: player.inCar, speed: player.inCar && player.car ? player.car.speed : 0,
    aiming: player.aiming, interactText: S.interactText || null,
    damageFlash: player.damageFlash,
    player: { x: player.x, z: player.z, heading: player.inCar && player.car ? player.car.heading : player.heading },
    missionTarget: target,
    traffic, police: [policeCar],
  };
}

function clockString() {
  S.minutes += 0; // advanced in tick
  const h = Math.floor(S.minutes / 60) % 24;
  const mm = Math.floor(S.minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ---- main loop ----
const clock = new THREE.Clock();
let frames = 0;
let beamMesh = null;
scene.traverse((o) => { if (o.userData && o.userData.isBeam) beamMesh = o; });
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  S.elapsed += dt;
  S.minutes += dt * 0.5;

  // ocean waves + lighthouse beam
  const posAttr = city.ocean.geometry.attributes.position;
  const base = city.ocean.userData.base;
  for (let i = 0; i < posAttr.count; i++) {
    const bx = base[i * 3], by = base[i * 3 + 1];
    posAttr.array[i * 3 + 2] = Math.sin(bx * 0.12 + S.elapsed * 1.4) * 0.35 + Math.cos(by * 0.1 + S.elapsed) * 0.3;
  }
  posAttr.needsUpdate = true;
  city.ocean.geometry.computeVertexNormals();
  if (beamMesh) beamMesh.rotation.y = S.elapsed * 0.4;

  if (S.mode === 'playing') {
    // screenshot mode: hold W in the drive shot so the chase is moving
    if (S.shot === 'drive') input.keys.KeyW = true;
    player.damageFlash = Math.max(0, player.damageFlash - dt * 2);
    if (player.inCar) updateDriving(dt);
    else updateOnFoot(dt);
    updateTraffic(traffic, dt, colliders);
    updatePedestrians(peds, dt, colliders, player);
    // gang + ally AI
    for (const g of S.gang) {
      if (!g.alive) continue;
      npcShoot(g, player, dt, (npc, tp, dist) => {
        if (Math.random() < 0.55) damagePlayer(6 + Math.random() * 7, 'gang');
        if (audio) audio.gunshot();
      });
    }
    if (S.ally && S.ally.alive) {
      updateNpcMovement(S.ally, dt, colliders, player);
      if (S.ally.armed) {
        const nearest = S.gang.find(g => g.alive);
        if (nearest) npcShoot(S.ally, nearest, dt, (npc, tp, dist) => {
          if (Math.random() < 0.7) {
            nearest.health -= 20;
            if (nearest.health <= 0) { nearest.alive = false; nearest.rig.group.visible = false; }
          }
          if (audio) audio.gunshot();
        });
      }
    }
    updateWanted(dt);
    updateMissions(dt);
    // health regen
    if (S.elapsed - player.lastHurt > 6 && player.health > 0 && player.health < 100) {
      player.health = Math.min(100, player.health + 2.5 * dt);
    }
    updateMuzzleFlash(muzzle, dt);
    updateTracer(tracer, dt);
    updateHud(hudState());
    drawMinimap(hudState());
    // pause
    if (input.keys.KeyP && !tick._pLock) {
      tick._pLock = true;
      pauseGame();
    }
    if (!input.keys.KeyP) tick._pLock = false;
  } else if (S.mode === 'menu') {
    // idle showcase: Dario stands on the boardwalk, face to camera
    player.phase += dt * 1.2;
    animateCharacter(playerRig, player.phase, 0, dt);
    playerRig.group.rotation.y = S.menuAngle; // face the orbiting camera
    updateTraffic(traffic, dt, colliders);
    updatePedestrians(peds, dt, colliders, player);
  }
  updateCamera(dt);
  updateMissionMarker(marker, S.elapsed);
  renderer.render(scene, camera);
  frames++;
  if (frames === 3) {
    // first frames presented — signal readiness for screenshots
    window.__ready = true;
    if (S.shotSetup && S.shotSetup.autoStart) {
      // combat shot: fire a shot shortly before the screenshot is taken
      // (the camera has settled by then) so the flash and tracer show
      if (S.shot === 'combat') {
        setTimeout(() => {
          if (S.mode !== 'playing') return;
          const dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
          const origin = new THREE.Vector3(player.x, 1.4, player.z);
          const { hitPoint } = resolveAttack(origin, dir, WEAPONS.pistol, S.gang);
          triggerMuzzleFlash(muzzle, new THREE.Vector3(player.x + dir.x * 0.8, 1.5, player.z + dir.z * 0.8));
          fireTracer(tracer, new THREE.Vector3(player.x + dir.x * 0.8, 1.5, player.z + dir.z * 0.8), hitPoint);
          if (audio) audio.gunshot();
          S.shotFired = true;
        }, 2400);
      }
    }
  }
}

function pauseGame() {
  S.mode = 'paused';
  $('pause-stats').textContent = `Cash $${Math.floor(player.cash)} • Mission ${S.missionIndex + 1}/5 — ${currentMission().title} • Wanted ${S.wanted}★ • Health ${Math.round(player.health)}`;
  $('pause-screen').classList.remove('hidden');
}

function resumeGame() {
  S.mode = 'playing';
  $('pause-screen').classList.add('hidden');
}

function startGame(fromSave) {
  if (!audio) {
    audio = createAudio();
    audio.resume();
    audio.startAmbience();
  } else audio.resume();
  $('start-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  S.mode = 'playing';
  if (fromSave) {
    const sv = loadGame();
    if (sv) {
      player.cash = sv.cash; player.health = sv.health ?? 100;
      player.x = sv.x ?? 25; player.z = sv.z ?? 25;
      if (sv.weapon) { setWeapon(sv.weapon); player.ammo = sv.ammo ?? 0; player.reserve = sv.reserve ?? 0; }
      playerRig.group.position.set(player.x, 0, player.z);
      startMission(Math.min(sv.missionIndex ?? 0, MISSIONS.length - 1));
      showToast('Save loaded — welcome back to Marina Bay');
      return;
    }
  }
  // fresh story: Dario starts at the plaza
  player.x = 25; player.z = 25; player.heading = Math.PI * 0.75;
  playerRig.group.position.set(player.x, 0, player.z);
  S.camYaw = player.heading;
  startMission(0);
}

// ---- menu buttons ----
$('btn-start').addEventListener('click', () => startGame(false));
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});
$('btn-resume').addEventListener('click', resumeGame);
$('btn-save').addEventListener('click', () => { doSave(); showToast('Game saved'); });
$('btn-restart').addEventListener('click', () => {
  clearSave();
  $('pause-screen').classList.add('hidden');
  player.cash = 250; player.health = 100; S.wanted = 0; S.storyDone = false;
  startMission(0);
  S.mode = 'playing';
});
$('btn-quit-menu').addEventListener('click', () => {
  $('pause-screen').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('start-screen').classList.remove('hidden');
  S.mode = 'menu';
  player.x = 150; player.z = -20; player.heading = Math.PI;
  playerRig.group.position.set(player.x, 0, player.z);
  playerRig.group.visible = true;
  if (player.inCar) { player.inCar = false; player.car = null; }
});
$('btn-respawn').addEventListener('click', respawn);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && audio) { const m = audio.toggleMute(); showToast(m ? 'Sound muted' : 'Sound on'); }
  if (e.code === 'Escape' && S.mode === 'playing') pauseGame();
  else if (e.code === 'Escape' && S.mode === 'paused') resumeGame();
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- boot ----
setLoad(70, 'Waking up Dario…');
{
  const sv = loadGame();
  if (sv) {
    $('btn-continue').classList.remove('hidden');
    $('continue-label').textContent = `DAY 1 • $${Math.floor(sv.cash)} • MISSION ${(sv.missionIndex ?? 0) + 1}/5`;
  }
}
// menu showcase: Dario on the boardwalk, face toward the starting camera
player.x = 150; player.z = -20; player.heading = Math.PI;
playerRig.group.position.set(player.x, 0, player.z);
S.camYaw = Math.PI;
setLoad(100, 'Ready — welcome to Marina Bay');
setTimeout(() => { $('loading').style.visibility = 'hidden'; }, 600);

// Screenshot-mode staging (applied after boot, before first frames matter)
if (S.shotSetup && S.shotSetup.autoStart) {
  const st = S.shotSetup;
  audio = createAudio();
  // audio context may stay suspended without a gesture; harmless for shots
  try { audio.startAmbience(); } catch { /* headless: no gesture yet */ }
  $('start-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  S.mode = 'playing';
  player.cash = st.cash ?? 250;
  if (st.playerPos) {
    player.x = st.playerPos.x; player.z = st.playerPos.z;
    player.heading = st.playerHeading ?? 0;
    playerRig.group.position.set(player.x, 0, player.z);
    S.camYaw = player.heading;
  }
  if (st.weapon) setWeapon(st.weapon);
  if (st.missionIndex != null) startMission(st.missionIndex);
  if (st.gang) { /* spawned by startMission(3) */ }
  if (st.ally && S.ally) { S.ally.armed = !!st.allyArmed; if (st.allyArmed) { const gun = buildWeaponMesh('pistol'); gun.rotation.x = -Math.PI / 2 + 0.3; S.ally.rig.weaponMount.add(gun); S.ally.hasGun = true; } }
  if (st.wanted != null) { S.wanted = st.wanted; if (st.wanted > 0 && audio) { try { audio.startSiren(); } catch { /* ignore */ } } }
  if (st.police && st.policePos) {
    policeCar.active = true;
    policeCar.x = st.policePos.x; policeCar.z = st.policePos.z;
    policeCar.heading = 0;
  }
  if (st.inCar && st.carPos) {
    const car = parkedCars[1];
    car.x = st.carPos.x; car.z = st.carPos.z; car.heading = st.carHeading ?? 0; car.speed = st.speed ?? 20;
    car.mesh.position.set(car.x, 0, car.z);
    enterCar(car);
    player.car.speed = st.speed ?? 20;
  }
  if (st.missionTarget) {
    marker.position.set(st.missionTarget.x, st.missionTarget.y, st.missionTarget.z);
    marker.visible = true;
  }
}

tick();
window.__game = { S, player, startGame, camera, scene, parkedCars, policeCar };
