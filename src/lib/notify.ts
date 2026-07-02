// Client helper to send activity notifications to the Telegram group via
// our same-origin server route. All events are best-effort and never block UX.

import { loadSession } from "@/lib/wallet-auth";

export interface NotifyEvent {
  event: string;
  label?: string;
  extra?: string;
  path?: string;
}

export function notify(evt: NotifyEvent) {
  if (typeof window === "undefined") return;
  try {
    const session = loadSession();
    const payload = {
      event: evt.event,
      label: evt.label,
      extra: evt.extra,
      path: evt.path ?? window.location.pathname,
      username: session?.username,
    };
    const body = JSON.stringify(payload);
    // Use fetch with keepalive so nav-away events still fire.
    fetch("/api/public/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
