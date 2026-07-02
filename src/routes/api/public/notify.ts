import { createFileRoute } from "@tanstack/react-router";

const CHAT_ID = "-1003957750577";

interface NotifyPayload {
  event?: string;
  path?: string;
  username?: string;
  label?: string;
  extra?: string;
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function esc(s: string) {
  return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
}

export const Route = createFileRoute("/api/public/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return Response.json({ ok: false, error: "no token" }, { status: 200 });

        let body: NotifyPayload = {};
        try {
          body = (await request.json()) as NotifyPayload;
        } catch {
          return Response.json({ ok: false, error: "bad json" }, { status: 200 });
        }

        const event = truncate(String(body.event ?? "event"), 40);
        const path = truncate(String(body.path ?? "/"), 80);
        const username = body.username ? truncate(String(body.username), 32) : "guest";
        const label = body.label ? truncate(String(body.label), 80) : "";
        const extra = body.extra ? truncate(String(body.extra), 160) : "";

        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "";
        const ua = truncate(request.headers.get("user-agent") ?? "", 80);

        const lines = [
          `<b>PrimeCapital</b> · <code>${esc(event)}</code>`,
          `👤 <b>${esc(username)}</b>`,
          `📍 <code>${esc(path)}</code>`,
        ];
        if (label) lines.push(`🔘 ${esc(label)}`);
        if (extra) lines.push(`ℹ️ ${esc(extra)}`);
        if (ip) lines.push(`🌐 <code>${esc(ip)}</code>`);
        if (ua) lines.push(`🧭 ${esc(ua)}`);

        const text = lines.join("\n");

        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chat_id: CHAT_ID,
              text,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
          });
          if (!res.ok) {
            const t = await res.text();
            console.error("[notify] telegram error", res.status, t);
            return Response.json({ ok: false }, { status: 200 });
          }
        } catch (err) {
          console.error("[notify] fetch failed", err);
          return Response.json({ ok: false }, { status: 200 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
