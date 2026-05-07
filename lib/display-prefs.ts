"use client";

import { useEffect, useState, useCallback } from "react";

// User-toggleable display preferences. Stored in localStorage so they persist
// across sessions and don't require a server round-trip. Default = new behavior;
// toggle off to compare against the original render.

export type DisplayPrefs = {
  /** Use the new layered/variant feed renderer */
  newFeed: boolean;
  /** Vary card layouts by category (hero, quote, stat, minimal) */
  variants: boolean;
  /** Show structured fact chips above the body */
  chips: boolean;
};

export const DEFAULT_PREFS: DisplayPrefs = {
  newFeed: true,
  variants: true,
  chips: true,
};

const STORAGE_KEY = "justb:displayPrefs";
const EVENT_NAME = "justb:displayPrefsChange";

function readFromStorage(): DisplayPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<DisplayPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Read+write hook. Same-tab updates broadcast via a custom event so all
 *  consumers stay in sync without a full page reload. */
export function useDisplayPrefs(): [DisplayPrefs, (next: Partial<DisplayPrefs>) => void] {
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(readFromStorage());
    const onChange = () => setPrefs(readFromStorage());
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onChange); // cross-tab
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = useCallback((next: Partial<DisplayPrefs>) => {
    const merged = { ...readFromStorage(), ...next };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
    setPrefs(merged);
  }, []);

  return [prefs, update];
}
