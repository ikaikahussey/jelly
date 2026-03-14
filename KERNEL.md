# Jelly Platform Kernel — Development Specification

## What This Is

Jelly is a fork of Cloudflare VibeSDK, an AI-powered vibe coding platform built on Cloudflare's stack (Workers, Durable Objects, D1, R2, KV, Workers for Platforms). Users describe apps in natural language and the platform generates, previews, and deploys them.

This specification defines a **platform kernel** to be built on top of Jelly. The kernel provides four primitives — identity, relationships, content objects, and a ledger — that all apps generated on the platform share. The goal is to turn Jelly from a code generation tool into an app ecosystem where generated apps share users, data, and an internal economy.

The kernel does not implement social features directly. It provides the substrate that apps use to implement social features, CMS features, game features, marketplace features, or anything else. The kernel is minimal and generic. Apps give the primitives meaning.

## Existing Architecture (Do Not Break)

The current Jelly codebase provides:

- **Frontend**: React + Vite, modern UI components
- **Backend**: Cloudflare Worker with Durable Objects for stateful AI agents
- **Database**: D1 (SQLite) via Drizzle ORM
- **AI**: Multiple LLM providers routed through AI Gateway
- **Containers**: Sandboxed app previews and execution via Cloudflare Containers
- **Storage**: R2 for templates, KV for sessions
- **Deployment**: Workers for Platforms with dispatch namespaces
- **Auth**: Google and GitHub OAuth (optional, post-deployment setup)
- **SDK**: `@cf-vibesdk/sdk` TypeScript package for programmatic access

All existing functionality must continue to work. The kernel is additive.

## The Four Kernel Primitives

### 1. Identity (users)

The platform is the identity provider. Users authenticate once through the platform. All deployed apps receive a verified user context without implementing their own auth.

**D1 Schema:**

```sql
CREATE TABLE kernel_users (
  user_id TEXT PRIMARY KEY,           -- UUID, generated on first login
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_r2_key TEXT,                 -- R2 object key for avatar image
  profile_json TEXT DEFAULT '{}',     -- extensible, apps read what they need
  created_at INTEGER NOT NULL,        -- unix timestamp ms
  updated_at INTEGER NOT NULL
);
```

**Integration with existing auth:** The current OAuth flow (Google/GitHub) creates or retrieves a `kernel_users` row. The platform mints a JWT containing `user_id`, `email`, and `display_name`. The JWT is stored in an httpOnly cookie scoped to the root domain. All deployed apps on subdomains of the root domain receive the cookie automatically.

**JWT structure:**

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "name": "Display Name",
  "iat": 1700000000,
  "exp": 1700086400
}
```

**Auth middleware for deployed apps:** A reusable middleware function validates the JWT on every request to a deployed app. If valid, it attaches the user context to the request. If invalid or absent, it redirects to the platform login page with a return URL. This middleware is injected into the Workers for Platforms dispatch layer so that individual generated apps never implement auth.

### 2. Relationships (graph)

Directional edges between users. The platform stores edges and enforces uniqueness. It does not interpret edge semantics — apps define their own relationship types.

**D1 Schema:**

```sql
CREATE TABLE kernel_relationships (
  from_user TEXT NOT NULL REFERENCES kernel_users(user_id),
  to_user TEXT NOT NULL REFERENCES kernel_users(user_id),
  rel_type TEXT NOT NULL,             -- app-defined: 'follow', 'friend', 'subscribe', 'member', 'blocked', etc.
  metadata_json TEXT DEFAULT '{}',    -- app-defined: role, tier, expiry, permissions, etc.
  created_at INTEGER NOT NULL,
  PRIMARY KEY (from_user, to_user, rel_type)
);

