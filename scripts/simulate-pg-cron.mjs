#!/usr/bin/env node
/**
 * Simula pg_cron (*/5) em dev: invoca o job a cada 5 minutos.
 * Equivalente local a pg_cron → Edge → notification-service, sem Vault/pg_net.
 *
 *   pnpm dev          # terminal 1
 *   pnpm simulate:cron  # terminal 2
 */

const INTERVAL_MS = 5 * 60 * 1000;
const baseUrl = (process.env.NOTIFICATION_SERVICE_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const secret = process.env.EDGE_WEBHOOK_SECRET ?? "dev-webhook-secret";

async function tick() {
  const at = new Date().toISOString();
  try {
    const res = await fetch(`${baseUrl}/jobs/event-reminders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ triggered_at: at }),
    });
    const text = await res.text();
    console.log(`[${at}] ${res.status}`, text);
  } catch (err) {
    console.error(`[${at}]`, err);
  }
}

console.log(`Simulando pg_cron: POST ${baseUrl}/jobs/event-reminders a cada 5 min`);
await tick();
setInterval(tick, INTERVAL_MS);
