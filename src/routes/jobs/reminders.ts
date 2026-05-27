import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createServiceClient } from "../../db/postgres.js";
import { runEventReminders } from "../../services/run-event-reminders.js";

function verifyAuth(request: FastifyRequest): boolean {
  const secret = process.env.EDGE_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && token === secret;
}

export async function registerReminderRoutes(app: FastifyInstance) {
  app.post("/jobs/event-reminders", async (request, reply) => {
    if (!verifyAuth(request)) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    try {
      const supabase = createServiceClient();
      const triggeredAt =
        (request.body as { triggered_at?: string } | undefined)?.triggered_at;
      const now = triggeredAt ? new Date(triggeredAt) : new Date();
      const result = await runEventReminders(supabase, now);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      request.log.error({ err }, "event-reminders failed");
      return reply.code(500).send({ error: "internal" });
    }
  });
}
