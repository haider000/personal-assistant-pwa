import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { env } from "@/lib/config/env";

const secret = new TextEncoder().encode(env.jwtSecret);
export const SESSION_COOKIE = "pa_session";

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ scope: "private-assistant" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(token?: string | null): Promise<boolean> {
  if (!token) return false;

  try {
    await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return true;
  } catch {
    return false;
  }
}

export async function isAuthenticatedFromCookies(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}
