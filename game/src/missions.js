// Story missions for Rico Marlin and the Harbor Crew. Six jobs, each a
// chain of objectives: go somewhere, pick something up, steal a car or a
// boat, collect packages at sea, tail a mark, clear the docks, and the big
// final score. All original writing and code for Marina Bay.
import { dist, clamp, angleTo, angleLerp } from './util.js';
import { makeCar, makeBoat, makePoliceCar } from './vehicles.js';

export const MISSIONS = [
  {
    id: 'first-drop',
    title: '1 · First Drop',
    brief: 'Sal: "Rico, welcome to the Harbor Crew. Pick up the package at the marina office and run it to the Beach Bar. No cops, no fuss."',
    reward: 400,
  },
  {
    id: 'hot-wheels',
    title: '2 · Hot Wheels',
    brief: 'Sal: "A client wants a sports car, no questions. Jack one off the street and bring it to the chop shop at the east docks. You have 90 seconds before the buyer walks."',
    reward: 700,
  },
  {
    id: 'harbor-run',
    title: '3 · Harbor Run',
    brief: 'Sal: "Three packages went overboard in the bay during the storm. Take a boat, fish them out, bring them back to the pier. Coast guard is out there — keep your head down."',
    reward: 900,
  },
  {
    id: 'the-informant',
    title: '4 · The Informant',
    brief: 'Sal: "A rival courier is meeting his buyer at the warehouse. Tail his sedan — close enough to see him, far enough he never spots you — then follow him in."',
    reward: 800,
  },
  {
    id: 'storm-the-docks',
    title: '5 · Storm the Docks',
    brief: 'Sal: "The Vipers took our shipment truck. Their guards are armed. Clear them out, take the van, and bring it home to the marina. You will need the pistol."',
    reward: 1200,
  },
  {
    id: 'the-big-score',
    title: '6 · The Big Score',
    brief: 'Sal: "One last job, Rico. Grab the manifest at the lighthouse, run the bay by boat, then bring the score to the Beach Bar. The whole bay will be looking for you. Make it count."',
    reward: 2500,
  },
];

const SEA_PACKAGES = [
  { x: 180, y: 700 }, { x: 120, y: 1500 }, { x: 220, y: 2050 },
];

export function startMission(game, index) {
  const m = MISSIONS[index];
  const st = {
    index, step: 0, timer: 0, followT: 0, target: null,
    packages: [], guardsLeft: 0, failed: false, done: false,
  };
  game.mission = st;
  game.addMessage(m.title + ' — ' + m.brief);
  game.audio.phone();
  if (index === 1) st.timer = 90;
  if (index === 2) {
    st.packages = SEA_PACKAGES.map((p) => ({ ...p, taken: false }));
  }
  if (index === 3) {
    const t = makeCar(game.world, 1400, 1120, 0);
    t.traffic = false; t.target = true; t.speed = 120;
    t.waypoints = [{ x: 1400, y: 1120 }, { x: 2500, y: 1120 }, { x: 2500, y: 720 }, { x: 1400, y: 720 }];
    t.wp = 0;
    game.cars.push(t);
    st.target = t;
  }
  if (index === 4) {
    game.enemies = [];
    const spots = [[2620, 1500], [2700, 1620], [2780, 1480], [2660, 1700]];
    for (const [x, y] of spots) {
      game.enemies.push({ x, y, hp: 60, down: false, downT: 0, shootT: 1 + Math.random(), angle: 0, speed: 95 });
    }
    st.guardsLeft = 4;
    const van = makeCar(game.world, 2750, 1560, 0, { name: 'Van', color: '#ecf0f1', len: 56, wid: 25, top: 72, accel: 160, max: 230 });
    game.cars.push(van);
    st.target = van;
  }
  if (index === 5) {
    game.player.wanted = Math.max(game.player.wanted, 0);
  }
}

