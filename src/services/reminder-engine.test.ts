import { describe, expect, it } from "vitest";
import {
  evaluateScheduledReminders,
  shouldEmitEventDay,
  shouldEmitReminder15m,
  shouldEmitReminder1h,
} from "./reminder-engine.js";

const TZ = "Europe/Lisbon";

describe("shouldEmitEventDay", () => {
  it("emits on event day after 08:00 local", () => {
    const startsAt = new Date("2026-06-15T14:00:00.000Z");
    const now = new Date("2026-06-15T07:10:00.000Z"); // ~08:10 Lisbon in summer
    expect(shouldEmitEventDay(startsAt, now, TZ)).toBe(true);
  });

  it("does not emit before 08:00 on event day", () => {
    const startsAt = new Date("2026-06-15T14:00:00.000Z");
    const now = new Date("2026-06-15T06:00:00.000Z");
    expect(shouldEmitEventDay(startsAt, now, TZ)).toBe(false);
  });

  it("catch-up: same day after late create (>= 08:00)", () => {
    const startsAt = new Date("2026-06-15T15:00:00.000Z");
    const now = new Date("2026-06-15T09:35:00.000Z");
    expect(shouldEmitEventDay(startsAt, now, TZ)).toBe(true);
  });
});

describe("shouldEmitReminder1h", () => {
  it("true in (45, 65] minutes window", () => {
    const startsAt = new Date("2026-06-15T12:00:00.000Z");
    const now = new Date("2026-06-15T11:05:00.000Z");
    expect(shouldEmitReminder1h(startsAt, now)).toBe(true);
  });

  it("false when less than 45 minutes", () => {
    const startsAt = new Date("2026-06-15T12:00:00.000Z");
    const now = new Date("2026-06-15T11:30:00.000Z");
    expect(shouldEmitReminder1h(startsAt, now)).toBe(false);
  });
});

describe("shouldEmitReminder15m", () => {
  it("true in (0, 20] minutes window", () => {
    const startsAt = new Date("2026-06-15T12:00:00.000Z");
    const now = new Date("2026-06-15T11:50:00.000Z");
    expect(shouldEmitReminder15m(startsAt, now)).toBe(true);
  });
});

describe("evaluateScheduledReminders", () => {
  it("skips all kinds for canceled events", () => {
    const startsAt = new Date("2026-06-15T12:00:00.000Z");
    const now = new Date("2026-06-15T11:50:00.000Z");
    const result = evaluateScheduledReminders(startsAt, now, TZ, "canceled");
    expect(result.every((r) => !r.due)).toBe(true);
  });
});
