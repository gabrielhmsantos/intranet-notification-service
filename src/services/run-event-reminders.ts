import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadEmployeeIdsForEvent,
  resolveRecipientUserIds,
} from "./audience.js";
import {
  buildReminderCopy,
  evaluateScheduledReminders,
  type ScheduledReminderKind,
} from "./reminder-engine.js";

type EventRow = {
  id: string;
  tenant_id: string;
  status: "active" | "canceled";
  title: string;
  starts_at: string;
  ends_at: string;
  audience_type: "company" | "department" | "employees";
  audience_department_id: string | null;
};

export type RunResult = { inserted: number; skipped: number };

export async function runEventReminders(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<RunResult> {
  const horizon = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const lookback = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data: events, error } = await supabase
    .from("events")
    .select(
      "id, tenant_id, status, title, starts_at, ends_at, audience_type, audience_department_id",
    )
    .eq("status", "active")
    .gte("starts_at", lookback.toISOString())
    .lte("starts_at", horizon.toISOString());

  if (error) throw new Error(error.message);

  let inserted = 0;
  let skipped = 0;

  for (const event of (events ?? []) as EventRow[]) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("timezone")
      .eq("id", event.tenant_id)
      .maybeSingle();

    const timeZone = (tenant?.timezone as string | undefined) ?? "Europe/Lisbon";
    const startsAt = new Date(event.starts_at);
    const endsAt = new Date(event.ends_at);

    const evaluations = evaluateScheduledReminders(
      startsAt,
      now,
      timeZone,
      event.status,
    );

    const dueKinds = evaluations.filter((e) => e.due).map((e) => e.kind);
    if (dueKinds.length === 0) {
      skipped += 1;
      continue;
    }

    let employeeIds: string[] | undefined;
    if (event.audience_type === "employees") {
      employeeIds = await loadEmployeeIdsForEvent(supabase, event.id);
    }

    const recipientUserIds = await resolveRecipientUserIds(supabase, event.tenant_id, {
      type: event.audience_type,
      departmentId: event.audience_department_id,
      employeeIds,
    });

    if (recipientUserIds.length === 0) {
      skipped += dueKinds.length;
      continue;
    }

    for (const kind of dueKinds) {
      const count = await insertReminderKind(
        supabase,
        event,
        recipientUserIds,
        kind,
        timeZone,
        startsAt,
        endsAt,
      );
      inserted += count.inserted;
      skipped += count.skipped;
    }
  }

  return { inserted, skipped };
}

async function insertReminderKind(
  supabase: SupabaseClient,
  event: EventRow,
  recipientUserIds: string[],
  kind: ScheduledReminderKind,
  timeZone: string,
  startsAt: Date,
  endsAt: Date,
): Promise<{ inserted: number; skipped: number }> {
  const { title, body } = buildReminderCopy(
    kind,
    event.title,
    startsAt,
    endsAt,
    timeZone,
  );

  const rows = recipientUserIds.map((recipientUserId) => ({
    tenant_id: event.tenant_id,
    recipient_user_id: recipientUserId,
    event_id: event.id,
    kind,
    title,
    body,
  }));

  const { data, error } = await supabase.from("notifications").insert(rows).select("id");

  if (error) {
    if (error.code === "23505") {
      return { inserted: 0, skipped: rows.length };
    }
    throw new Error(error.message);
  }

  const insertedCount = data?.length ?? 0;
  return {
    inserted: insertedCount,
    skipped: rows.length - insertedCount,
  };
}
