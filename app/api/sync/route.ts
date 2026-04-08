import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/guards";
import { processChatMessage } from "@/lib/chat/brain";

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as {
    queue?: Array<{ message: string; createdAt: string }>;
  };

  const queue = body.queue ?? [];
  if (!Array.isArray(queue)) {
    return NextResponse.json({ error: "queue must be an array" }, { status: 400 });
  }

  const synced = queue
    .filter((item) => item?.message?.trim())
    .map((item) => processChatMessage(item.message.trim(), item.createdAt));

  return NextResponse.json({ synced });
}
