#!/usr/bin/env node
/**
 * Simula uma execução do job (pg_cron → Edge → serviço) em dev local.
 * Chama POST /jobs/event-reminders directamente no notification-service.
 *
 * Uso (com serviço a correr em pnpm dev):
 *   node scripts/run-reminders-once.mjs
 *
 * Env: NOTIFICATION_SERVICE_URL (default http://127.0.0.1:3001), EDGE_WEBHOOK_SECRET
 */

const baseUrl = (process.env.NOTIFICATION_SERVICE_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const secret = process.env.EDGE_WEBHOOK_SECRET ?? "dev-webhook-secret";

const res = await fetch(`${baseUrl}/jobs/event-reminders`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify({ triggered_at: new Date().toISOString() }),
});

const text = await res.text();
console.log(res.status, text);
if (!res.ok) process.exit(1);
