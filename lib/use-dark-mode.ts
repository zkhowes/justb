"use client";

import { useEffect, useState } from "react";

/**
 * Computes whether the local hour falls in night (< 5 or >= 21) and toggles
 * the `theme-night` class on the document root so CSS variables flip globally.
 * Returns the boolean for components that need to render differently
 * (e.g. moon vs. sun in the masthead).
 */
export function useDarkMode(): boolean {
  const [isNight, setIsNight] = useState<boolean>(false);

  useEffect(() => {
    function compute() {
      const hour = new Date().getHours();
      const night = hour < 5 || hour >= 21;
      setIsNight(night);
      document.documentElement.classList.toggle("theme-night", night);
    }
    compute();
    // Re-check every 10 minutes in case the app stays open across the boundary.
    const id = setInterval(compute, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return isNight;
}
