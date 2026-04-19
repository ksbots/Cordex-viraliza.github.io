# Acelera Digital Pro — Plataforma Completa

> Plataforma de crescimento digital de nível enterprise, superando o site de referência em todos os aspectos: performance, segurança, UX e arquitetura.

---

## 🏗️ Arquitetura Geral

```
acelera-digital-pro/
├── frontend/          # Next.js 16 (App Router) + TypeScript
├── backend/           # NestJS + TypeScript (API monolítica modular)
├── infra/             # Docker, Nginx, Cloudflare configs
└── docs/              # Documentação técnica
```

### Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Frontend** | Next.js 16 + TypeScript | SSR/SSG, App Router, Server Components |
| **UI Library** | Shadcn/UI + Radix UI | Acessível, WCAG 2.1 AA, tema dark/light |
| **CSS** | Tailwind CSS | Utility-first, zero-runtime |
| **Animations** | Framer Motion | Microinterações, gestos mobile |
| **Backend** | NestJS + TypeScript | Modular, tipado, decorators |
| **Database** | PostgreSQL 16 | ACID, JSONB, índices avançados |
| **Cache/Sessions** | Redis 7 | Rate limiting, sessões, pub/sub |
| **Auth** | JWT + WebAuthn + OAuth 2.0 | Passkeys, Google, GitHub |
| **Pagamentos** | Stripe + Pix/Boleto | Gateway modular, webhooks idempotentes |
| **CDN/WAF** | Cloudflare | DDoS L7, WAF, Workers |
| **Monitoramento** | Sentry + Logtail | Erros em produção, logs estruturados |
| **CI/CD** | GitHub Actions + Docker | Build, test, deploy automatizado |

---

## 🔐 Arquitetura de Segurança (OWASP Top 10 2026)

### Conformidade por categoria

| OWASP ID | Risco | Mitigação Implementada |
|---|---|---|
| A01 | Broken Access Control | RBAC granular + PlanGuard + ownership checks |
| A02 | Cryptographic Failures | Argon2id (hash), TLS 1.3, HSTS 1 ano, AES-256 em repouso |
| A03 | Injection | Parâmetros TypeORM com bind variables; ValidationPipe whitelist |
| A04 | Insecure Design | Threat modeling, princípio do menor privilégio |
| A05 | Security Misconfiguration | Helmet.js, CSP strict, headers hardened, env vars validados |
| A06 | Vulnerable Components | `npm audit` no CI, Snyk integrado, Dependabot automático |
| A07 | Auth Failures | Argon2id, rate limiting bruto-force, MFA, Passkeys WebAuthn |
| A08 | Software Integrity | SRI em assets CDN, assinatura de commits, SBOM gerado |
| A09 | Logging Failures | Audit logs imutáveis, SIEM-ready, sem PII em logs |
| A10 | SSRF | Allowlist de URLs externas, validação de schemas |

### Cabeçalhos HTTP implementados

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{n}'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

---

## ⚡ Performance Targets (Core Web Vitals)

| Métrica | Target | Estratégia |
|---|---|---|
| **LCP** | < 1.2s | SSR + CDN edge caching + `next/image` WebP/AVIF |
| **FID/INP** | < 50ms | React Server Components, lazy loading, code splitting |
| **CLS** | < 0.05 | Dimensões explícitas, font-display: swap, skeleton screens |
| **TTFB** | < 200ms | Redis cache + ISR + Cloudflare edge |
| **PageSpeed** | 99-100 | Compressão Brotli, tree-shaking, critical CSS inline |

---

## 📦 Instalação e Setup

### Pré-requisitos

```bash
node >= 20.x
pnpm >= 9.x
docker >= 24.x
docker-compose >= 2.x
```

### 1. Clone e instale dependências

```bash
git clone https://github.com/seu-usuario/acelera-digital-pro.git
cd acelera-digital-pro

# Frontend
cd frontend && pnpm install

# Backend
cd ../backend && pnpm install
```

