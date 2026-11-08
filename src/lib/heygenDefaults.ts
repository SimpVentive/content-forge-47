// Default HeyGen configuration. Seeded into localStorage on app boot
// so video mode works without requiring admins to manually paste the
// key into the HeyGen Settings screen.

export interface HeyGenConfig {
  apiKey: string;
  accountId: string;
  defaultAvatar: string;
  defaultVideoQuality: string;
  costPerMinute: number;
}

export const HEYGEN_DEFAULTS: HeyGenConfig = {
  // The API key is not stored in the app. Keys belong on the server, not in source code.
  apiKey: "",
  accountId: "default",
  defaultAvatar: "rachel",
  defaultVideoQuality: "1080p",
  costPerMinute: 5,
};

const STORAGE_KEY = "heygenSettings";

export function seedHeyGenSettings() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(HEYGEN_DEFAULTS));
      return;
    }
    const parsed = JSON.parse(existing);
    if (!parsed?.apiKey) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...HEYGEN_DEFAULTS, ...parsed, apiKey: HEYGEN_DEFAULTS.apiKey })
      );
    }
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(HEYGEN_DEFAULTS));
  }
}

export function getHeyGenSettings(): HeyGenConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.apiKey) return { ...HEYGEN_DEFAULTS, ...parsed };
    }
  } catch {
    // fall through
  }
  return HEYGEN_DEFAULTS;
}
