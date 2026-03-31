# Programmatic Migration Runners

Run migrations in application code instead of the CLI. Useful for serverless deploys, Docker containers, or custom deployment pipelines.

## PostgreSQL — Neon (HTTP)

```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function runMigrations() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
}

runMigrations().catch(console.error);
```

## PostgreSQL — Neon (WebSocket)

```typescript
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

await migrate(db, { migrationsFolder: "./drizzle" });
await pool.end();
```

## PostgreSQL — node-postgres (pg)

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

await migrate(db, { migrationsFolder: "./drizzle" });
await pool.end();
```

## PostgreSQL — postgres.js

```typescript
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Use max 1 connection for migrations
const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(migrationClient);

await migrate(db, { migrationsFolder: "./drizzle" });
await migrationClient.end();
```

## MySQL — mysql2

```typescript
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const connection = await mysql.createConnection(process.env.DATABASE_URL!);
const db = drizzle(connection);

await migrate(db, { migrationsFolder: "./drizzle" });
await connection.end();
```

## SQLite — better-sqlite3

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const sqlite = new Database("./local.db");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./drizzle" }); // synchronous for better-sqlite3
sqlite.close();
```

## Turso (libSQL)

```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./drizzle" });
```

## Bun — SQLite

```typescript
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const sqlite = new Database("./local.db");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./drizzle" });
sqlite.close();
```

## Integration patterns

### Run at app startup (Express/Hono/Fastify)

```typescript
// src/db/index.ts
import { migrate } from "drizzle-orm/neon-http/migrator";

export async function initDB() {
  if (process.env.RUN_MIGRATIONS === "true") {
    await migrate(db, { migrationsFolder: "./drizzle" });
  }
  return db;
}
```

### Run in a deploy script (package.json)

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "deploy": "npm run db:migrate && npm start"
  }
}
```

### Run in Docker

```dockerfile
# In your entrypoint
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
```

### Run in CI (GitHub Actions)

```yaml
- name: Run migrations
  run: npx tsx src/db/migrate.ts
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```
