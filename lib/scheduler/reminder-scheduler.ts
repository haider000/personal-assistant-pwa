import cron from "node-cron";

import { getRepositories } from "@/lib/repositories";

declare global {
  var __pa_scheduler_started__: boolean | undefined;
}

export function startReminderScheduler() {
  if (global.__pa_scheduler_started__) return;

  const repos = getRepositories();

  cron.schedule("* * * * *", () => {
    const due = repos.reminders.listDue(new Date().toISOString());
    for (const reminder of due) {
      repos.messages.add("bot", `⏰ Reminder: ${reminder.content}`);
      repos.reminders.markDelivered(reminder.id);
    }
  });

  global.__pa_scheduler_started__ = true;
}
