import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { env, hasRequiredAuthEnv } from "@/lib/config/env";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: NextRequest) {
  if (!hasRequiredAuthEnv()) {
    return NextResponse.json(
      { error: "Server auth environment is not configured." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as { password?: string };
  const password = body.password?.trim() ?? "";

  if (!safeEqual(password, env.appPassword)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
