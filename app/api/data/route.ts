import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/guards";
import { getRepositories } from "@/lib/repositories";

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const scope = request.nextUrl.searchParams.get("scope");
  const repos = getRepositories();

  if (scope === "month") {
    const deleted = repos.expenses.clearMonth(new Date());
    return NextResponse.json({ deleted, scope });
  }

  if (scope === "all") {
    const deletedExpenses = repos.expenses.clearAll();
    const deletedNotes = repos.notes.clear();
    const deletedReminders = repos.reminders.clear();
    repos.messages.clear();

    return NextResponse.json({
      scope,
      deleted: {
        expenses: deletedExpenses,
        notes: deletedNotes,
        reminders: deletedReminders,
        messages: true,
      },
    });
  }

  return NextResponse.json({ error: "scope must be 'all' or 'month'" }, { status: 400 });
}
