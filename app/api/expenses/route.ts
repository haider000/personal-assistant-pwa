import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/guards";
import { getRepositories } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

  const repos = getRepositories();
  const expenses = repos.expenses.list(limit);

  return NextResponse.json({ expenses });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as {
    amount?: number;
    category?: string;
    date?: string;
  };

  if (!body.amount || !body.category) {
    return NextResponse.json({ error: "amount and category are required" }, { status: 400 });
  }

  const repos = getRepositories();
  const expense = repos.expenses.add(
    Number(body.amount),
    body.category.trim(),
    body.date ?? new Date().toISOString()
  );

  return NextResponse.json({ expense }, { status: 201 });
}