export function missionTarget(game) {
  const st = game.mission;
  if (!st || st.done) return null;
  const w = game.world;
  const p = game.player;
  switch (st.index) {
    case 0:
      return st.step === 0
        ? { x: w.marinaOffice.x, y: w.marinaOffice.y, label: 'Pick up the package — marina office' }
        : { x: w.beachBar.x, y: w.beachBar.y, label: 'Deliver to the Beach Bar' };
    case 1:
      if (st.step === 0) return { x: p.x + 200, y: p.y, label: 'Steal a sports car (press E near one)' };
      return { x: w.chopShop.x, y: w.chopShop.y, label: 'Deliver to the chop shop — ' + Math.ceil(st.timer) + 's left' };
    case 2: {
      if (st.step === 0) return { x: 620, y: 1750, label: 'Take a boat from the marina' };
      const left = st.packages.filter((k) => !k.taken);
      if (left.length) return { x: left[0].x, y: left[0].y, label: 'Collect the floating packages (' + left.length + ' left)' };
      return { x: 430, y: 1750, label: 'Bring the packages back to the pier' };
    }
    case 3: {
      if (st.step === 0) {
        if (!st.target) return null;
        return { x: st.target.x, y: st.target.y, label: 'Tail the sedan — stay 60–220m back (' + Math.ceil(st.followT) + '/20s)' };
      }
      return { x: w.warehouse.x, y: w.warehouse.y, label: 'Follow him into the warehouse' };
    }
    case 4: {
      if (st.step === 0) return { x: 2700, y: 1560, label: 'Clear the dock guards (' + st.guardsLeft + ' left)' };
      if (st.step === 1) return { x: st.target.x, y: st.target.y, label: 'Take the shipment van' };
      return { x: w.marinaOffice.x, y: w.marinaOffice.y, label: 'Bring the van home to the marina' };
    }
    case 5: {
      if (st.step === 0) return { x: w.lighthouse.x, y: w.lighthouse.y, label: 'Grab the manifest at the lighthouse' };
      if (st.step === 1) return { x: 200, y: 1200, label: 'Run the bay by boat to the drop buoy' };
      return { x: w.beachBar.x, y: w.beachBar.y, label: 'Bring the score to the Beach Bar' };
    }
    default: return null;
  }
}

function completeMission(game) {
  const st = game.mission;
  const m = MISSIONS[st.index];
  game.player.cash += m.reward;
  game.completedMissions.push(m.id);
  game.missionIndex = Math.min(st.index + 1, MISSIONS.length);
  st.done = true;
  game.addMessage('Job done! +' + '$' + m.reward + ' — ' + m.title);
  game.audio.missionDone();
  game.audio.cash();
  game.saveGame();
  if (st.index === MISSIONS.length - 1) {
    game.storyDone = true;
    game.addMessage('THE BIG SCORE is yours. Marina Bay is your town now, Rico.');
  }
  game.mission = null;
}

function failMission(game, why) {
  const st = game.mission;
  if (!st || st.done) return;
  st.failed = true;
  game.addMessage('Job failed: ' + why + ' Talk to Sal to try again.');
  game.audio.missionFail();
  game.mission = null;
  game.enemies = [];
}

