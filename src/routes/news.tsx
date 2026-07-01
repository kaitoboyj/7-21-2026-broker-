import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Newspaper, Radio } from "lucide-react";
import { newsQuery, type NewsItem } from "@/lib/news";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Crypto News — PrimeCapital" },
      { name: "description", content: "Live crypto market headlines, analysis, and breaking digital asset updates." },
      { property: "og:title", content: "Crypto News — PrimeCapital" },
      { property: "og:description", content: "Live crypto market headlines and digital asset updates." },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { data, isLoading } = useQuery(newsQuery);
  const items = data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary/90 font-medium">
            <Radio className="h-3.5 w-3.5" /> Live Desk
          </p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-semibold">Crypto news</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Breaking digital asset headlines refreshed automatically as new stories publish.
          </p>
        </div>
        <Link to="/trade" className="inline-flex items-center gap-2 rounded-lg glass px-4 py-2 text-sm font-semibold hover:bg-white/10">
          Open terminal <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="glass rounded-xl h-64 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 glass-strong rounded-2xl p-10 text-center">
          <Newspaper className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">News is temporarily unavailable.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => <NewsCard key={item.id} item={item} priority={index < 3} />)}
        </div>
      )}
    </div>
  );
}

function NewsCard({ item, priority }: { item: NewsItem; priority: boolean }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="group glass rounded-xl overflow-hidden transition hover:-translate-y-0.5 hover:bg-white/[.06]">
      <div className="aspect-[16/9] bg-white/5 overflow-hidden">
        {item.image ? (
          <img src={item.image} alt="" loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[image:var(--gradient-hero)]">
            <Newspaper className="h-10 w-10 text-primary/80" />
          </div>
        )}
      </div>
      <div className="p-5">
        <time className="text-[11px] uppercase tracking-widest text-muted-foreground" dateTime={item.publishedAt}>
          {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.publishedAt))}
        </time>
        <h2 className="mt-2 line-clamp-3 font-display text-lg font-semibold leading-tight group-hover:text-primary transition-colors">{item.title}</h2>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
      </div>
    </a>
  );
}