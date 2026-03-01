# Developer Portal — Roadmap

Portal para desenvolvedores consumirem APIs gerenciadas pelo FuseOne, com planos, quotas, rate limiting e self-service. Inspirado no modelo do Gravitee e Kong Developer Portal.

---

## Phase 1 — Fundacao (MVP)

> Objetivo: CRUD de planos por API e associacao basica de consumers a planos.

### Backend
- [ ] Tabela `api_plans` (id, api_id, name, slug, description, rate_limit, quota_day, quota_month, auto_approve, status, created_at)
- [ ] Tabela `plan_subscriptions` (id, plan_id, consumer_id, api_key, status [pending/active/suspended/revoked], created_at)
- [ ] CRUD endpoints: `POST/GET/PUT/DELETE /api/v1/apis/:id/plans`
- [ ] Endpoint de subscription: `POST /api/v1/plans/:id/subscribe` (gera API key)
- [ ] Provisioning automatico no APISIX: cria consumer + key-auth + limit-count baseado no plano

### Frontend (Admin)
- [ ] Aba "Plans" dentro da pagina de edicao de API (`/apis/:id`)
- [ ] Formulario de criacao/edicao de plano (nome, rate limit, quotas)
- [ ] Lista de subscriptions por plano com status
- [ ] Acoes: aprovar, suspender, revogar subscription

### Integracao APISIX
- [ ] Ao aprovar subscription: criar consumer com `key-auth` e `limit-count` configurados
- [ ] Ao revogar: desabilitar o consumer ou remover credencial
- [ ] Mapear plano → plugins (rate_limit → `limit-req`, quota → `limit-count`)

---

## Phase 2 — Portal Publico

> Objetivo: pagina publica onde devs podem descobrir APIs, ver docs e se inscrever.

### Backend
- [ ] Endpoints publicos: `GET /portal/apis`, `GET /portal/apis/:id`
- [ ] Endpoint de signup: `POST /portal/register` (cria conta de developer)
- [ ] Endpoint de subscription: `POST /portal/apis/:id/subscribe` (com api_key do dev)
- [ ] Dashboard do developer: `GET /portal/my/subscriptions`, `GET /portal/my/keys`

### Frontend (Portal)
- [ ] Layout separado do admin (`/portal/*`)
- [ ] Catalogo de APIs publicas com busca e filtros
- [ ] Pagina de detalhe da API: descricao, endpoints, planos disponiveis
- [ ] Comparativo de planos (tabela side-by-side: Free vs Basic vs Pro)
- [ ] Fluxo de subscription: escolher plano → gerar API key → copiar
- [ ] Dashboard "My APIs": lista de subscriptions, uso, keys

---

## Phase 3 — Documentacao e Try-It

> Objetivo: documentacao interativa das APIs direto no portal.

- [ ] Import de OpenAPI/Swagger spec por API
- [ ] Renderizacao automatica da spec (endpoints, schemas, exemplos)
- [ ] Console "Try It" — testar endpoints direto no browser com a API key do dev
- [ ] Markdown pages customizaveis por API (getting started, changelog)
- [ ] Versionamento de docs (v1, v2)

---

## Phase 4 — Analytics e Monetizacao

> Objetivo: visibilidade de uso e base para cobranca.

- [ ] Dashboard de uso por subscription (requests/dia, latencia, erros)
- [ ] Alertas de quota (80%, 100%)
- [ ] Webhook de eventos (subscription criada, quota atingida, key revogada)
- [ ] Integracao com billing (Stripe): cobranca por plano ou pay-per-use
- [ ] Relatorios exportaveis (CSV/PDF)

---

## Phase 5 — Avancado

> Objetivo: features enterprise e customizacao.

- [ ] Portal multi-tenant (cada org tem seu portal)
- [ ] Customizacao visual do portal (logo, cores, dominio custom)
- [ ] OAuth2/OIDC como metodo de autenticacao (alem de API key)
- [ ] SDK generation automatico (OpenAPI → client libraries)
- [ ] API review/approval workflow (publisher → reviewer → approved)
- [ ] Rate limiting avancado: por endpoint, por metodo, sliding window
- [ ] Grupos de planos (bundles de APIs)

---

## Modelo de Dados (Referencia)

```
api_plans
├── id              UUID PK
├── api_id          TEXT (APISIX service/route id)
├── name            TEXT ("Free", "Pro", "Enterprise")
├── slug            TEXT UNIQUE
├── description     TEXT
├── rate_limit      INT (req/sec, 0 = unlimited)
├── quota_day       INT (req/dia, 0 = unlimited)
├── quota_month     INT (req/mes, 0 = unlimited)
├── request_size    INT (bytes, 0 = unlimited)
├── auto_approve    BOOL
├── status          TEXT ("active", "deprecated", "closed")
├── position        INT (ordenacao)
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ

plan_subscriptions
├── id              UUID PK
├── plan_id         UUID FK → api_plans
├── consumer_id     TEXT (APISIX consumer id)
├── developer_id    UUID FK → users (nullable, Phase 2)
├── api_key         TEXT UNIQUE
├── status          TEXT ("pending", "active", "suspended", "revoked")
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ
```

## Mapeamento Plano → APISIX Plugins

| Campo do Plano | Plugin APISIX       | Config                                      |
|----------------|---------------------|----------------------------------------------|
| api_key        | `key-auth`          | `{ key: "<api_key>" }`                       |
| rate_limit     | `limit-req`         | `{ rate: N, burst: N*2, key: "consumer_name" }` |
| quota_day      | `limit-count`       | `{ count: N, time_window: 86400, key: "consumer_name" }` |
| quota_month    | `limit-count`       | `{ count: N, time_window: 2592000, key: "consumer_name" }` |
| request_size   | `client-control`    | `{ max_body_size: N }`                       |