export function updateMission(game, dt) {
  const st = game.mission;
  if (!st || st.done) return;
  const p = game.player;
  const w = game.world;
  const near = (x, y, r) => dist(p.x, p.y, x, y) < r;
  const inBoat = p.inVehicle && p.inVehicle.kind === 'boat';
  const inCar = p.inVehicle && p.inVehicle.kind === 'car';

  switch (st.index) {
    case 0:
      if (st.step === 0 && near(w.marinaOffice.x, w.marinaOffice.y, 70)) {
        st.step = 1;
        game.addMessage('Package secured. Now run it to the Beach Bar.');
        game.audio.pickup();
      } else if (st.step === 1 && near(w.beachBar.x, w.beachBar.y, 70)) {
        completeMission(game);
      }
      break;
    case 1:
      st.timer -= dt;
      if (st.timer <= 0) { failMission(game, 'the buyer walked away.'); break; }
      if (st.step === 0 && inCar && p.inVehicle.type.name === 'Sports') {
        st.step = 1;
        game.addMessage('Nice wheels. Now get it to the chop shop, fast!');
      } else if (st.step === 1 && inCar && near(w.chopShop.x, w.chopShop.y, 90)) {
        // hand the car over
        const v = p.inVehicle;
        game.removeVehicle(v);
        p.inVehicle = null;
        p.x = w.chopShop.x - 80; p.y = w.chopShop.y;
        completeMission(game);
      }
      break;
    case 2:
      if (st.step === 0 && inBoat) {
        st.step = 1;
        game.addMessage('You are on the water. Fish out the three packages.');
      } else if (st.step === 1) {
        for (const k of st.packages) {
          if (!k.taken && dist(p.x, p.y, k.x, k.y) < 46) {
            k.taken = true;
            game.audio.pickup();
            game.addMessage('Package recovered (' + st.packages.filter((q) => q.taken).length + '/3).');
          }
        }
        if (st.packages.every((k) => k.taken)) st.step = 2;
      } else if (st.step === 2 && near(430, 1750, 90)) {
        completeMission(game);
      }
      break;
    case 3: {
      const t = st.target;
      if (!t) break;
      if (st.step === 0) {
        const d = dist(p.x, p.y, t.x, t.y);
        if (d < 55) { failMission(game, 'he spotted you tailing him.'); break; }
        if (d < 240) {
          st.followT += dt;
          if (st.followT >= 20) {
            st.step = 1;
            game.addMessage('He is heading to the warehouse. Follow him in.');
          }
        } else {
          st.followT = Math.max(0, st.followT - dt * 0.5);
        }
        // drive the target along its loop
        const wp = t.waypoints[t.wp];
        const wd = dist(t.x, t.y, wp.x, wp.y);
        if (wd < 40) t.wp = (t.wp + 1) % t.waypoints.length;
        else {
          t.angle = angleLerp(t.angle, angleTo(t.x, t.y, wp.x, wp.y), clamp(dt * 2, 0, 1));
          t.x += Math.cos(t.angle) * t.speed * dt;
          t.y += Math.sin(t.angle) * t.speed * dt;
        }
        if (p.wanted >= 3) { failMission(game, 'the cops scared him off.'); }
      } else if (near(w.warehouse.x, w.warehouse.y, 90)) {
        completeMission(game);
      }
      break;
    }
    case 4:
      if (st.step === 0) {
        st.guardsLeft = game.enemies.filter((e) => !e.down).length;
        if (st.guardsLeft === 0) {
          st.step = 1;
          game.addMessage('Docks are clear. Take the van.');
        }
      } else if (st.step === 1 && inCar && p.inVehicle === st.target) {
        st.step = 2;
        game.addMessage('The shipment is yours. Bring it home.');
      } else if (st.step === 2 && inCar && near(w.marinaOffice.x, w.marinaOffice.y, 90)) {
        completeMission(game);
      }
      break;
    case 5:
      if (st.step === 0 && near(w.lighthouse.x, w.lighthouse.y, 70)) {
        st.step = 1;
        game.addMessage('Manifest grabbed. Get a boat and run the bay!');
        if (p.wanted < 2) { p.wanted = 2; game.spawnPolice(2); }
      } else if (st.step === 1 && inBoat && near(200, 1200, 80)) {
        st.step = 2;
        game.addMessage('Drop buoy reached. Now the Beach Bar — lose the heat if you can.');
      } else if (st.step === 2 && near(w.beachBar.x, w.beachBar.y, 80)) {
        completeMission(game);
      }
      break;
    default:
      break;
  }
}

export function updateEnemies(game, dt) {
  const p = game.player;
  for (const e of game.enemies) {
    if (e.down) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d < 340 && !p.inVehicle) {
      e.angle = angleTo(e.x, e.y, p.x, p.y);
      if (d > 130) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
      } else {
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = 1.3;
          game.audio.shoot();
          game.fireBullet(e.x, e.y, e.angle + (Math.random() - 0.5) * 0.3, false);
        }
      }
    } else if (d < 340 && p.inVehicle) {
      // guards shoot at the car
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = 1.6;
        game.audio.shoot();
        game.fireBullet(e.x, e.y, angleTo(e.x, e.y, p.x, p.y), false);
      }
    }
  }
}

export function drawEnemies(ctx, enemies, t) {
  for (const e of enemies) {
    if (e.down) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#5b2d8e';
      ctx.fillRect(-9, -5, 18, 10);
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 7, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(-4, 1, 3, 8);
    ctx.fillRect(1, 1, 3, 8);
    ctx.fillStyle = '#5b2d8e'; // Viper gang purple
    ctx.fillRect(-7, -8, 14, 11);
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(0, -12, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -15, 12, 3);
    // health bar
    ctx.fillStyle = '#333';
    ctx.fillRect(-10, -22, 20, 3);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-10, -22, 20 * Math.max(0, e.hp / 60), 3);
    ctx.restore();
  }
}

export function drawMissionMarkers(ctx, game, cam) {
  const st = game.mission;
  if (!st || st.done) return;
  // sea packages
  if (st.index === 2 && st.step === 1) {
    for (const k of st.packages) {
      if (k.taken) continue;
      ctx.save();
      ctx.translate(k.x, k.y + Math.sin(performance.now() / 300) * 3);
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(-9, -7, 18, 14);
      ctx.fillStyle = '#7a4a00';
      ctx.fillRect(-9, -2, 18, 3);
      ctx.restore();
    }
  }
  const tgt = missionTarget(game);
  if (!tgt) return;
  // pulsing beacon at the target
  const pulse = 1 + Math.sin(performance.now() / 250) * 0.15;
  ctx.save();
  ctx.translate(tgt.x, tgt.y);
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#111';
  ctx.fillText('◆', 0, -34);
  ctx.restore();
}
