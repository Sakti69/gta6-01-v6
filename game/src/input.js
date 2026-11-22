// Keyboard + mouse state with edge detection (pressed = went down this frame).
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressedKeys: new Set(),
    mouseX: 0, mouseY: 0, mouseDown: false, mousePressed: false,
    mouseWorldX: 0, mouseWorldY: 0,
    attach() {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        if (!e.repeat) { this.keys.add(e.code); this.pressedKeys.add(e.code); }
      });
      window.addEventListener('keyup', (e) => this.keys.delete(e.code));
      window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top;
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { this.mouseDown = true; this.mousePressed = true; }
      });
      window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    down(code) { return this.keys.has(code); },
    pressed(code) { return this.pressedKeys.has(code); },
    anyPressed(codes) { return codes.some((c) => this.pressedKeys.has(c)); },
    // WASD or arrows as a -1..1 vector.
    moveVector() {
      let x = 0, y = 0;
      if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
      if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
      if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
      if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
      return { x, y };
    },
    endFrame() { this.pressedKeys.clear(); this.mousePressed = false; },
  };
  return input;
}
