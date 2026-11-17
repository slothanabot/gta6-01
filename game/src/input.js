// input.js — keyboard + mouse state. WASD moves relative to the camera,
// mouse drag orbits the camera yaw slightly, click attacks / shoots.
export function createInput() {
  const keys = {};
  const state = { keys, mouseDown: false, mouseDX: 0, mouseDY: 0, clicked: false, orbitDX: 0 };
  let lastX = 0, dragging = false;

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  const canvas = document.getElementById('scene');
  canvas.addEventListener('mousedown', (e) => {
    state.mouseDown = true; state.clicked = true; dragging = true; lastX = e.clientX;
  });
  window.addEventListener('mouseup', () => { state.mouseDown = false; dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (dragging) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      state.orbitDX += dx;
    }
  });
  return state;
}

export function consumeClick(input) {
  const c = input.clicked;
  input.clicked = false;
  return c;
}
