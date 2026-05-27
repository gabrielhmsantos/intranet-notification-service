import Fastify from "fastify";
import { registerReminderRoutes } from "./routes/jobs/reminders.js";

async function main() {
  const port = Number(process.env.PORT ?? 3001);
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));
  await registerReminderRoutes(app);

  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
