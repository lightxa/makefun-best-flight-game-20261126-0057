// Keyboard and pointer input. Held keys steer the plane; one-shot presses (start,
// pause, mission select, flaps, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_FLAPS = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

const THROTTLE_UP = new Set(['KeyW']);
const THROTTLE_DOWN = new Set(['KeyS']);
const PITCH_UP = new Set(['ArrowUp']);
const PITCH_DOWN = new Set(['ArrowDown']);
const BANK_LEFT = new Set(['ArrowLeft', 'KeyA']);
const BANK_RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const FLAPS = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);
const MISSION_KEYS = new Set(['Digit1', 'Digit2', 'Digit3']);

export function createInput(target) {
  let throttleUp = false;
  let throttleDown = false;
  let pitchUp = false;
  let pitchDown = false;
  let bankLeft = false;
  let bankRight = false;
  let actions = 0;
  let missionChoice = 0;

  window.addEventListener('keydown', (event) => {
    if (THROTTLE_UP.has(event.code)) throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = true;
    else if (PITCH_UP.has(event.code)) pitchUp = true;
    else if (PITCH_DOWN.has(event.code)) pitchDown = true;
    else if (BANK_LEFT.has(event.code)) bankLeft = true;
    else if (BANK_RIGHT.has(event.code)) bankRight = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (FLAPS.has(event.code)) { if (!event.repeat) actions |= ACTION_FLAPS; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (RESTART.has(event.code)) { if (!event.repeat) actions |= ACTION_RESTART; }
    else if (MISSION_KEYS.has(event.code)) {
      if (!event.repeat) missionChoice = Number(event.code.slice(-1));
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (THROTTLE_UP.has(event.code)) throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = false;
    else if (PITCH_UP.has(event.code)) pitchUp = false;
    else if (PITCH_DOWN.has(event.code)) pitchDown = false;
    else if (BANK_LEFT.has(event.code)) bankLeft = false;
    else if (BANK_RIGHT.has(event.code)) bankRight = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    throttleUp = throttleDown = pitchUp = pitchDown = bankLeft = bankRight = false;
  });
  target.addEventListener('pointerdown', () => { actions |= ACTION_CONFIRM; });

  return {
    /** -1 down, 1 up: throttle lever held. */
    throttleDirection() { return (throttleUp ? 1 : 0) - (throttleDown ? 1 : 0); },
    /** -1 climb, 1 dive: elevator held. */
    pitchDirection() { return (pitchDown ? 1 : 0) - (pitchUp ? 1 : 0); },
    /** -1 left, 1 right: aileron held. */
    bankDirection() { return (bankRight ? 1 : 0) - (bankLeft ? 1 : 0); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() { const taken = actions; actions = 0; return taken; },
    /** Mission number 1-3 chosen on the title screen since the last call, else 0. */
    takeMissionChoice() { const taken = missionChoice; missionChoice = 0; return taken; },
  };
}
