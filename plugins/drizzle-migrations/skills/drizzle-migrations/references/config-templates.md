# Drizzle Config Templates

## PostgreSQL (Neon / Supabase / Standard)

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Optional: restrict to specific schemas
  // schemaFilter: ["public"],
  // Optional: use verbose output for debugging
  // verbose: true,
  // Optional: always ask for confirmation on destructive changes
  // strict: true,
});
```

### Neon-specific notes

- Use the pooled connection string for `push`/`migrate` (ends in `-pooler`)
- For serverless functions, use `@neondatabase/serverless` driver
- Neon supports branching — use branch URLs for staging migrations

### Supabase-specific notes

- Connection string is in Project Settings → Database → Connection string
- Use the "Session mode" connection for migrations (port 5432), not the pooler (port 6543)
- Supabase has its own migration system — if already using it, consider sticking with one

## MySQL

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### MySQL-specific notes

- DDL statements are NOT transactional — a failed migration leaves partial state
- Use `int("id").autoincrement().primaryKey()` instead of `serial`
- No native UUID type — use `varchar(36)` or `binary(16)`
- `TEXT` columns cannot have default values

## SQLite

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "./local.db",
  },
});
```

### SQLite-specific notes

- Very limited ALTER TABLE: only ADD COLUMN works natively
- Drizzle-kit handles column renames/drops by recreating the table
- No `BOOLEAN` type — uses INTEGER (0/1)
- No `TIMESTAMP` type — use TEXT (ISO string) or INTEGER (unix epoch)

## Turso (libSQL)

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});
```

## Multi-schema setup

When schema is split across multiple files:

```typescript
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/*.ts",  // glob pattern
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

Make sure all tables and relations are exported from the matched files. Drizzle-kit reads all exports and builds the full schema graph.
