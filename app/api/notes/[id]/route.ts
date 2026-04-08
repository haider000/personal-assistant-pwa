import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/guards";
import { getRepositories } from "@/lib/repositories";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const noteId = Number(id);

  if (!Number.isInteger(noteId)) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }

  const repos = getRepositories();
  const deleted = repos.notes.delete(noteId);

  if (!deleted) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
