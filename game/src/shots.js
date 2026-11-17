// Deterministic screenshot scenes (?shot=start|drive|boat|wanted).
// Each one places Rico, vehicles and police, then steps the simulation a
// fixed number of ticks so the render is a real frame of the live game.
import { makeCar, makeBoat, makePoliceCar, makeCoastGuard } from './vehicles.js';

export function setupShot(game, name) {
  const p = game.player;
  const w = game.world;
  game.state = 'play';
  game.time = 12.5;
  if (name === 'start') {
    game.state = 'menu';
    game.time = 4.0;
    return;
  }
  if (name === 'drive') {
    // Rico in a red sports car cruising the beach road, traffic around.
    const car = makeCar(w, 560, 1180, Math.PI / 2, { name: 'Sports', color: '#e74c3c', len: 48, wid: 22, top: 130, accel: 300, max: 420 });
    car.speed = 210;
    game.cars.push(car);
    p.inVehicle = car;
    p.x = car.x; p.y = car.y;
    const t1 = makeCar(w, 573, 950, Math.PI / 2);
    t1.traffic = true; t1.speed = 110;
    const t2 = makeCar(w, 547, 1420, -Math.PI / 2);
    t2.traffic = true; t2.speed = 100;
    game.cars.push(t1, t2);
    p.cash = 1250;
    game.addMessage('Beach road, Marina Bay — the run is on.');
    step(game, 50);
    return;
  }
  if (name === 'boat') {
    // Speedboat in the bay by the marina, coast guard closing in, packages afloat.
    const boat = makeBoat(w, 300, 1400, Math.PI / 2, { name: 'Speedboat', color: '#e74c3c', len: 52, wid: 20, top: 120, accel: 260, max: 380 });
    boat.speed = 200;
    game.boats.push(boat);
    p.inVehicle = boat;
    p.x = boat.x; p.y = boat.y;
    const cg = makeCoastGuard(w, 380, 1150);
    game.coastguard.push(cg);
    game.police.push(cg);
    p.wanted = 2;
    p.cash = 2100;
    game.addMessage('Coast guard on your tail — run the bay!');
    step(game, 50);
    return;
  }
  if (name === 'wanted') {
    // Three-star chase through Old Town: cruisers on Rico's bumper.
    const car = makeCar(w, 1360, 1120, 0, { name: 'Sports', color: '#8e44ad', len: 48, wid: 22, top: 128, accel: 295, max: 410 });
    car.speed = 260;
    game.cars.push(car);
    p.inVehicle = car;
    p.x = car.x; p.y = car.y;
    p.wanted = 3;
    p.cash = 3400;
    p.hasPistol = true; p.ammo = 18;
    game.spawnPolice(2);
    for (const pc of game.police) {
      if (pc.kind === 'car') { pc.x = car.x - 120; pc.y = car.y + 30; pc.speed = 240; }
    }
    game.addMessage('Three stars! Lose the cruisers!');
    step(game, 40);
    return;
  }
  // Unknown shot name: plain play scene.
  game.state = 'play';
}

function step(game, n) {
  for (let i = 0; i < n; i++) game.update(1 / 60, true);
}
