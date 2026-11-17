// pedestrians.js — sidewalk walkers, gang shooters and the ally Mara.
// Pedestrians wander the sidewalks; gang members guard drop points and shoot;
// Mara can be armed by the player and fights alongside.
import * as THREE from 'three';
import { buildNpcCharacter, animateCharacter } from './character.js';
import { collideCircle } from './city.js';

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHIRTS = [0xff9a5c, 0x7fd4ff, 0xffd23e, 0xff7d9c, 0x8dff7a, 0xc9b8ff, 0xffffff, 0x2e4a6b];
const SKINS = [0xe8b184, 0xd9a077, 0xc98d64, 0xf2c69b, 0xb57e52];

export function createPedestrians(scene, count, colliders) {
  const rnd = mulberry(4242);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const rig = buildNpcCharacter({
      shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)],
      skinColor: SKINS[Math.floor(rnd() * SKINS.length)],
      pants: [0x3a3a4a, 0x6b4a2a, 0x2e4a6b, 0x888888][Math.floor(rnd() * 4)],
      hairColor: [0x1a1a1a, 0x4a2a10, 0x888888, 0xd8b25a][Math.floor(rnd() * 4)],
    });
    // start on a sidewalk near a road
    const road = [-150, -100, -50, 0, 50, 100, 150][Math.floor(rnd() * 7)];
    const x = road + (rnd() > 0.5 ? 8.5 : -8.5);
    const z = -175 + rnd() * 350;
    rig.group.position.set(x, 0, z);
    scene.add(rig.group);
    peds.push({
      rig, x, z, heading: rnd() * Math.PI * 2, speed: 1.2 + rnd() * 1.2,
      phase: rnd() * 6, targetX: x, targetZ: z, retarget: 0, alive: true, kind: 'ped',
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, colliders, playerPos) {
  for (const p of peds) {
    if (!p.alive) continue;
    p.retarget -= dt;
    if (p.retarget <= 0 || Math.hypot(p.targetX - p.x, p.targetZ - p.z) < 1) {
      // pick a new sidewalk waypoint
      const road = [-150, -100, -50, 0, 50, 100, 150][Math.floor(Math.random() * 7)];
      p.targetX = road + (Math.random() > 0.5 ? 8.5 : -8.5);
      p.targetZ = Math.max(-190, Math.min(190, p.z + (Math.random() - 0.5) * 80));
      p.retarget = 6 + Math.random() * 8;
    }
    const dx = p.targetX - p.x, dz = p.targetZ - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.2) {
      const th = Math.atan2(dx, dz);
      let dh = th - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += Math.max(-2 * dt, Math.min(2 * dt, dh));
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      p.phase += dt * p.speed * 2.2;
    }
    const pos = new THREE.Vector3(p.x, 0, p.z);
    collideCircle(pos, 0.5, colliders);
    p.x = pos.x; p.z = pos.z;
    p.rig.group.position.set(p.x, 0, p.z);
    p.rig.group.rotation.y = p.heading;
    animateCharacter(p.rig, p.phase, p.speed, dt);
  }
}

// Gang member: stands guard, shoots at the player when close, can be shot down.
export function spawnGang(scene, x, z, count = 3) {
  const gang = [];
  const rnd = mulberry(Math.floor(x * 10 + z));
  for (let i = 0; i < count; i++) {
    const rig = buildNpcCharacter({
      shirt: 0x8a1f1f, pants: 0x1c1c22, skinColor: SKINS[i % SKINS.length], gang: true,
      hairColor: 0x1a1a1a,
    });
    const gx = x + (rnd() - 0.5) * 8, gz = z + (rnd() - 0.5) * 8;
    rig.group.position.set(gx, 0, gz);
    scene.add(rig.group);
    gang.push({
      rig, x: gx, z: gz, heading: rnd() * Math.PI * 2, speed: 2.4, phase: 0,
      health: 60, alive: true, kind: 'gang', shootCd: 1 + rnd(), hasGun: true,
    });
  }
  return gang;
}

export function spawnAlly(scene, x, z) {
  const rig = buildNpcCharacter({
    shirt: 0x2fa8a0, pants: 0x2e4a6b, skinColor: 0xf2c69b, hairColor: 0x6b2a10,
  });
  rig.group.position.set(x, 0, z);
  scene.add(rig.group);
  return {
    rig, x, z, heading: 0, speed: 3.2, phase: 0, health: 100, alive: true,
    kind: 'ally', name: 'Mara', armed: false, shootCd: 0, follow: true,
  };
}

// Simple shooter AI shared by gang + ally: face target, fire on cooldown.
export function npcShoot(npc, targetPos, dt, onShot) {
  if (!npc.alive || !npc.hasGun && npc.kind !== 'ally') return;
  if (npc.kind === 'ally' && !npc.armed) return;
  const dx = targetPos.x - npc.x, dz = targetPos.z - npc.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 34) return;
  npc.heading = Math.atan2(dx, dz);
  npc.rig.group.rotation.y = npc.heading;
  npc.shootCd -= dt;
  if (npc.shootCd <= 0) {
    npc.shootCd = 0.9 + Math.random() * 0.7;
    onShot(npc, targetPos, dist);
  }
}

export function updateNpcMovement(npc, dt, colliders, followPos) {
  if (!npc.alive) return;
  if (followPos) {
    const dx = followPos.x - npc.x, dz = followPos.z - npc.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 4) {
      const th = Math.atan2(dx, dz);
      let dh = th - npc.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      npc.heading += Math.max(-2.5 * dt, Math.min(2.5 * dt, dh));
      npc.x += Math.sin(npc.heading) * npc.speed * dt;
      npc.z += Math.cos(npc.heading) * npc.speed * dt;
      npc.phase += dt * npc.speed * 2.2;
    }
  }
  const pos = new THREE.Vector3(npc.x, 0, npc.z);
  collideCircle(pos, 0.5, colliders);
  npc.x = pos.x; npc.z = pos.z;
  npc.rig.group.position.set(npc.x, 0, npc.z);
  npc.rig.group.rotation.y = npc.heading;
  animateCharacter(npc.rig, npc.phase, npc.speed, dt);
}
