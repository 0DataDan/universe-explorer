// NOVA Centralized Travel State Machine (ES6 Module)
// Single source of truth for camera travel phase: 'idle' | 'traveling' | 'settling' | 'arrived'

export const travelBus = new EventTarget();

let phase = "idle";
document.documentElement.dataset.travel = phase;

export function getTravelPhase() {
  return phase;
}

export function setTravelPhase(next) {
  if (next === phase) return;
  phase = next;
  document.documentElement.dataset.travel = next;
  travelBus.dispatchEvent(new CustomEvent("phase", { detail: next }));
}

// Temporary bridge for legacy inline scripts during Phase 1 modularization
window.novaState = {
  travelBus,
  getTravelPhase,
  setTravelPhase
};
