// shots.js — screenshot mode (?shot=start|drive|combat|beach): stages the game into
// a photogenic state so the 3–4 screenshots are real renders of live gameplay.
export function parseShot() {
  const q = new URLSearchParams(location.search);
  return q.get('shot') || null;
}

// Called after the world is built, before the first presented frame.
// Returns a setup object the main loop applies once the game starts.
export function shotSetup(shot) {
  switch (shot) {
    case 'start':
      return { menu: true, camOrbit: true };
    case 'drive':
      return {
        autoStart: true, inCar: true, wanted: 3, cash: 1250, missionIndex: 2,
        carPos: { x: 0, z: 60 }, carHeading: Math.PI, speed: 24,
        police: true, policePos: { x: 5, z: 22 },
      };
    case 'combat':
      return {
        autoStart: true, wanted: 2, cash: 900, missionIndex: 3,
        playerPos: { x: -150, z: 184 }, playerHeading: -0.74,
        weapon: 'pistol', gang: true, ally: true, allyArmed: true,
        police: false,
      };
    case 'beach':
      return {
        autoStart: true, wanted: 0, cash: 650, missionIndex: 1,
        playerPos: { x: 178, z: -30 }, playerHeading: -Math.PI / 2,
        weapon: 'fists', missionTarget: { x: 156, y: 0, z: -20 },
      };
    default:
      return { menu: true };
  }
}
