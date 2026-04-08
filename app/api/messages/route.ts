import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/guards";
import { getRepositories } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const repos = getRepositories();
  const messages = repos.messages.list(250);

  return NextResponse.json({ messages });
}
