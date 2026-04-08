import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/guards";
import { processChatMessage } from "@/lib/chat/brain";

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as { message?: string; createdAt?: string };
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const result = processChatMessage(message, body.createdAt);
  return NextResponse.json(result);
}
