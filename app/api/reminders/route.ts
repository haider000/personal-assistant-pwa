import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/guards";
import { getRepositories } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const repos = getRepositories();
  const reminders = repos.reminders.listUpcoming(100);
  return NextResponse.json({ reminders });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as { content?: string; remindAt?: string };
  if (!body.content || !body.remindAt) {
    return NextResponse.json({ error: "content and remindAt are required" }, { status: 400 });
  }

  const repos = getRepositories();
  const reminder = repos.reminders.add(body.content.trim(), body.remindAt);
  return NextResponse.json({ reminder }, { status: 201 });
}
