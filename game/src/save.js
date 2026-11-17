// Save / load through localStorage. Stores cash, mission progress, player
// position, owned pistol/ammo and the best wanted level survived.
const KEY = 'marina-bay-smugglers-run-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      cash: state.player.cash,
      missionIndex: state.missionIndex,
      completed: state.completedMissions.slice(),
      hasPistol: state.player.hasPistol,
      ammo: state.player.ammo,
      px: state.player.x,
      py: state.player.y,
      maxWanted: state.maxWanted,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
}
