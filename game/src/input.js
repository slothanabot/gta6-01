// Keyboard + mouse input. Tracks held keys, pressed-this-frame keys and
// the mouse position in screen and world coordinates.
export function makeInput(canvas) {
  const keys = {};
  const pressed = {};
  const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, clicked: false };

  function code(e) {
    return e.code;
  }
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    keys, pressed, mouse,
    held(...codes) { return codes.some((c) => keys[c]); },
    wasPressed(...codes) { return codes.some((c) => pressed[c]); },
    endFrame() {
      for (const k of Object.keys(pressed)) pressed[k] = false;
      mouse.clicked = false;
    },
  };
}
