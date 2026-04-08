import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/guards";
import { getRepositories } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const rangeParam = request.nextUrl.searchParams.get("range") ?? "daily";
  const range = ["daily", "weekly", "monthly"].includes(rangeParam)
    ? (rangeParam as "daily" | "weekly" | "monthly")
    : "daily";

  const repos = getRepositories();
  const report = repos.expenses.report(range);

  return NextResponse.json({ range, ...report });
}