### 2. Variáveis de ambiente

```bash
# Backend: copie e configure
cp backend/.env.example backend/.env
```

```env
# ── DATABASE ──────────────────────────────────────────────
DATABASE_URL=postgresql://acelera:senha@localhost:5432/acelera_db
REDIS_URL=redis://localhost:6379

# ── JWT ───────────────────────────────────────────────────
JWT_ACCESS_SECRET=seu-secret-access-256-bits-aqui
JWT_REFRESH_SECRET=seu-secret-refresh-256-bits-aqui

# ── OAUTH 2.0 ─────────────────────────────────────────────
GOOGLE_CLIENT_ID=seu-google-client-id
GOOGLE_CLIENT_SECRET=seu-google-client-secret
GITHUB_CLIENT_ID=seu-github-client-id
GITHUB_CLIENT_SECRET=seu-github-client-secret

# ── STRIPE ────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_EXPERT=price_...

# ── EXTERNAL APIS ─────────────────────────────────────────
YOUTUBE_API_KEY=sua-youtube-api-key
TIKTOK_CLIENT_KEY=seu-tiktok-client-key
INSTAGRAM_APP_ID=seu-instagram-app-id
INSTAGRAM_APP_SECRET=seu-instagram-app-secret

# ── MONITORING ────────────────────────────────────────────
SENTRY_DSN=https://...@sentry.io/...
LOGTAIL_TOKEN=seu-logtail-token

# ── APP ───────────────────────────────────────────────────
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
PORT=3001
```

### 3. Infraestrutura local (Docker)

```bash
# Sobe PostgreSQL + Redis + PgAdmin
docker-compose -f infra/docker-compose.dev.yml up -d
```

```yaml
# infra/docker-compose.dev.yml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: acelera_db
      POSTGRES_USER: acelera
      POSTGRES_PASSWORD: senha
    ports: ['5432:5432']
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass redispass
    ports: ['6379:6379']
    volumes:
      - redis_data:/data

  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@acelera.digital
      PGADMIN_DEFAULT_PASSWORD: admin
    ports: ['5050:80']
    depends_on: [postgres]

volumes:
  postgres_data:
  redis_data:
```

### 4. Migrações do banco de dados

```bash
cd backend

# Gera nova migração
pnpm migration:generate src/migrations/InitialSchema

# Executa migrações pendentes
pnpm migration:run

# Reverte última migração
pnpm migration:revert

# Popula dados iniciais (seed)
pnpm seed:run
```

### 5. Iniciar em desenvolvimento

```bash
# Terminal 1 — Backend (porta 3001)
cd backend && pnpm start:dev

# Terminal 2 — Frontend (porta 3000)
cd frontend && pnpm dev
```

---

## 🌐 Estrutura de Rotas da API

### Autenticação `/api/v1/auth`

```
POST   /auth/register              — Cadastro com email/senha
POST   /auth/login                 — Login + MFA opcional
POST   /auth/refresh               — Rotação de refresh token (cookie HttpOnly)
POST   /auth/logout                — Revogação de sessão
POST   /auth/forgot-password       — Início de redefinição de senha
POST   /auth/reset-password        — Finaliza redefinição de senha

POST   /auth/webauthn/register/options  — Gera desafio WebAuthn
POST   /auth/webauthn/register/verify   — Registra passkey
POST   /auth/webauthn/auth/options      — Gera desafio de autenticação
POST   /auth/webauthn/auth/verify       — Autentica com passkey

POST   /auth/mfa/setup             — Gera QR code TOTP
POST   /auth/mfa/verify            — Ativa MFA

GET    /auth/google                — Inicia OAuth Google
GET    /auth/google/callback       — Callback OAuth Google
GET    /auth/github                — Inicia OAuth GitHub
GET    /auth/github/callback       — Callback OAuth GitHub
```

### Usuários `/api/v1/users`

