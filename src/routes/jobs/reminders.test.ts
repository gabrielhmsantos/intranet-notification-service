import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerReminderRoutes } from "./reminders.js";

vi.mock("../../db/postgres.js", () => ({
  createServiceClient: () => ({}),
}));

vi.mock("../../services/run-event-reminders.js", () => ({
  runEventReminders: vi.fn().mockResolvedValue({ inserted: 1, skipped: 0 }),
}));

describe("POST /jobs/event-reminders", () => {
  const originalSecret = process.env.EDGE_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.EDGE_WEBHOOK_SECRET = "test-secret";
    process.env.SUPABASE_URL = "http://localhost";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "key";
  });

  afterEach(() => {
    process.env.EDGE_WEBHOOK_SECRET = originalSecret;
  });

  it("returns 401 without Bearer secret", async () => {
    const app = Fastify();
    await registerReminderRoutes(app);
    const res = await app.inject({
      method: "POST",
      url: "/jobs/event-reminders",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 200 with valid secret", async () => {
    const app = Fastify();
    await registerReminderRoutes(app);
    const res = await app.inject({
      method: "POST",
      url: "/jobs/event-reminders",
      headers: { authorization: "Bearer test-secret" },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, inserted: 1, skipped: 0 });
  });
});
