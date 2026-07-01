import { createFileRoute } from "@tanstack/react-router";

const FEED_URL = "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml";
const cache = new Map<string, { data: NewsItem[]; expires: number; fetchedAt: number }>();
const TTL = 60_000;
const STALE_TTL = 15 * 60_000;

interface NewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  image?: string;
}

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        const hit = cache.get("main");
        if (hit && hit.expires > now) {
          return Response.json(hit.data, { headers: { "cache-control": "public, max-age=30" } });
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8_000);
          const res = await fetch(FEED_URL, {
            headers: {
              accept: "application/rss+xml, application/xml, text/xml",
              "user-agent": "PrimeCapital/1.0 (+https://primecapital.app)",
            },
            signal: controller.signal,
          }).finally(() => clearTimeout(timeout));

          if (!res.ok) throw new Error(`upstream ${res.status}`);
          const xml = await res.text();
          const data = parseFeed(xml).slice(0, 24);
          cache.set("main", { data, expires: now + TTL, fetchedAt: now });
          return Response.json(data, { headers: { "cache-control": "public, max-age=30" } });
        } catch (err) {
          console.error("[api/news] upstream fetch failed:", err);
          if (hit && now - hit.fetchedAt < STALE_TTL) {
            return Response.json(hit.data, { headers: { "cache-control": "public, max-age=10" } });
          }
          return Response.json([], { status: 200, headers: { "cache-control": "no-store", "x-upstream-error": "1" } });
        }
      },
    },
  },
});

function parseFeed(xml: string): NewsItem[] {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match, index) => {
    const item = match[0];
    const title = clean(readTag(item, "title"));
    const url = clean(readTag(item, "link"));
    const guid = clean(readTag(item, "guid")) || url || `news-${index}`;
    const summary = clean(readTag(item, "description") || readTag(item, "content:encoded"));
    const published = clean(readTag(item, "pubDate"));
    const image = readImage(item, summary);
    return {
      id: guid,
      title,
      url,
      summary: summary.slice(0, 240),
      publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
      image,
    };
  }).filter((item) => item.title && item.url);
}

function readTag(source: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i");
  return source.match(re)?.[1] ?? "";
}

function readImage(item: string, summary: string): string | undefined {
  const media = item.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1]
    ?? item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1]
    ?? item.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\//i)?.[1]
    ?? summary.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  return media ? decodeEntities(media) : undefined;
}

function clean(value: string): string {
  return decodeEntities(value)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}