```
GET    /users/me                   — Perfil do usuário autenticado
PATCH  /users/me                   — Atualiza perfil
DELETE /users/me                   — Exclusão de conta (LGPD)
GET    /users/:id                  — Perfil público de usuário
GET    /users                      — Lista usuários [ADMIN]
PATCH  /users/:id/role             — Altera papel do usuário [ADMIN]
PATCH  /users/:id/ban              — Suspende conta [ADMIN]
```

### Cursos `/api/v1/courses`

```
GET    /courses                    — Lista cursos disponíveis
GET    /courses/:id                — Detalhe do curso
GET    /courses/:id/modules        — Módulos do curso [AUTH + PLAN]
GET    /modules/:id/lessons        — Aulas do módulo [AUTH + PLAN]
GET    /lessons/:id                — Aula individual + progresso
POST   /progress                   — Registra progresso [AUTH]
GET    /my-courses                 — Cursos do usuário [AUTH]
```

### Pagamentos `/api/v1/payments`

```
POST   /payments/checkout          — Cria sessão Stripe Checkout
GET    /payments/session/:id       — Status da sessão
POST   /payments/webhook           — Webhook Stripe (idempotente)
GET    /payments/history           — Histórico de pagamentos [AUTH]
POST   /payments/refund/:id        — Solicita reembolso [ADMIN]
```

### Social APIs `/api/v1/social`

```
GET    /social/youtube/search      — Busca vídeos YouTube Data API v3
GET    /social/youtube/video/:id   — Detalhes do vídeo
GET    /social/youtube/channel/:id — Detalhes do canal
POST   /social/tiktok/oembed       — oEmbed de vídeo TikTok
GET    /social/instagram/profile   — Perfil Instagram (Graph API)
GET    /social/instagram/media     — Feed Instagram do usuário
```

### Analytics `/api/v1/analytics`

```
GET    /analytics/dashboard        — Métricas gerais [AUTH]
GET    /analytics/growth           — Dados de crescimento de seguidores
GET    /analytics/content          — Performance de conteúdo
POST   /analytics/track            — Registra evento de analytics
```

---

## 🚀 Deploy em Produção

### 1. Build de produção

```bash
# Backend
cd backend && pnpm build
docker build -t acelera-api:latest .

# Frontend
cd frontend && pnpm build
# Output estático em .next/
```

### 2. Docker Compose (produção)

```bash
docker-compose -f infra/docker-compose.prod.yml up -d
```

### 3. Cloudflare WAF — Regras recomendadas

```
# Regra 1: Rate limiting agressivo em /auth
(http.request.uri.path contains "/auth/login") → Block após 10 req/5min por IP

# Regra 2: Bloqueio de países de alto risco em endpoints sensíveis
(http.request.uri.path contains "/api/v1/admin") → Challenge não-BR

# Regra 3: SQL Injection / XSS automático
Gerenciado pela Cloudflare WAF — OWASP Core Ruleset habilitado

# Regra 4: Bot Fight Mode habilitado
Cloudflare Super Bot Fight Mode para plano Business
```

### 4. Variáveis de produção no CI/CD

Configure todos os secrets no GitHub Actions:
- `DATABASE_URL`, `REDIS_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SENTRY_DSN`, `LOGTAIL_TOKEN`
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`

---

## 🧪 Testes

```bash
# Unit tests
pnpm test

# Integration tests (requer Docker)
pnpm test:e2e

# Coverage report
pnpm test:cov

# Security audit
pnpm audit
npx snyk test
```

---

## 📊 Monitoramento

- **Erros em produção**: Sentry (alertas por email/Slack)
- **Logs estruturados**: Logtail (JSON, pesquisável)
- **Métricas de DB**: pganalyze ou Datadog Postgres integration
- **Uptime**: Better Uptime / Cloudflare Health Checks
- **Core Web Vitals**: Vercel Analytics ou Google Search Console

---

## 📄 Licença

Proprietário. Todos os direitos reservados © 2026 Acelera Digital.

---

## 🤝 Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para guia de contribuição, padrões de código e processo de PR.
