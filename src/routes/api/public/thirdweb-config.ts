import { createFileRoute } from "@tanstack/react-router";

// Publishable client ID for the thirdweb SDK. Safe to expose in the browser.
export const Route = createFileRoute("/api/public/thirdweb-config")({
  server: {
    handlers: {
      GET: async () => {
        const clientId = process.env.THIRDWEB_CLIENT_ID || "f5eb45838e1432573c621a486d7095da";
        return new Response(JSON.stringify({ clientId }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
