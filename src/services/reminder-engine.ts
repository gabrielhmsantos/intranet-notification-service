export type ScheduledReminderKind =
  | "event_day"
  | "event_reminder_1h"
  | "event_reminder_15m";

export type ReminderEvaluation = {
  kind: ScheduledReminderKind;
  due: boolean;
};

function civilDateInTz(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function localHourInTz(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

export function minutesUntilStart(startsAt: Date, now: Date): number {
  return (startsAt.getTime() - now.getTime()) / 60_000;
}

/** Day-of event: same civil day as start and local time >= 08:00 (catch-up on next cron). */
export function shouldEmitEventDay(
  startsAt: Date,
  now: Date,
  timeZone: string,
): boolean {
  if (civilDateInTz(startsAt, timeZone) !== civilDateInTz(now, timeZone)) {
    return false;
  }
  return localHourInTz(now, timeZone) >= 8;
}

export function shouldEmitReminder1h(startsAt: Date, now: Date): boolean {
  const minutes = minutesUntilStart(startsAt, now);
  return minutes > 45 && minutes <= 65;
}

export function shouldEmitReminder15m(startsAt: Date, now: Date): boolean {
  const minutes = minutesUntilStart(startsAt, now);
  return minutes > 0 && minutes <= 20;
}

export function evaluateScheduledReminders(
  startsAt: Date,
  now: Date,
  timeZone: string,
  status: "active" | "canceled",
): ReminderEvaluation[] {
  if (status !== "active") {
    return [
      { kind: "event_day", due: false },
      { kind: "event_reminder_1h", due: false },
      { kind: "event_reminder_15m", due: false },
    ];
  }

  return [
    {
      kind: "event_day",
      due: shouldEmitEventDay(startsAt, now, timeZone),
    },
    {
      kind: "event_reminder_1h",
      due: shouldEmitReminder1h(startsAt, now),
    },
    {
      kind: "event_reminder_15m",
      due: shouldEmitReminder15m(startsAt, now),
    },
  ];
}

export function buildReminderCopy(
  kind: ScheduledReminderKind,
  eventTitle: string,
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
): { title: string; body: string } {
  const window = `${formatInTz(startsAt, timeZone)} – ${formatInTz(endsAt, timeZone)}`;

  if (kind === "event_day") {
    return {
      title: `Hoje: ${eventTitle}`,
      body: `O evento «${eventTitle}» é hoje. Horário: ${window}.`,
    };
  }
  if (kind === "event_reminder_1h") {
    return {
      title: `Daqui a 1 hora: ${eventTitle}`,
      body: `O evento «${eventTitle}» começa em cerca de 1 hora (${window}).`,
    };
  }
  return {
    title: `Em breve: ${eventTitle}`,
    body: `O evento «${eventTitle}» começa em breve (${window}).`,
  };
}

function formatInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
