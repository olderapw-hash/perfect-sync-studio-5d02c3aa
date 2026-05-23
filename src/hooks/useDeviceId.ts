const STORAGE_KEY = "orphea_device_id";

/**
 * Returns a stable UUID for this browser, persisted in localStorage.
 * Generated lazily on first call.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 16) return existing;
    const id =
      crypto.randomUUID?.() ??
      // eslint-disable-next-line no-bitwise
      Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Fallback for SSR / disabled storage
    return "no-storage-" + Math.random().toString(36).slice(2);
  }
}
