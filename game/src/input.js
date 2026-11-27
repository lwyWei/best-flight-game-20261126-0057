// Keyboard and mouse. Arrows pitch and bank, A/D rudder, W/S and Shift/Ctrl
// throttle, G gear, C camera, P pause, R restart, M sound, Space/click to
// start. Dragging with the mouse also steers: the pointer's offset from the
// centre of the screen becomes the stick.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_CAMERA = 8;
export const ACTION_MUTE = 16;
export const ACTION_GEAR = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let dragging = false;
  let dragX = 0;
  let dragY = 0;
  let dragActive = false;

  function down(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
    if (event.code === 'KeyC') actions |= ACTION_CAMERA;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'KeyG') actions |= ACTION_GEAR;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function up(event) {
    keys.delete(event.code);
  }
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragActive = false;
    dragX = 0;
    dragY = 0;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragActive = true;
    dragX = (event.clientX / window.innerWidth - 0.5) * 2;
    dragY = (event.clientY / window.innerHeight - 0.5) * 2;
  });
  function endDrag(event) {
    if (dragging && !dragActive) actions |= ACTION_CONFIRM;
    dragging = false;
    dragActive = false;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /** Current stick + throttle held this frame; call once per step. */
  function control(throttle, dt) {
    let pitch = 0;
    let roll = 0;
    let yaw = 0;
    if (keys.has('ArrowUp')) pitch += 1;
    if (keys.has('ArrowDown')) pitch -= 1;
    if (keys.has('ArrowLeft')) roll -= 1;
    if (keys.has('ArrowRight')) roll += 1;
    if (keys.has('KeyA')) yaw -= 1;
    if (keys.has('KeyD')) yaw += 1;
    if (dragActive) {
      roll += Math.max(-1, Math.min(1, dragX * 1.4));
      pitch += Math.max(-1, Math.min(1, -dragY * 1.2));
    }
    let thr = throttle;
    if (keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight')) thr += 0.55 * dt;
    if (keys.has('KeyS') || keys.has('ControlLeft') || keys.has('ControlRight')) thr -= 0.55 * dt;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      yaw: Math.max(-1, Math.min(1, yaw)),
      throttle: Math.max(0, Math.min(1, thr)),
    };
  }

  function takeActions() {
    const a = actions;
    actions = 0;
    return a;
  }

  return { control, takeActions };
}