CREATE INDEX idx_rel_to ON kernel_relationships(to_user, rel_type);
CREATE INDEX idx_rel_type ON kernel_relationships(rel_type);
```

### 3. Content Objects (objects)

A user creates an object. The object has an owner, a type label, a JSON payload, a visibility level, and a timestamp. The platform stores it and enforces access control. It does not know or care what the object represents.

**D1 Schema:**

```sql
CREATE TABLE kernel_objects (
  object_id TEXT PRIMARY KEY,         -- UUID
  owner_id TEXT NOT NULL REFERENCES kernel_users(user_id),
  object_type TEXT NOT NULL,          -- app-defined: 'post', 'article', 'game_state', 'page', 'listing', 'message', etc.
  payload_json TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'relationships' | 'public'
  parent_id TEXT REFERENCES kernel_objects(object_id),  -- threading, replies, versions, folder hierarchy
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_obj_owner ON kernel_objects(owner_id, object_type);
CREATE INDEX idx_obj_type ON kernel_objects(object_type, visibility, created_at);
CREATE INDEX idx_obj_parent ON kernel_objects(parent_id);
```

**Visibility enforcement:**
- `private`: only the owner can read
- `relationships`: owner + users who have any relationship edge pointing to or from the owner (filter by rel_type is the app's job via query params)
- `public`: anyone

### 4. Ledger (transactions)

An append-only financial ledger. Credits in, credits out. Every mutation is two entries (debit + credit) written atomically. The platform enforces non-negative balances.

**D1 Schema:**

```sql
CREATE TABLE kernel_ledger (
  entry_id TEXT PRIMARY KEY,          -- UUID
  user_id TEXT NOT NULL REFERENCES kernel_users(user_id),
  amount INTEGER NOT NULL,            -- positive = credit, negative = debit (in smallest currency unit, e.g. cents)
  balance_after INTEGER NOT NULL,
  entry_type TEXT NOT NULL,           -- 'deposit' | 'withdrawal' | 'purchase' | 'sale' | 'platform_fee' | 'grant' | 'refund'
  reference_id TEXT,                  -- listing_id, withdrawal_id, app_id, etc.
  counterparty_id TEXT,               -- the other user in a transfer
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_ledger_user ON kernel_ledger(user_id, created_at);
```

**Transfer logic (pseudo):**

```
function transfer(fromUserId, toUserId, amount, platformFeePercent, referenceId):
  balance = getCurrentBalance(fromUserId)
  if balance < amount: throw InsufficientFunds

  platformFee = floor(amount * platformFeePercent / 100)
  sellerAmount = amount - platformFee

  // All four entries in a single D1 batch (atomic)
  insert(debit fromUserId, -amount, entry_type='purchase', counterparty=toUserId)
  insert(credit toUserId, +sellerAmount, entry_type='sale', counterparty=fromUserId)
  insert(credit platformUserId, +platformFee, entry_type='platform_fee', reference=referenceId)
```

## Kernel API

Implemented as routes on the main Jelly Worker, under the `/api/kernel/` prefix. All routes require a valid JWT except where noted.

### Auth

```
GET  /api/kernel/auth/me              → current user profile
POST /api/kernel/auth/login           → OAuth initiation (existing flow)
POST /api/kernel/auth/logout          → clear session
```

### Users

```
GET    /api/kernel/users/:id          → public profile
PATCH  /api/kernel/users/me           → update own profile
```

### Relationships

```
POST   /api/kernel/graph              → { to_user, rel_type, metadata? }
DELETE /api/kernel/graph              → { to_user, rel_type }
GET    /api/kernel/graph              → ?from=&to=&type=&limit=&cursor=
```

### Objects

```
POST   /api/kernel/objects            → { type, payload, visibility?, parent_id? }
GET    /api/kernel/objects/:id        → single object (access-checked)
PATCH  /api/kernel/objects/:id        → { payload?, visibility? } (owner only)
DELETE /api/kernel/objects/:id        → (owner only)
GET    /api/kernel/objects            → ?type=&owner=&visibility=&parent=&limit=&cursor=
```

### Ledger

```
GET    /api/kernel/ledger/balance     → current balance
POST   /api/kernel/ledger/transfer    → { to_user, amount, reference? }
GET    /api/kernel/ledger/history     → ?limit=&cursor=
```

## Platform SDK

A lightweight TypeScript client library that generated apps import. Published as an npm package available inside the build container.

**Package name:** `@jelly/platform`

**Full API surface:**

```typescript
// --- Auth ---
platform.auth.getUser(): Promise<User | null>
platform.auth.requireUser(): Promise<User>  // redirects to login if unauthenticated

// --- Graph ---
platform.graph.link(toUser: string, type: string, metadata?: object): Promise<void>
platform.graph.unlink(toUser: string, type: string): Promise<void>
platform.graph.query(params: {
  from?: string;
  to?: string;
  type?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ edges: Relationship[]; cursor?: string }>

// --- Objects ---
platform.objects.create(type: string, payload: object, visibility?: Visibility): Promise<PlatformObject>
platform.objects.get(objectId: string): Promise<PlatformObject>
platform.objects.update(objectId: string, payload: object): Promise<PlatformObject>
platform.objects.delete(objectId: string): Promise<void>
platform.objects.query(params: {
  type?: string;
  owner?: string;
  visibility?: string;
  parent?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ objects: PlatformObject[]; cursor?: string }>

// --- Ledger ---
platform.ledger.balance(): Promise<{ balance: number }>
platform.ledger.transfer(toUser: string, amount: number, reference?: string): Promise<void>
platform.ledger.history(params: {
  limit?: number;
  cursor?: string;
}): Promise<{ entries: LedgerEntry[]; cursor?: string }>
```

**Types:**

```typescript
interface User {
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  profile: Record<string, any>;
}

type Visibility = 'private' | 'relationships' | 'public';

interface Relationship {
  from_user: string;
  to_user: string;
  rel_type: string;
  metadata: Record<string, any>;
  created_at: number;
}

interface PlatformObject {
  object_id: string;
  owner_id: string;
  object_type: string;
  payload: Record<string, any>;
  visibility: Visibility;
  parent_id: string | null;
  created_at: number;
  updated_at: number;
}

interface LedgerEntry {
  entry_id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  entry_type: string;
  reference_id: string | null;
  counterparty_id: string | null;
  created_at: number;
}
```

**SDK initialization:** The SDK reads the JWT from the cookie automatically. No configuration required in generated app code.

```typescript
import { platform } from '@jelly/platform';

const user = await platform.auth.requireUser();
const posts = await platform.objects.query({ type: 'post', owner: user.user_id });
```

## Payment Provider Abstraction

The ledger handles all internal transactions. External money movement (deposits and withdrawals) goes through a pluggable payment provider interface.

```typescript
interface PaymentProvider {
  createSellerAccount(userId: string): Promise<{
    accountId: string;
    onboardingUrl: string;
  }>;
  createCheckout(params: {
    buyerId: string;
    sellerId: string;
    listingId: string;
    amountCents: number;
    platformFeeCents: number;
  }): Promise<{ checkoutUrl: string }>;
  verifyWebhook(request: Request): Promise<PaymentEvent>;
  createPayout(sellerId: string, amountCents: number): Promise<void>;
  cancelSubscription(subscriptionId: string): Promise<void>;
}
```

Implement `StripePaymentProvider` as the first adapter. Store the active provider name in an environment variable (`PAYMENT_PROVIDER=stripe`). The Worker instantiates the correct adapter at startup.

**D1 Schema for external payment integration:**

```sql
CREATE TABLE kernel_payment_accounts (
  user_id TEXT PRIMARY KEY REFERENCES kernel_users(user_id),
  provider TEXT NOT NULL,              -- 'stripe', etc.
  external_account_id TEXT NOT NULL,
  onboarding_complete INTEGER DEFAULT 0,
  payout_enabled INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

## AI Agent Modifications

The AI agent's system prompt must be updated so that generated apps use the platform SDK by default.

**Additions to the agent system prompt:**

1. All generated apps must import `@jelly/platform` for auth, data, and payments.
2. Generated apps must never implement their own authentication.
3. When a user requests social features (follows, posts, feeds), the agent uses `platform.graph` and `platform.objects` — it does not create custom database tables.
4. When a user requests payments or monetization, the agent uses `platform.ledger` — it does not integrate Stripe or any payment provider directly.
5. The agent should be aware of the available `object_type` and `rel_type` values already in use on the platform, so it can generate apps that interoperate with existing data.

**The `@jelly/platform` package must be pre-installed in the build container** (`SandboxDockerfile`) so that generated apps can import it without running `npm install` for it.

## Auth Middleware for Deployed Apps

Implemented in the Workers for Platforms dispatch layer, not in individual generated apps.

```typescript
// In the dispatch Worker (worker/ directory)
async function kernelAuthMiddleware(request: Request, env: Env): Promise<User | null> {
  const cookie = parseCookies(request.headers.get('Cookie'));
  const token = cookie['jelly_session'];
  if (!token) return null;

  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    return {
      user_id: payload.sub,
      email: payload.email,
      display_name: payload.name,
    };
  } catch {
    return null;
  }
}
```

The dispatch Worker calls this middleware before forwarding the request to the target app's Worker. The user context is passed via a request header (`X-Jelly-User: base64(JSON)`) that the `@jelly/platform` SDK reads.

## Dashboard

The user's home page on the platform. A React view at the root domain. Two sections:

**My Apps** — queries existing project data (already in D1) filtered by the authenticated user. Shows: app name, thumbnail from R2, status (draft / published / deployed), last modified, link to continue editing (Durable Object session), link to published URL.

**Apps I Use** — requires a new table:

```sql
CREATE TABLE kernel_user_app_access (
  user_id TEXT NOT NULL REFERENCES kernel_users(user_id),
  app_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',  -- 'owner' | 'user' | 'viewer'
  pinned INTEGER DEFAULT 0,
  first_accessed_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, app_id)
);
```

Populated automatically by the auth middleware when a user accesses any deployed app for the first time. The dashboard queries this table to show recently used apps, with pinning support.

## App Registry

Published apps and reusable components are listed in a registry for discovery.

```sql
CREATE TABLE kernel_app_registry (
  app_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES kernel_users(user_id),
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'unlisted' | 'public'
  thumbnail_r2_key TEXT,
  subdomain TEXT UNIQUE,
  listing_id TEXT,                    -- if monetized, references kernel_listings
  forked_from TEXT REFERENCES kernel_app_registry(app_id),
  deployed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE kernel_listings (
  listing_id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES kernel_users(user_id),
  item_type TEXT NOT NULL,            -- 'app' | 'component' | 'template'
  item_id TEXT NOT NULL,
  price_cents INTEGER,                -- null = free
  pricing_model TEXT NOT NULL DEFAULT 'one_time',  -- 'one_time' | 'monthly' | 'usage'
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE kernel_purchases (
  purchase_id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES kernel_users(user_id),
  listing_id TEXT NOT NULL REFERENCES kernel_listings(listing_id),
  external_payment_id TEXT,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'refunded' | 'expired'
  purchased_at INTEGER NOT NULL
);
```

Access enforcement for paid apps: the dispatch Worker checks `kernel_purchases` for the authenticated user and the target app's `listing_id`. If no active purchase exists, it returns the listing page instead of the app.

## Component Registry

Reusable components extracted from generated apps. When the AI agent generates an app, it can also register individual components as reusable.

```sql
CREATE TABLE kernel_components (
  component_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES kernel_users(user_id),
  name TEXT NOT NULL,
  description TEXT,
  r2_bundle_key TEXT NOT NULL,        -- R2 key for the ES module bundle
  interface_json TEXT,                -- { provides: string[], consumes: string[] }
  source_app_id TEXT REFERENCES kernel_app_registry(app_id),
  listing_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

When a user building a new app says "include an expense tracker," the agent checks the component registry, finds a matching component, and imports it into the new app's bundle rather than generating from scratch.

## Implementation Order

Build in this sequence. Each phase is independently useful.

### Phase 1: Kernel Schema + API

1. Create Drizzle schema definitions for all `kernel_*` tables.
2. Generate and run D1 migrations.
3. Implement `/api/kernel/*` routes on the main Worker.
4. Write integration tests for each endpoint.

### Phase 2: Auth Integration

1. Modify the existing OAuth flow to create/update `kernel_users` rows.
2. Implement JWT minting and cookie setting on the root domain.
3. Implement the auth middleware in the Workers for Platforms dispatch layer.
4. Implement the `X-Jelly-User` header injection.

### Phase 3: Platform SDK

1. Create the `@jelly/platform` TypeScript package in a new `packages/platform/` directory.
2. Implement all SDK methods as HTTP calls to `/api/kernel/*`.
3. Add the package to the build container's `node_modules`.
4. Write tests.

### Phase 4: Dashboard

1. Add the dashboard view to the existing React frontend.
2. Implement "My Apps" using existing project data.
3. Implement "Apps I Use" with the `kernel_user_app_access` table.
4. Implement the app registry browse/search UI.

### Phase 5: AI Agent Update

1. Update the agent system prompt to reference the `@jelly/platform` SDK.
2. Add SDK documentation to the agent's context.
3. Test: ask the agent to build a social posting app and verify it uses `platform.objects` and `platform.graph` instead of custom storage.

### Phase 6: Monetization

1. Implement the `PaymentProvider` interface and `StripePaymentProvider` adapter.
2. Build the listing/publish flow in the dashboard.
3. Implement purchase checking in the dispatch Worker.
4. Implement the ledger transfer logic with atomic D1 batches.

### Phase 7: Component Registry

1. Build the component extraction flow (agent registers components during generation).
2. Implement component search in the agent's context so it can reuse existing components.
3. Build the component marketplace UI.

## File Locations (Where to Put Things)

Following the existing Jelly project structure:

```
migrations/
  XXXX_kernel_schema.sql              -- D1 migration for all kernel tables

worker/
  kernel/
    auth.ts                           -- JWT minting, verification, middleware
    users.ts                          -- user CRUD routes
    graph.ts                          -- relationship routes
    objects.ts                        -- content object routes
    ledger.ts                         -- ledger routes
    payments/
      interface.ts                    -- PaymentProvider interface
      stripe.ts                       -- Stripe adapter
    middleware.ts                     -- dispatch auth middleware

packages/
  platform/
    src/
      index.ts                        -- SDK entry point, exports `platform`
      auth.ts
      graph.ts
      objects.ts
      ledger.ts
      types.ts
    package.json
    tsconfig.json

src/
  components/
    dashboard/
      Dashboard.tsx                   -- main dashboard view
      MyApps.tsx
      AppsIUse.tsx
      AppRegistry.tsx
      ListingPage.tsx

shared/types/
  kernel.ts                           -- shared TypeScript types for kernel entities
```

## Environment Variables (New)

Add to `.dev.vars.example` and `wrangler.jsonc`:

```
JWT_SECRET          -- already exists, reuse for kernel JWTs
PLATFORM_FEE_PCT    -- platform transaction fee percentage (default: 10)
PAYMENT_PROVIDER    -- 'stripe' | 'none' (default: 'none')
STRIPE_SECRET_KEY   -- Stripe API secret (only if PAYMENT_PROVIDER=stripe)
STRIPE_WEBHOOK_SECRET -- Stripe webhook signing secret
ROOT_DOMAIN         -- root domain for cookie scoping (e.g., 'jelly.example.com')
```

## Constraints

- All kernel tables use `TEXT` primary keys (UUIDs), not auto-incrementing integers. D1 is SQLite; UUIDs prevent conflicts in distributed scenarios.
- All timestamps are Unix milliseconds stored as `INTEGER`.
- All JSON columns store valid JSON strings, never raw objects. Parse on read.
- The ledger is append-only. No updates, no deletes. Balance is computed from the sum of entries or cached in `balance_after`.
- The kernel API returns JSON. No HTML rendering on API routes.
- Cursor-based pagination on all list endpoints. No offset-based pagination.
- The SDK must have zero dependencies beyond the platform's own types. It makes `fetch()` calls. Nothing else.
