// NOVA Centralized Travel State Machine (ES6 Module)
// Single source of truth for camera travel phase: 'idle' | 'traveling' | 'settling' | 'arrived'

export const travelBus = new EventTarget();

let phase = "idle";
document.documentElement.dataset.travel = phase;

export function getTravelPhase() {
  return phase;
}


function announceArrivalCallout() {
  if (typeof document === "undefined") return;
  let liveEl = document.getElementById("nova-aria-live");
  if (!liveEl) {
    liveEl = document.createElement("div");
    liveEl.id = "nova-aria-live";
    liveEl.className = "nova-sr-only";
    liveEl.setAttribute("aria-live", "polite");
    liveEl.setAttribute("aria-atomic", "true");
    document.body.appendChild(liveEl);
  }
  setTimeout(() => {
    const name = document.getElementById("spatial-target-name")?.textContent?.trim() || "";
    const meta = document.getElementById("spatial-target-meta")?.textContent?.trim() || "";
    const summary = document.getElementById("spatial-target-summary")?.textContent?.trim() || "";
    const msg = [name, meta, summary].filter(Boolean).join(". ");
    if (msg) liveEl.textContent = msg;
  }, 150);
}

export function setTravelPhase(next) {
  if (next === phase) return;
  phase = next;
  document.documentElement.dataset.travel = next;
  if (next === "arrived") announceArrivalCallout();
  travelBus.dispatchEvent(new CustomEvent("phase", { detail: next }));
}

// Temporary bridge for legacy inline scripts during Phase 1 modularization
window.novaState = {
  travelBus,
  getTravelPhase,
  setTravelPhase
};
