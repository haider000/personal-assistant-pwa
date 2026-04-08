import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/guards";
import { getRepositories } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const repos = getRepositories();
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const notes = q ? repos.notes.search(q) : repos.notes.list();

  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as { content?: string; tags?: string[] };
  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const repos = getRepositories();
  const note = repos.notes.add(content, body.tags ?? []);

  return NextResponse.json({ note }, { status: 201 });
}
