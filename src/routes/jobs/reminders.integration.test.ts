import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { shouldEmitEventDay } from "../../services/reminder-engine.js";
import { runEventReminders } from "../../services/run-event-reminders.js";

/** Evento company no seed — público com contas activas */
const INTEGRATION_EVENT = "e0000000-0000-4000-8000-000000000014";
const REMINDER_KINDS = ["event_reminder_1h", "event_reminder_15m", "event_day"] as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} for integration test`);
  return value;
}

/**
 * Integração real (SC-004): requer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *   INTEGRATION=1 pnpm test:integration
 */
describe.skipIf(!process.env.INTEGRATION)("POST /jobs/event-reminders integration", () => {
  it(
    "inserts three reminder kinds for a future event",
    async () => {
      const supabase = createClient(
        requireEnv("SUPABASE_URL"),
        requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
        { auth: { persistSession: false, autoRefreshToken: false } },
      );

      await supabase
        .from("notifications")
        .delete()
        .eq("event_id", INTEGRATION_EVENT)
        .in("kind", [...REMINDER_KINDS]);

      const startsAt = new Date(Date.now() + 55 * 60 * 1000);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

      await supabase
        .from("events")
        .update({
          status: "active",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
        })
        .eq("id", INTEGRATION_EVENT);

      const now1h = new Date(startsAt.getTime() - 55 * 60 * 1000);
      const r1 = await runEventReminders(supabase, now1h);
      expect(r1.inserted + r1.skipped).toBeGreaterThan(0);

      const startsAt15 = new Date(Date.now() + 12 * 60 * 1000);
      const endsAt15 = new Date(startsAt15.getTime() + 30 * 60 * 1000);
      await supabase
        .from("events")
        .update({
          starts_at: startsAt15.toISOString(),
          ends_at: endsAt15.toISOString(),
        })
        .eq("id", INTEGRATION_EVENT);

      await supabase
        .from("notifications")
        .delete()
        .eq("event_id", INTEGRATION_EVENT)
        .eq("kind", "event_reminder_15m");

      const now15 = new Date(startsAt15.getTime() - 10 * 60 * 1000);
      const r2 = await runEventReminders(supabase, now15);
      expect(r2.inserted).toBeGreaterThan(0);

      const dayStart = new Date();
      dayStart.setUTCHours(14, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 60 * 60 * 1000);
      await supabase
        .from("events")
        .update({
          starts_at: dayStart.toISOString(),
          ends_at: dayEnd.toISOString(),
        })
        .eq("id", INTEGRATION_EVENT);

      const { data: tenant } = await supabase
        .from("tenants")
        .select("timezone")
        .eq("id", "a0000000-0000-4000-8000-000000000010")
        .single();

      const tz = (tenant?.timezone as string | undefined) ?? "Europe/Lisbon";

      await supabase
        .from("notifications")
        .delete()
        .eq("event_id", INTEGRATION_EVENT)
        .eq("kind", "event_day");

      let nowDay = new Date(dayStart.getTime() - 2 * 60 * 60 * 1000);
      for (let i = 0; i < 24 && !shouldEmitEventDay(dayStart, nowDay, tz); i += 1) {
        nowDay = new Date(nowDay.getTime() + 60 * 60 * 1000);
      }
      expect(shouldEmitEventDay(dayStart, nowDay, tz)).toBe(true);

      const r3 = await runEventReminders(supabase, nowDay);
      expect(r3.inserted).toBeGreaterThan(0);

      const { data: rows, error: listError } = await supabase
        .from("notifications")
        .select("kind, recipient_user_id")
        .eq("event_id", INTEGRATION_EVENT)
        .in("kind", [...REMINDER_KINDS]);

      expect(listError).toBeNull();
      const kinds = new Set((rows ?? []).map((r) => r.kind));
      expect(kinds.has("event_reminder_1h")).toBe(true);
      expect(kinds.has("event_reminder_15m")).toBe(true);
      expect(kinds.has("event_day")).toBe(true);
      expect(new Set((rows ?? []).map((r) => r.recipient_user_id)).size).toBeGreaterThan(0);
    },
    120_000,
  );
});
