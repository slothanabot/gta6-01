// combat.js — weapons: fists, knife (melee) and pistol (ranged, ammo, muzzle flash).
// Weapon meshes mount in the character's hand; shooting raycasts against NPCs.
import * as THREE from 'three';

export const WEAPONS = {
  fists: { name: 'FISTS', icon: '🥊', range: 2.2, damage: 12, cooldown: 0.45, ammo: Infinity },
  knife: { name: 'KNIFE', icon: '🔪', range: 2.6, damage: 34, cooldown: 0.5, ammo: Infinity },
  pistol: { name: 'PISTOL', icon: '🔫', range: 38, damage: 34, cooldown: 0.28, ammo: 12, reserve: 48 },
};

export function buildWeaponMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'knife') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.12),
      new THREE.MeshLambertMaterial({ color: 0xd8dde2 }));
    blade.position.y = 0.3; g.add(blade);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x4a2a10 }));
    handle.position.y = 0.02; g.add(handle);
  } else if (kind === 'pistol') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x22262c }));
    body.position.set(0, 0.05, 0.12); g.add(body);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
    grip.position.set(0, -0.08, -0.06); grip.rotation.x = 0.25; g.add(grip);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8),
      new THREE.MeshLambertMaterial({ color: 0x111418 }));
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.06, 0.36); g.add(barrel);
  }
  return g;
}

// Muzzle flash: a quick point light + sprite at the barrel tip.
export function createMuzzleFlash(scene) {
  const light = new THREE.PointLight(0xffc860, 0, 14, 1.8);
  scene.add(light);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
  scene.add(flash);
  return { light, flash, t: 0 };
}

export function triggerMuzzleFlash(mf, pos) {
  mf.light.position.copy(pos);
  mf.flash.position.copy(pos);
  mf.light.intensity = 26;
  mf.flash.material.opacity = 0.95;
  mf.t = 0.07;
}

export function updateMuzzleFlash(mf, dt) {
  if (mf.t > 0) {
    mf.t -= dt;
    if (mf.t <= 0) { mf.light.intensity = 0; mf.flash.material.opacity = 0; }
  }
}

// Tracer line from muzzle to hit point, fades fast.
export function createTracer(scene) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
  scene.add(line);
  return { line, t: 0 };
}

export function fireTracer(tr, from, to) {
  tr.line.geometry.setFromPoints([from, to]);
  tr.line.material.opacity = 0.9;
  tr.t = 0.09;
}

export function updateTracer(tr, dt) {
  if (tr.t > 0) {
    tr.t -= dt;
    if (tr.t <= 0) tr.line.material.opacity = 0;
  }
}

// Melee / shot resolution against a list of NPC targets.
// Returns the target hit (if any) and the hit point.
export function resolveAttack(origin, dir, weapon, targets) {
  let best = null, bestD = weapon.range;
  const to = new THREE.Vector3();
  for (const t of targets) {
    if (!t.alive) continue;
    to.set(t.x - origin.x, 0, t.z - origin.z);
    const d = to.length();
    if (d > weapon.range || d < 0.3) continue;
    to.normalize();
    const dot = to.x * dir.x + to.z * dir.z;
    const need = weapon.name === 'PISTOL' ? 0.86 : 0.45;
    if (dot < need) continue;
    if (d < bestD) { best = t; bestD = d; }
  }
  const hitPoint = best
    ? new THREE.Vector3(best.x, 1.2, best.z)
    : new THREE.Vector3(origin.x + dir.x * weapon.range, 1.2, origin.z + dir.z * weapon.range);
  return { hit: best, dist: bestD, hitPoint };
}
