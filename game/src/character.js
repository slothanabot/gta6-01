// character.js — builds Dario Costa, a detailed MMORPG-style human: canvas-painted
// face (eyes, brows, nose, lips, stubble), styled hair, coastal street outfit,
// animated limbs, and a visible weapon in the hand when armed.
import * as THREE from 'three';

function faceTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  // skin base with soft shading
  const grad = g.createRadialGradient(128, 110, 20, 128, 128, 150);
  grad.addColorStop(0, '#f2c69b'); grad.addColorStop(0.7, '#e8b184'); grad.addColorStop(1, '#d69c6c');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  // cheeks blush
  g.fillStyle = 'rgba(255,120,90,.18)';
  g.beginPath(); g.ellipse(72, 168, 26, 16, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(184, 168, 26, 16, 0, 0, Math.PI * 2); g.fill();
  // stubble along jaw
  g.fillStyle = 'rgba(60,40,25,.20)';
  g.beginPath(); g.ellipse(128, 215, 62, 34, 0, 0, Math.PI); g.fill();
  // nose
  g.strokeStyle = 'rgba(150,90,50,.55)'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(128, 128); g.lineTo(122, 168); g.lineTo(134, 172); g.stroke();
  g.fillStyle = 'rgba(150,90,50,.35)';
  g.beginPath(); g.ellipse(122, 172, 7, 4, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(134, 172, 7, 4, 0, 0, Math.PI * 2); g.fill();
  // eyes: white, iris, pupil, highlight, lashes
  for (const ex of [82, 174]) {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(ex, 112, 22, 13, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a5a2e';
    g.beginPath(); g.arc(ex, 112, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1a1a';
    g.beginPath(); g.arc(ex, 112, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(ex + 3, 109, 2.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2a1a10'; g.lineWidth = 4;
    g.beginPath(); g.ellipse(ex, 110, 23, 12, 0, Math.PI, Math.PI * 2); g.stroke();
  }
  // brows — thick, styled
  g.strokeStyle = '#2a1a10'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(58, 88); g.quadraticCurveTo(82, 76, 106, 86); g.stroke();
  g.beginPath(); g.moveTo(150, 86); g.quadraticCurveTo(174, 76, 198, 88); g.stroke();
  // lips
  g.fillStyle = '#b45a4a';
  g.beginPath(); g.moveTo(104, 204); g.quadraticCurveTo(128, 194, 152, 204);
  g.quadraticCurveTo(128, 216, 104, 204); g.fill();
  g.strokeStyle = '#7a352a'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(104, 204); g.quadraticCurveTo(128, 210, 152, 204); g.stroke();
  // chin shadow
  g.fillStyle = 'rgba(120,70,40,.15)';
  g.beginPath(); g.ellipse(128, 232, 26, 10, 0, 0, Math.PI); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // flipY=false: on a sphere, canvas top must map to the top pole, or the
  // face renders upside-down and hides under the hair.
  t.flipY = false;
  return t;
}

function shirtTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2fa8a0'; g.fillRect(0, 0, 256, 256);
  // tropical leaf print
  g.fillStyle = '#ff7d5c';
  for (let i = 0; i < 14; i++) {
    const x = (i * 67) % 256, y = (i * 97) % 256;
    g.beginPath(); g.ellipse(x, y, 16, 7, (i * 0.7) % 3, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#ffe9a8';
  for (let i = 0; i < 10; i++) {
    const x = (i * 113 + 40) % 256, y = (i * 71 + 30) % 256;
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
  }
  // open collar V
  g.fillStyle = '#e8b184';
  g.beginPath(); g.moveTo(96, 0); g.lineTo(160, 0); g.lineTo(128, 74); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildPlayerCharacter() {
  const g = new THREE.Group();
  g.name = 'DarioCosta';
  const skin = new THREE.MeshLambertMaterial({ map: faceTexture() });
  const skinPlain = new THREE.MeshLambertMaterial({ color: 0xe8b184 });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x2a1a10 });
  const shirtMat = new THREE.MeshLambertMaterial({ map: shirtTexture() });
  const shortsMat = new THREE.MeshLambertMaterial({ color: 0x2e4a6b });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  // legs (pivot at hip for walk swing)
  const legL = new THREE.Group(); legL.position.set(-0.16, 0.95, 0);
  const legR = new THREE.Group(); legR.position.set(0.16, 0.95, 0);
  for (const leg of [legL, legR]) {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.24), skinPlain);
    thigh.position.y = -0.25; leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.22), skinPlain);
    shin.position.y = -0.72; leg.add(shin);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.42), shoeMat);
    shoe.position.set(0, -0.95, 0.07); leg.add(shoe);
    // shorts cuff
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.28), shortsMat);
    cuff.position.y = -0.08; leg.add(cuff);
  }
  g.add(legL, legR);

  // torso: open Hawaiian shirt over a white tee
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.32; torso.castShadow = true; g.add(torso);
  const tee = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.2), new THREE.MeshLambertMaterial({ color: 0xf2f2ea }));
  tee.position.set(0, 1.32, 0.1); g.add(tee);
  // gold chain
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 14, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0xffd23e }));
  chain.position.set(0, 1.62, 0.18); chain.rotation.x = 0.3; g.add(chain);

  // arms (pivot at shoulder)
  const armL = new THREE.Group(); armL.position.set(-0.38, 1.62, 0);
  const armR = new THREE.Group(); armR.position.set(0.38, 1.62, 0);
  for (const arm of [armL, armR]) {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.2), shirtMat);
    upper.position.y = -0.21; arm.add(upper);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.18), skinPlain);
    fore.position.y = -0.6; arm.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), skinPlain);
    hand.position.y = -0.85; arm.add(hand);
  }
  g.add(armL, armR);

  // head with painted face texture on the front (+z)
  const head = new THREE.Group(); head.position.y = 1.92;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 16), skin);
  skull.scale.set(0.92, 1.05, 0.95); skull.castShadow = true; head.add(skull);
  // The canvas face is painted around u=0.5, which maps to +x on a sphere;
  // rotate so the face looks along the character's forward (+z).
  skull.rotation.y = -Math.PI / 2;
  // ears
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skinPlain);
    ear.position.set(s * 0.24, 0, 0); head.add(ear);
  }
  // styled hair: swept fringe + back volume (thetaLength keeps the hair above
  // the brows so the painted face stays visible)
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.3), hairMat);
  hairTop.position.set(0, 0.06, -0.02); hairTop.scale.set(0.95, 0.9, 0.98); head.add(hairTop);
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.16), hairMat);
  fringe.position.set(0.03, 0.2, 0.2); fringe.rotation.z = -0.12; head.add(fringe);
  const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.12), hairMat);
  backHair.position.set(0, 0.05, -0.22); head.add(backHair);
  // sunglasses pushed up on the head
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.1),
    new THREE.MeshLambertMaterial({ color: 0x111418 }));
  shades.position.set(0, 0.24, 0.14); shades.rotation.x = -0.35; head.add(shades);
  g.add(head);

  // weapon mount in the right hand
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.88, 0.05);
  armR.add(weaponMount);

  return { group: g, head, armL, armR, legL, legR, weaponMount, height: 2.2 };
}

