// NOVA Shareable URL Hash Deep-Linking (#target=<id> / #tier=<0-4>)

let _suppressHashSync = false;

export function parseDeepLinkHash(hashStr = window.location.hash) {
  const raw = (hashStr || "").replace(/^#/, "").trim();
  if (!raw) return null;

  const params = new URLSearchParams(raw.includes("=") ? raw : `target=${raw}`);
  const target = params.get("target");
  const tierRaw = params.get("tier");

  if (target) {
    return { type: "target", value: target.trim().toLowerCase() };
  }
  if (tierRaw !== null) {
    const tier = parseInt(tierRaw, 10);
    if (!Number.isNaN(tier) && tier >= 0 && tier <= 4) {
      return { type: "tier", value: tier };
    }
  }
  return null;
}

export function setDeepLinkTarget(id) {
  if (_suppressHashSync || !id) return;
  const nextHash = `#target=${encodeURIComponent(String(id).toLowerCase())}`;
  if (window.location.hash !== nextHash) {
    history.replaceState(null, "", nextHash);
  }
}

export function setDeepLinkTier(tier) {
  if (_suppressHashSync) return;
  const t = Number(tier);
  if (Number.isNaN(t) || t <= 0) {
    if (window.location.hash.startsWith("#tier=")) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    return;
  }
  const nextHash = `#tier=${t}`;
  if (window.location.hash !== nextHash) {
    history.replaceState(null, "", nextHash);
  }
}

export function applyDeepLinkFromHash({ celestialObjects, filterTier, novaSlewToMesh }) {
  const parsed = parseDeepLinkHash();
  if (!parsed) return false;

  if (parsed.type === "tier") {
    if (typeof filterTier === "function") {
      _suppressHashSync = true;
      filterTier(parsed.value);
      _suppressHashSync = false;
      return true;
    }
    return false;
  }

  if (parsed.type === "target" && Array.isArray(celestialObjects)) {
    const query = parsed.value;
    const match = celestialObjects.find((m) => {
      if (!m || !m.userData) return false;
      const id = (m.userData.id || "").toLowerCase();
      const name = (m.userData.name || "").toLowerCase();
      return id === query || name === query;
    });

    if (match && typeof novaSlewToMesh === "function") {
      _suppressHashSync = true;
      if (typeof filterTier === "function" && match.userData.tier) {
        filterTier(0);
      }
      if (typeof match.updateMatrixWorld === 'function') match.updateMatrixWorld(true);
      novaSlewToMesh(match);
      _suppressHashSync = false;
      return true;
    }
  }
  return false;
}

let _deepLinkInitialized = false;

export function initDeepLinks(ctx) {
  if (!_deepLinkInitialized) {
    _deepLinkInitialized = true;
    window.addEventListener("hashchange", () => {
      applyDeepLinkFromHash(ctx);
    });
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => applyDeepLinkFromHash(ctx), 250);
    });
  });
}
