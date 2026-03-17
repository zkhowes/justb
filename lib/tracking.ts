"use client";

export function getSessionId(): string {
  const key = "justb-session-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export async function trackSession(
  city: string,
  itemCount: number
): Promise<number | null> {
  try {
    const res = await fetch("/api/preview/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: getSessionId(),
        city,
        feedItemCount: itemCount,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id ?? null;
  } catch {
    return null;
  }
}

export function trackScrollDepth(
  sessionDbId: number,
  cardsViewed: number,
  totalCards: number
) {
  const scrollDepth = totalCards > 0 ? cardsViewed / totalCards : 0;
  const body = JSON.stringify({
    id: sessionDbId,
    cardsViewed,
    scrollDepth: Math.round(scrollDepth * 100) / 100,
  });
  navigator.sendBeacon("/api/preview/session", body);
}
