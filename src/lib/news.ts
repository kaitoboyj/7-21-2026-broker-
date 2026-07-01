import { queryOptions } from "@tanstack/react-query";

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  image?: string;
}

export async function fetchNews(): Promise<NewsItem[]> {
  const res = await fetch("/api/news");
  if (!res.ok) throw new Error("Failed to fetch news");
  return res.json();
}

export const newsQuery = queryOptions({
  queryKey: ["news"],
  queryFn: fetchNews,
  staleTime: 60_000,
  refetchInterval: 60_000,
});