// Procedural walk/run cycle: swing limbs, bob the body, lean forward when sprinting.
export function animateCharacter(rig, phase, speed, dt) {
  const swing = Math.min(1, speed / 6) * 0.85;
  const s = Math.sin(phase), c = Math.sin(phase + Math.PI);
  rig.legL.rotation.x = s * swing;
  rig.legR.rotation.x = c * swing;
  rig.armL.rotation.x = c * swing * 0.8;
  rig.armR.rotation.x = s * swing * 0.8;
  // bob the head, not the group (the group Y is the jump height)
  rig.head.position.y = 1.92 + Math.abs(Math.sin(phase)) * 0.05 * Math.min(1, speed / 4);
  rig.group.rotation.x = speed > 7 ? 0.12 : 0;
}

// A simpler NPC: pedestrian or gang member with varied clothes + a plain face.
export function buildNpcCharacter(opts = {}) {
  const { shirt = 0x8a6a4f, pants = 0x3a3a4a, skinColor = 0xd9a077, hairColor = 0x1a1a1a, gang = false } = opts;
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Group(); legL.position.set(-0.15, 0.92, 0);
  const legR = new THREE.Group(); legR.position.set(0.15, 0.92, 0);
  for (const leg of [legL, legR]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.22), pantsMat);
    l.position.y = -0.45; leg.add(l);
  }
  g.add(legL, legR);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.32), shirtMat);
  torso.position.y = 1.28; torso.castShadow = true; g.add(torso);
  if (gang) {
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.36),
      new THREE.MeshLambertMaterial({ color: 0x1c1c22 }));
    vest.position.y = 1.34; g.add(vest);
  }
  const armL = new THREE.Group(); armL.position.set(-0.36, 1.56, 0);
  const armR = new THREE.Group(); armR.position.set(0.36, 1.56, 0);
  for (const arm of [armL, armR]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), shirtMat);
    a.position.y = -0.31; arm.add(a);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
    hand.position.y = -0.66; arm.add(hand);
  }
  g.add(armL, armR);
  const head = new THREE.Group(); head.position.y = 1.86;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), skin);
  skull.scale.set(0.92, 1.05, 0.95); head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshLambertMaterial({ color: hairColor }));
  hair.position.y = 0.05; head.add(hair);
  // simple eyes so NPCs read as people at a glance
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    eye.position.set(s * 0.09, 0.03, 0.22); head.add(eye);
  }
  g.add(head);
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.7, 0.05);
  armR.add(weaponMount);
  return { group: g, head, armL, armR, legL, legR, weaponMount, height: 2.1 };
}
