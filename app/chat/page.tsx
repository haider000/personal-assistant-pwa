import { redirect } from "next/navigation";

import ChatClient from "@/components/chat-client";
import { isAuthenticatedFromCookies } from "@/lib/auth/session";

export default async function ChatPage() {
  const authenticated = await isAuthenticatedFromCookies();
  if (!authenticated) {
    redirect("/login");
  }

  return <ChatClient />;
}
