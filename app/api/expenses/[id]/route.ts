import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/guards";
import { getRepositories } from "@/lib/repositories";

export async function DELETE(request: NextRequest, context: RouteContext<"/api/expenses/[id]">) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const expenseId = Number(id);

  if (!Number.isFinite(expenseId) || expenseId <= 0) {
    return NextResponse.json({ error: "Invalid expense id" }, { status: 400 });
  }

  const deleted = getRepositories().expenses.delete(expenseId);
  return NextResponse.json({ deleted });
}
