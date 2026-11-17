// vehicles.js — detailed cars (body, cabin, glass, turning wheels, glowing lights),
// traffic that loops the road grid, and harbor-patrol police cars that chase.
import * as THREE from 'three';
import { collideCircle } from './city.js';

export const CAR_TYPES = [
  { name: 'Sunset Coupe', color: 0xff5a4e, speed: 26, len: 4.4 },
  { name: 'Palm Sedan', color: 0x3d7fc9, speed: 22, len: 4.6 },
  { name: 'Coral Convertible', color: 0xffd23e, speed: 28, len: 4.3 },
  { name: 'Harbor Van', color: 0xe8e8e8, speed: 18, len: 5.2 },
  { name: 'Bay Pickup', color: 0x4fc97a, speed: 23, len: 4.9 },
  { name: 'Tide Taxi', color: 0xffc93e, speed: 21, len: 4.5 },
];

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCar(type, opts = {}) {
  const g = new THREE.Group();
  g.name = type.name;
  const len = type.len, wid = 1.9;
  const paint = new THREE.MeshLambertMaterial({ color: opts.color ?? type.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const chrome = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 });
  const tire = new THREE.MeshLambertMaterial({ color: 0x14161a });

  // lower body + hood/trunk shaping
  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.62, len), paint);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.2, 0.4, 0.7), paint);
  nose.position.set(0, 0.62, len / 2 - 0.2); g.add(nose);
  // cabin with glass
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.3, 0.55, len * 0.42), glass);
  cabin.position.set(0, 1.12, -len * 0.05); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.24, 0.08, len * 0.4), paint);
  roof.position.set(0, 1.42, -len * 0.05); g.add(roof);
  // bumpers, grille, spoiler
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.18, 0.25), chrome);
  bumperF.position.set(0, 0.4, len / 2 + 0.05); g.add(bumperF);
  const bumperR = bumperF.clone(); bumperR.position.z = -len / 2 - 0.05; g.add(bumperR);
  if (type.name.includes('Coupe') || type.name.includes('Convertible')) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.3, 0.08, 0.4), paint);
    spoiler.position.set(0, 1.0, -len / 2 + 0.15); g.add(spoiler);
  }
  // headlights + taillights (glowing)
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0x777744 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xff2a22, emissive: 0x550000 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
    hl.position.set(s * 0.62, 0.68, len / 2 + 0.02); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), tailMat);
    tl.position.set(s * 0.62, 0.68, -len / 2 - 0.02); g.add(tl);
  }
  // wheels that turn: hub + tire, stored for steering/spin
  const wheels = [];
  for (const [wx, wz, front] of [[-0.85, len / 2 - 0.9, true], [0.85, len / 2 - 0.9, true],
    [-0.85, -len / 2 + 0.9, false], [0.85, -len / 2 + 0.9, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const tireMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14), tire);
    tireMesh.rotation.z = Math.PI / 2; tireMesh.castShadow = true; pivot.add(tireMesh);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 10), chrome);
    hub.rotation.z = Math.PI / 2; pivot.add(hub);
    g.add(pivot);
    wheels.push({ pivot, front });
  }
  // police livery
  let lightbar = null;
  if (opts.police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.02, 0.3, len * 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111418 }));
    stripe.position.y = 0.72; g.add(stripe);
    lightbar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
    red.position.x = -0.3; lightbar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000aa }));
    blue.position.x = 0.3; lightbar.add(blue);
    lightbar.position.set(0, 1.52, -len * 0.05);
    g.add(lightbar);
  }
  g.userData = { wheels, lightbar, len, wid, type };
  return g;
}

// Traffic: cars loop rectangular routes around city blocks on the road grid.
export function createTraffic(scene, count) {
  const rnd = mulberry(777);
  const cars = [];
  const routes = [];
  for (let i = 0; i < count; i++) {
    const bx = -125 + Math.floor(rnd() * 5) * 50;
    const bz = -125 + Math.floor(rnd() * 5) * 50;
    const loop = [
      [bx - 25, bz - 25], [bx + 25, bz - 25], [bx + 25, bz + 25], [bx - 25, bz + 25],
    ];
    const type = CAR_TYPES[Math.floor(rnd() * CAR_TYPES.length)];
    const mesh = makeCar(type);
    mesh.position.set(loop[0][0], 0, loop[0][1]);
    scene.add(mesh);
    cars.push({
      mesh, loop, wp: 1, speed: 7 + rnd() * 5, heading: 0,
      x: loop[0][0], z: loop[0][1], wheelSpin: 0,
    });
  }
  return cars;
}

export function updateTraffic(cars, dt, colliders) {
  for (const c of cars) {
    const [tx, tz] = c.loop[c.wp];
    const dx = tx - c.x, dz = tz - c.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) { c.wp = (c.wp + 1) % c.loop.length; continue; }
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    c.wheelSpin += (c.speed / 0.36) * dt;
    for (const w of c.mesh.userData.wheels) {
      w.pivot.children[0].rotation.x = c.wheelSpin;
      w.pivot.children[1].rotation.x = c.wheelSpin;
      if (w.front) w.pivot.rotation.y = Math.max(-0.4, Math.min(0.4, dh * 1.5));
    }
  }
}

// Police car: chases the player with simple pursuit steering.
export function createPoliceCar(scene) {
  const mesh = makeCar({ name: 'Harbor Patrol', color: 0xffffff, speed: 30, len: 4.6 }, { police: true, color: 0xf2f2f2 });
  scene.add(mesh);
  return { mesh, x: 0, z: 0, heading: 0, speed: 0, wheelSpin: 0, active: false, sirenPhase: 0 };
}

export function updatePoliceCar(p, target, dt, colliders) {
  if (!p.active) { p.mesh.visible = false; return; }
  p.mesh.visible = true;
  const dx = target.x - p.x, dz = target.z - p.z;
  const dist = Math.hypot(dx, dz);
  const targetHeading = Math.atan2(dx, dz);
  let dh = targetHeading - p.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const want = dist > 60 ? 30 : 24;
  p.speed += (want - p.speed) * Math.min(1, dt * 0.8);
  p.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
  p.x += Math.sin(p.heading) * p.speed * dt;
  p.z += Math.cos(p.heading) * p.speed * dt;
  // slide along buildings
  const pos = new THREE.Vector3(p.x, 0, p.z);
  collideCircle(pos, 1.6, colliders);
  p.x = pos.x; p.z = pos.z;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  p.wheelSpin += (p.speed / 0.36) * dt;
  for (const w of p.mesh.userData.wheels) {
    w.pivot.children[0].rotation.x = p.wheelSpin;
    w.pivot.children[1].rotation.x = p.wheelSpin;
    if (w.front) w.pivot.rotation.y = Math.max(-0.45, Math.min(0.45, dh * 1.2));
  }
  // flashing light bar
  p.sirenPhase += dt * 10;
  if (p.mesh.userData.lightbar) {
    p.mesh.userData.lightbar.children[0].material.emissiveIntensity = Math.sin(p.sirenPhase) > 0 ? 2.2 : 0.3;
    p.mesh.userData.lightbar.children[1].material.emissiveIntensity = Math.sin(p.sirenPhase) > 0 ? 0.3 : 2.2;
  }
}
