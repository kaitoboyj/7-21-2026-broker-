// Install Buffer on globalThis before any crypto lib chunk loads.
import { Buffer as B } from "buffer";
(globalThis as any).Buffer = B;
if (typeof window !== "undefined") (window as any).Buffer = B;

import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
