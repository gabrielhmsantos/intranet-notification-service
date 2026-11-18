# Instruções para agentes — `apps/notification-service`

Microserviço **Fastify** (TypeScript) para rotinas de **notificação in-app**: **INSERT** em `notifications` no Postgres (Supabase). Sem UI. Contexto do monorepo: [`../../AGENTS.md`](../../AGENTS.md).

> **Estado:** serviço planeado / em implementação inicial. Ao criar o projeto, manter `package.json` e scripts alinhados com esta secção.

## Responsabilidade única

| Faz | Não faz |
|-----|---------|
| Rotinas agendadas: eventos do dia; lembretes **1 h** e **≤ 15 min** antes do início | UI, sessão de utilizador, convites |
| INSERT em `notifications` (um registo por destinatário) | UPDATE “lida” (destinatário / BFF) |
| Responder a HTTP da **Edge Function** (após `pg_cron` + `pg_net`) | Ser fonte do “relógio” (cron vive no Postgres/Supabase) |
| Logging estruturado, **idempotência** em re-execuções | Fila de mensagens (Redis, SQS, etc.) |

INSERT imediato por mutação de evento (ex.: cancelamento) é responsabilidade do **BFF** em `apps/web`, não deste serviço.

## Arquitetura

```
pg_cron + pg_net → Edge Function (supabase/functions/) → HTTPS → notification-service → Postgres
```

- Deploy previsto na **Render** (branch + build + deploy, como a web).
- Credenciais Postgres/Supabase via variáveis de ambiente no serviço — ver [docs/SECURITY.md](../../docs/SECURITY.md) §6.
- Autenticação **Edge → serviço**: header secreto partilhado (ou equivalente); **HTTPS**; segredo fora do Git. Documentar contrato na spec da feature antes de produção.

## Estrutura sugerida

```
apps/notification-service/
  src/
    server.ts          # bootstrap Fastify
    routes/            # endpoints internos (ex.: /jobs/...)
    services/          # lógica de notificações
    db/                # cliente Postgres / Supabase servidor
  package.json
  tsconfig.json
  .env.example         # sem valores reais
```

Projeto **independente** de `apps/web`: sem importar código da web nem pasta `packages/` na raiz.

## Fastify

- Usar TypeScript; logger **Pino** (`logger: true` no Fastify).
- Validar body/query com **JSON Schema** nos routes.
- Endpoint de saúde: `GET /health` → `{ status: 'ok' }`.
- Erros: handler centralizado; não vazar stack traces em produção.

Skill do repositório: `.agents/skills/fastify-best-practices/`.

## Idempotência e qualidade

- Jobs repetidos (cron, retry, cold start Render) **não** devem duplicar notificações.
- Preferir chaves naturais ou UPSERT / verificação antes de INSERT conforme modelo em `notifications`.
- Logs com `job`, `tenant_id`, contagens e duração — sem PII desnecessária.

## Comandos (quando `package.json` existir)

Executar a partir de `apps/notification-service/`:

```bash
pnpm install
pnpm dev      # desenvolvimento com reload
pnpm build    # compilar TypeScript
pnpm start    # produção
pnpm lint     # ESLint
pnpm test     # testes (quando configurados)
```

Documentar aqui os scripts reais assim que o scaffold existir.

## Variáveis de ambiente (exemplo)

- `DATABASE_URL` ou credenciais Supabase de serviço (só servidor)
- `EDGE_WEBHOOK_SECRET` (ou nome acordado) — validar chamadas da Edge
- `PORT`, `NODE_ENV`, `LOG_LEVEL`

Nunca commitar `.env` com valores reais.

## Verificação antes de concluir

- [ ] Rotas internas exigem autenticação da Edge (secret/header).
- [ ] Apenas INSERT (e leituras mínimas necessárias ao job) em `notifications`.
- [ ] Idempotência considerada para cada rotina.
- [ ] Sem dependências de `apps/web`.
- [ ] Contrato HTTP alinhado à spec da feature e [docs/QUALITY.md](../../docs/QUALITY.md).

## Documentação

| Documento | Secção relevante |
|-----------|------------------|
| [docs/ENGINEERING.md](../../docs/ENGINEERING.md) | §5 — critérios do serviço |
| [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) | §3.3, §4.3, §4.6 |
| [docs/SECURITY.md](../../docs/SECURITY.md) | §6 — integrações internas |
| [docs/PROPOSAL.md](../../docs/PROPOSAL.md) | §4.5 — notificações |

## Evitar

- Endpoints públicos sem autenticação para criar notificações.
- Partilhar pacote npm com `apps/web`.
- Cron permanente neste processo como única fonte de agendamento (hibernação Render free).
- Commits ou deploy sem pedido explícito do utilizador.
