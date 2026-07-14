import { getCookie, useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

const SESSION_NAME = "prime-admin-session";

interface AdminSession {
  unlocked?: boolean;
}

function sessionConfig() {
  return {
    password: process.env.ADMIN_SESSION_SECRET!,
    name: SESSION_NAME,
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export function timingSafeStrEq(a: string, b: string) {
  const ah = createHash("sha256").update(a, "utf8").digest();
  const bh = createHash("sha256").update(b, "utf8").digest();
  return ah.length === bh.length && timingSafeEqual(ah, bh);
}

export async function createAdminSession() {
  return useSession<AdminSession>(sessionConfig());
}

export async function requireAdminUnlocked() {
  const session = await createAdminSession();
  if (!session.data?.unlocked) throw new Response("Unauthorized", { status: 401 });
  return session;
}

export async function isAdminUnlocked() {
  if (!getCookie(SESSION_NAME)) return false;
  try {
    const session = await createAdminSession();
    return !!session.data?.unlocked;
  } catch {
    return false;
  }
}