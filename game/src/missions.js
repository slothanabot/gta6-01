// missions.js — the Harborlight story: five courier missions across Marina Bay.
// Each mission: title, briefing, objective marker, timer, rewards, wanted changes.
import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 'm1', title: 'FIRST PICKUP', cash: 150,
    briefing: 'Old Sal at the docks has a package for the crew. Walk to the glowing marker and grab it. Keep it clean — no heat yet.',
    objective: 'Pick up the package at the Harbor Docks',
    target: new THREE.Vector3(-150, 0, 175),
    onStart: null, timer: 0,
  },
  {
    id: 'm2', title: 'BOARDWALK DASH', cash: 250,
    briefing: 'The buyer waits at the Salt Air Café on the boardwalk. You have 90 seconds — grab a car if you can, and don\'t stop for anyone.',
    objective: 'Deliver the package to Salt Air Café before time runs out',
    target: new THREE.Vector3(156, 0, -20),
    onStart: null, timer: 90,
  },
  {
    id: 'm3', title: 'HARBOR HEAT', cash: 350,
    briefing: 'The harbor patrol spotted the handoff. Lose them — two stars and climbing. Get to the Coral Hotel garage and lay low until the heat dies.',
    objective: 'Reach the Coral Hotel garage and lose the wanted level',
    target: new THREE.Vector3(-125, 0, -112),
    wanted: 2, timer: 0,
  },
  {
    id: 'm4', title: 'THE LIGHTHOUSE DROP', cash: 500,
    briefing: 'The Red Tide gang is waiting at the lighthouse to take the shipment by force. Mara is with you — press G near her to hand her a pistol so she can cover you. Clear them out, then make the drop.',
    objective: 'Clear the gang at the lighthouse, then make the drop',
    target: new THREE.Vector3(-160, 0, 195),
    gang: true, ally: true, timer: 0,
  },
  {
    id: 'm5', title: 'THE BIG SCORE', cash: 1000,
    briefing: 'Final run: three drops, one night of heat. Marina, plaza, then the docks — the patrol will be all over you. Finish all three and the crew is set.',
    objective: 'Make the final drops: Marina → Plaza → Docks',
    targets: [
      new THREE.Vector3(20, 0, 200),
      new THREE.Vector3(25, 0, 25),
      new THREE.Vector3(-150, 0, 175),
    ],
    wanted: 3, timer: 240,
  },
];

export function createMissionMarker(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 15; group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.16, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; group.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  arrow.position.y = 4.5; arrow.rotation.x = Math.PI; group.add(arrow);
  group.visible = false;
  scene.add(group);
  return group;
}

export function updateMissionMarker(marker, t) {
  if (!marker.visible) return;
  marker.rotation.y += 0.02;
  marker.children[2].position.y = 4.5 + Math.sin(t * 3) * 0.5;
  const s = 1 + Math.sin(t * 4) * 0.08;
  marker.children[1].scale.set(s, s, 1);
}

// Distance in meters (1 unit = 1 m) between player and a target.
export function distanceTo(playerPos, target) {
  return Math.hypot(target.x - playerPos.x, target.z - playerPos.z);
}

export const REP_TITLES = [
  [0, 'Rookie Courier'], [400, 'Trusted Runner'], [1000, 'Harbor Regular'],
  [2000, 'Smuggler'], [4000, 'Bay Legend'],
];

export function repTitle(cash) {
  let title = REP_TITLES[0][1];
  for (const [min, name] of REP_TITLES) if (cash >= min) title = name;
  return title;
}
