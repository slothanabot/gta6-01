// city.js — builds Marina Bay: streets, varied buildings with storefronts and
// rooftop detail, the beach and boardwalk, the harbor, the marina and the lighthouse.
// Exports buildCity(scene) -> { colliders, roadPoints, beachCenter, spawnPoints, bounds }.
import * as THREE from 'three';

const ROADS_X = [-150, -100, -50, 0, 50, 100, 150];
const ROADS_Z = [-150, -100, -50, 0, 50, 100, 150];
const CITY = 200; // half-extent of the drivable city

const SHOP_NAMES = [
  ['Salt Air Café', '#ff9a5c'], ['Tide & Tackle', '#7fd4ff'], ['Coral Hotel', '#ff7d9c'],
  ['Palm Grocer', '#8dff7a'], ['Wave Rider Surf', '#ffd23e'], ['Harbor Bank', '#c9b8ff'],
  ['Marina Motors', '#ff8a7a'], ['Sunset Tacos', '#ffb347'], ['Boardwalk Books', '#9fe8ff'],
  ['Coral Dive Shop', '#7dffc9'], ['The Gull Diner', '#ffcf5c'], ['Palm Pharmacy', '#a8ff8a'],
  ['Sail & Anchor Bar', '#ff9ad5'], ['Beachside Bikes', '#8ad4ff'], ['Lighthouse Gifts', '#fff27a'],
  ['Harbor Fish Co.', '#7affd4'], ['Sunny Nails', '#ff9ad5'], ['Coast Coffee', '#e8b07a'],
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

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Facade: lit windows on a warm wall, ground-floor shopfront with awning + sign.
function facadeTexture(base, shop, seed) {
  const rnd = mulberry(seed);
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // subtle wall noise
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.05})`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 2 + rnd() * 5);
    }
    // window rows
    const cols = 4, rows = 6;
    for (let r = 0; r < rows; r++) {
      for (let c2 = 0; c2 < cols; c2++) {
        const x = 14 + c2 * 60, y = 14 + r * 58;
        const lit = rnd() > 0.45;
        g.fillStyle = '#24303c'; g.fillRect(x - 3, y - 3, 46, 40);
        g.fillStyle = lit ? (rnd() > 0.5 ? '#ffe9a8' : '#bfe8ff') : '#5a7186';
        g.fillRect(x, y, 40, 34);
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, 40, 5);
      }
    }
    // ground floor storefront
    g.fillStyle = '#1d2733'; g.fillRect(0, 396, w, 116);
    g.fillStyle = '#dfe9f2';
    g.fillRect(10, 412, 100, 66); g.fillRect(146, 412, 100, 66);
    g.fillStyle = 'rgba(120,200,255,.25)'; g.fillRect(10, 412, 100, 66); g.fillRect(146, 412, 100, 66);
    // striped awning
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : (shop ? shop[1] : '#ff5a4e');
      g.fillRect(8 + i * 30, 388, 30, 16);
    }
    // sign board with the shop name
    g.fillStyle = '#10202e'; g.fillRect(0, 352, w, 34);
    g.fillStyle = '#ffd23e'; g.font = 'bold 17px Trebuchet MS, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(shop ? shop[0].toUpperCase() : 'MARINA BAY', w / 2, 370, w - 8);
  });
}

function roofDetail(group, w, d, y, rnd) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a94a0 });
  const mat2 = new THREE.MeshLambertMaterial({ color: 0x6b7683 });
  const n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const bw = 1 + rnd() * 2, bd = 1 + rnd() * 2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.7 + rnd() * 0.8, bd), i % 2 ? mat : mat2);
    box.position.set((rnd() - 0.5) * (w - bw - 1), y + 0.5, (rnd() - 0.5) * (d - bd - 1));
    group.add(box);
  }
  if (rnd() > 0.55) { // water tower
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 2.2, 10),
      new THREE.MeshLambertMaterial({ color: 0x9c6b4f }));
    tw.position.set((rnd() - 0.5) * (w - 3), y + 1.6, (rnd() - 0.5) * (d - 3));
    group.add(tw);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.1, 10),
      new THREE.MeshLambertMaterial({ color: 0x7a4a33 }));
    cone.position.copy(tw.position); cone.position.y += 1.6; group.add(cone);
  }
  if (rnd() > 0.5) { // antenna
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4 + rnd() * 3, 6),
      new THREE.MeshLambertMaterial({ color: 0x30363e }));
    ant.position.set((rnd() - 0.5) * (w - 2), y + 2.5, (rnd() - 0.5) * (d - 2));
    group.add(ant);
  }
}

export function buildCity(scene) {
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const rnd = mulberry(20261117);
  const group = new THREE.Group();
  group.name = 'MarinaBayCity';

  // --- ground: grass-green city base, sand beach, ocean ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: 0x7fae62 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(40, 0, 0);
  ground.receiveShadow = true; group.add(ground);

  // beach sand strip on the east
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(70, 460),
    new THREE.MeshLambertMaterial({ color: 0xeed9a4 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(195, 0.05, 0); sand.receiveShadow = true; group.add(sand);
  // boardwalk planks between city and sand
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(10, 460),
    new THREE.MeshLambertMaterial({ color: 0xb98a5a }));
  walk.rotation.x = -Math.PI / 2; walk.position.set(156, 0.06, 0); walk.receiveShadow = true; group.add(walk);
  // ocean (animated in main loop via userData)
  const oceanGeo = new THREE.PlaneGeometry(220, 560, 24, 40);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshLambertMaterial({
    color: 0x1e7fa8, transparent: true, opacity: 0.94 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(340, 0.12, 0);
  ocean.userData.isOcean = true; ocean.userData.base = oceanGeo.attributes.position.array.slice();
  group.add(ocean);
  // south bay water
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(420, 60),
    new THREE.MeshLambertMaterial({ color: 0x1e7fa8, transparent: true, opacity: 0.9 }));
  bay.rotation.x = -Math.PI / 2; bay.position.set(0, 0.1, 215); group.add(bay);

  // --- roads: dark asphalt strips with pale dashes ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x33383f });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d8c8 });
  const sideMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
  for (const x of ROADS_X) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(12, 420), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.08, 0); r.receiveShadow = true; group.add(r);
    for (const z of [-175, -125, -75, -25, 25, 75, 125, 175]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(x, 0.1, z); group.add(d);
    }
    for (const s of [-7, 7]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(3, 420), sideMat);
      sw.rotation.x = -Math.PI / 2; sw.position.set(x + s, 0.09, 0); group.add(sw);
    }
  }
  for (const z of ROADS_Z) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(420, 12), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.08, z); r.receiveShadow = true; group.add(r);
    for (const x of [-175, -125, -75, -25, 25, 75, 125, 175]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(x, 0.1, z); group.add(d);
    }
    for (const s of [-7, 7]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(420, 3), sideMat);
      sw.rotation.x = -Math.PI / 2; sw.position.set(0, 0.09, z + s); group.add(sw);
    }
  }
  // crosswalks
  for (const x of ROADS_X) for (const z of ROADS_Z) {
    for (let i = -2; i <= 2; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4), dashMat);
      stripe.rotation.x = -Math.PI / 2; stripe.position.set(x + i * 2.4, 0.11, z + 9);
      group.add(stripe);
    }
  }

  // --- buildings: varied footprints/heights, storefronts on ground floor ---
  const palette = [0xd8c9a8, 0xc9b8a0, 0xe8dcc8, 0xb8c4cc, 0xd8a898, 0xa8c4b8, 0xe0cfa0, 0xc4b8d8];
  let shopIdx = 0;
  const blockCenters = [];
  for (let ix = 0; ix < ROADS_X.length - 1; ix++) {
    for (let iz = 0; iz < ROADS_Z.length - 1; iz++) {
      const cx = (ROADS_X[ix] + ROADS_X[ix + 1]) / 2;
      const cz = (ROADS_Z[iz] + ROADS_Z[iz + 1]) / 2;
      blockCenters.push([cx, cz]);
    }
  }
  // a few blocks become a park, a plaza, or a parking lot instead of buildings
  const parkBlocks = new Set([7, 13, 22, 29]);
  const plazaBlocks = new Set([17, 18]);
  blockCenters.forEach(([cx, cz], bi) => {
    if (parkBlocks.has(bi)) {
      // palm park
      const lawn = new THREE.Mesh(new THREE.PlaneGeometry(34, 34),
        new THREE.MeshLambertMaterial({ color: 0x5f9e4e }));
      lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, 0.07, cz); group.add(lawn);
      for (let i = 0; i < 6; i++) group.add(makePalm(cx + (rnd() - 0.5) * 26, cz + (rnd() - 0.5) * 26, rnd));
      const bench = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 1.2),
        new THREE.MeshLambertMaterial({ color: 0x8a5a33 }));
      bench.position.set(cx, 0.5, cz); group.add(bench);
      return;
    }
    if (plazaBlocks.has(bi)) {
      const plaza = new THREE.Mesh(new THREE.PlaneGeometry(34, 34),
        new THREE.MeshLambertMaterial({ color: 0xc9c2b2 }));
      plaza.rotation.x = -Math.PI / 2; plaza.position.set(cx, 0.07, cz); group.add(plaza);
      const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 1, 16),
        new THREE.MeshLambertMaterial({ color: 0x9fc4d8 }));
      fountain.position.set(cx, 0.6, cz); group.add(fountain);
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 2.4, 8),
        new THREE.MeshLambertMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.8 }));
      jet.position.set(cx, 2.2, cz); group.add(jet);
      return;
    }
    // 1-4 buildings per block
    const count = 1 + Math.floor(rnd() * 3);
    for (let b = 0; b < count; b++) {
      const w = 9 + rnd() * 12, d = 9 + rnd() * 12;
      const h = 7 + rnd() * rnd() * 26;
      const ox = (rnd() - 0.5) * (36 - w - 4), oz = (rnd() - 0.5) * (36 - d - 4);
      const bx = cx + ox, bz = cz + oz;
      const shop = SHOP_NAMES[shopIdx++ % SHOP_NAMES.length];
      const base = '#' + new THREE.Color(palette[Math.floor(rnd() * palette.length)]).getHexString();
      const tex = facadeTexture(base, shop, Math.floor(rnd() * 1e9));
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(bx, h / 2, bz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      // flat roof cap + rooftop detail
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4),
        new THREE.MeshLambertMaterial({ color: 0x5a5f66 }));
      cap.position.set(bx, h + 0.2, bz); group.add(cap);
      roofDetail(group, w, d, h + 0.4, rnd);
      colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
    }
  });

  // --- landmark: Coral Hotel tower (tall, glassy) ---
  const hotelTex = canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#e8f2f8'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 12; r++) for (let c2 = 0; c2 < 6; c2++) {
      g.fillStyle = r % 2 ? '#7fc4e8' : '#a8d8f0';
      g.fillRect(10 + c2 * 40, 12 + r * 40, 32, 28);
    }
    g.fillStyle = '#10202e'; g.fillRect(0, h - 60, w, 60);
    g.fillStyle = '#ffd23e'; g.font = 'bold 26px Trebuchet MS'; g.textAlign = 'center';
    g.fillText('CORAL HOTEL', w / 2, h - 26);
  });
  const hotel = new THREE.Mesh(new THREE.BoxGeometry(26, 52, 20),
    new THREE.MeshLambertMaterial({ map: hotelTex }));
  hotel.position.set(-125, 26, -125); hotel.castShadow = true; group.add(hotel);
  colliders.push({ minX: -138, maxX: -112, minZ: -135, maxZ: -115 });
  // hotel rooftop sign
  const signTex = canvasTexture(512, 96, (g, w, h) => {
    g.fillStyle = '#0b2233'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff7d9c'; g.font = 'bold 56px Trebuchet MS'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('★ CORAL HOTEL ★', w / 2, h / 2);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(24, 4.5),
    new THREE.MeshLambertMaterial({ map: signTex }));
  sign.position.set(-125, 54.5, -115); group.add(sign);

  // --- lighthouse at the south point ---
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.2, 26, 14),
    new THREE.MeshLambertMaterial({ color: 0xfff2e0 }));
  tower.position.y = 13; tower.castShadow = true; lh.add(tower);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.4 - i * 0.3, 3.6 - i * 0.3, 2.4, 14),
      new THREE.MeshLambertMaterial({ color: 0xff5a4e }));
    band.position.y = 6 + i * 8; lh.add(band);
  }
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 3, 12),
    new THREE.MeshLambertMaterial({ color: 0x222a33 }));
  lampRoom.position.y = 27.5; lh.add(lampRoom);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.2, 30, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
  beam.rotation.z = Math.PI / 2; beam.position.set(16, 27.5, 0);
  beam.userData.isBeam = true; lh.add(beam);
  lh.position.set(-160, 0, 195);
  group.add(lh);
  colliders.push({ minX: -165, maxX: -155, minZ: 190, maxZ: 200 });

  // --- harbor docks (south-west): concrete pier over the bay, containers, cranes ---
  const pierSlab = new THREE.Mesh(new THREE.BoxGeometry(110, 0.24, 55),
    new THREE.MeshLambertMaterial({ color: 0x9a938a }));
  pierSlab.position.set(-155, 0.12, 185); pierSlab.receiveShadow = true; group.add(pierSlab);
  const contColors = [0xc94f3d, 0x3d7fc9, 0x4fc97a, 0xc9a13d, 0x8a5fc9];
  for (let i = 0; i < 10; i++) {
    const cw = 6, ch = 2.6, cd = 2.6;
    const c = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd),
      new THREE.MeshLambertMaterial({ color: contColors[i % contColors.length] }));
    const px = -170 + (i % 5) * 14, pz = 165 + Math.floor(i / 5) * 8;
    c.position.set(px, ch / 2 + (i % 2) * ch, pz);
    c.rotation.y = (i % 3) * 0.12; c.castShadow = true; group.add(c);
    colliders.push({ minX: px - 3.2, maxX: px + 3.2, minZ: pz - 1.6, maxZ: pz + 1.6 });
  }
  // dock crane
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xffd23e });
  const craneBase = new THREE.Mesh(new THREE.BoxGeometry(4, 18, 4), craneMat);
  craneBase.position.set(-120, 9, 185); craneBase.castShadow = true; group.add(craneBase);
  const craneArm = new THREE.Mesh(new THREE.BoxGeometry(30, 1.6, 1.6), craneMat);
  craneArm.position.set(-105, 18, 185); group.add(craneArm);
  colliders.push({ minX: -122, maxX: -118, minZ: 183, maxZ: 187 });

  // --- marina (south): wooden piers + moored boats ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9c7a4f });
  for (const px of [-60, -20, 20, 60]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 34), pierMat);
    pier.position.set(px, 0.4, 200); group.add(pier);
  }
  const boatColors = [0xffffff, 0xffd23e, 0x7fd4ff, 0xff9a5c];
  for (let i = 0; i < 8; i++) {
    const boat = makeBoat(boatColors[i % boatColors.length]);
    boat.position.set(-70 + i * 18 + (i % 2) * 4, 0.3, 196 + (i % 3) * 10);
    boat.rotation.y = (rnd() - 0.5) * 0.4;
    group.add(boat);
  }

  // --- beach props: palms, umbrellas, lifeguard tower ---
  for (let i = 0; i < 14; i++) {
    const px = 168 + rnd() * 46, pz = -200 + i * 30 + rnd() * 12;
    group.add(makePalm(px, pz, rnd));
  }
  for (let i = 0; i < 8; i++) {
    const ux = 176 + rnd() * 40, uz = -190 + i * 48;
    group.add(makeUmbrella(ux, uz, [0xff5a4e, 0xffd23e, 0x7fd4ff, 0xff9ad5][i % 4]));
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2),
      new THREE.MeshLambertMaterial({ color: [0xff7d9c, 0x7dffc9, 0xffd23e][i % 3] }));
    towel.rotation.x = -Math.PI / 2; towel.position.set(ux + 2.5, 0.08, uz + 1); group.add(towel);
  }
  // lifeguard tower
  const lg = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.4, 6), legMat);
    leg.position.set(lx, 2.2, lz); lg.add(leg);
  }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 3), new THREE.MeshLambertMaterial({ color: 0xffd23e }));
  hut.position.y = 5.2; hut.castShadow = true; lg.add(hut);
  const lgRoof = new THREE.Mesh(new THREE.ConeGeometry(3, 1.4, 4), new THREE.MeshLambertMaterial({ color: 0xff5a4e }));
  lgRoof.position.y = 7; lgRoof.rotation.y = Math.PI / 4; lg.add(lgRoof);
  lg.position.set(180, 0, -40); group.add(lg);
  colliders.push({ minX: 178, maxX: 182, minZ: -42, maxZ: -38 });

  // --- street props: lamps, hydrants, benches ---
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a3138 });
  for (const x of ROADS_X) for (const z of ROADS_Z) {
    if (rnd() > 0.5) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
    pole.position.set(x + 8, 3, z + 8); group.add(pole);
    const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xfff2a8, emissive: 0x554411 }));
    lampHead.position.set(x + 8, 6.2, z + 8); group.add(lampHead);
  }

  scene.add(group);
  return {
    colliders, group, ocean,
    bounds: { minX: -195, maxX: 230, minZ: -205, maxZ: 205 },
    beachCenter: new THREE.Vector3(195, 0, 0),
    lighthouse: new THREE.Vector3(-160, 0, 195),
    docks: new THREE.Vector3(-150, 0, 175),
    boardwalk: new THREE.Vector3(156, 0, -20),
    plaza: new THREE.Vector3(25, 0, 25),
  };
}

export function makePalm(x, z, rnd) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 6 + rnd() * 2, 7),
    new THREE.MeshLambertMaterial({ color: 0x8a6a45 }));
  trunk.position.y = 3; trunk.rotation.z = (rnd() - 0.5) * 0.25; trunk.castShadow = true; g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4e, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.4), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.2, 6.2, Math.sin(a) * 1.2);
    leaf.rotation.set(Math.sin(a) * 0.9 - 0.4, 0, Math.cos(a) * 0.9);
    leaf.rotation.y = -a;
    g.add(leaf);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
  nut.position.y = 5.9; g.add(nut);
  g.position.set(x, 0, z);
  return g;
}

function makeUmbrella(x, z, color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
  pole.position.y = 1.3; g.add(pole);
  const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 10),
    new THREE.MeshLambertMaterial({ color }));
  top.position.y = 2.8; top.castShadow = true; g.add(top);
  g.position.set(x, 0, z);
  return g;
}

function makeBoat(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 7),
    new THREE.MeshLambertMaterial({ color }));
  hull.position.y = 0.4; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.4, 4),
    new THREE.MeshLambertMaterial({ color }));
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.4, 4.4); bow.scale.set(1, 1, 0.7); g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, 2.4),
    new THREE.MeshLambertMaterial({ color: 0xffffff }));
  cabin.position.set(0, 1.3, -0.6); g.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a8a8a }));
  mast.position.set(0, 3, 1.4); g.add(mast);
  return g;
}

// Circle (player/car) vs AABB colliders: push the circle out. Returns corrected position.
export function collideCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // center inside box: push along smallest penetration axis
        const pl = pos.x - c.minX, pr = c.maxX - pos.x, pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  return pos;
}
