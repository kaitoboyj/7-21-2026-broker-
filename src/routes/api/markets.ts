import { createFileRoute } from "@tanstack/react-router";

let cache: { data: unknown; expires: number } | null = null;
const TTL = 30_000;

export const Route = createFileRoute("/api/markets")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const perPage = Math.min(Number(url.searchParams.get("per_page") ?? 100), 250);

        if (cache && cache.expires > Date.now()) {
          return Response.json(cache.data, {
            headers: { "cache-control": "public, max-age=30" },
          });
        }

        const upstream = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=true&price_change_percentage=1h%2C24h%2C7d`;
        const res = await fetch(upstream, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          if (cache) {
            return Response.json(cache.data, {
              headers: { "cache-control": "public, max-age=10" },
            });
          }
          return new Response("Upstream error", { status: 502 });
        }
        const data = await res.json();
        cache = { data, expires: Date.now() + TTL };
        return Response.json(data, {
          headers: { "cache-control": "public, max-age=30" },
        });
      },
    },
  },
});
