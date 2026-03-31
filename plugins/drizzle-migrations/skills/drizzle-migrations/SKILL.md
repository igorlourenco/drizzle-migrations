---
name: drizzle-migrations
description: >
  Generate, validate, and troubleshoot Drizzle ORM schema migrations for PostgreSQL, MySQL, and SQLite.
  Use this skill whenever the user mentions Drizzle migrations, drizzle-kit, schema changes, 
  adding/removing columns or tables with Drizzle, migration conflicts, drizzle push vs generate,
  migration squashing, or any database schema evolution task involving Drizzle ORM.
  Also trigger when the user has a Drizzle schema file and wants to understand what migration
  it would produce, needs help fixing a failed migration, wants to add indexes/constraints/relations,
  or is setting up Drizzle migrations for the first time in a project.
  Covers: drizzle-kit generate, drizzle-kit push, drizzle-kit migrate, migration validation,
  destructive change detection, migration squashing, seed files, and CI/CD integration.
---

# Drizzle Migrations Skill

## Overview

This skill helps with every aspect of Drizzle ORM migrations — from initial setup to production deployment. It generates safe, validated migrations and catches destructive changes before they hit your database.

## Step 1: Understand the project context

Before generating anything, gather context:

1. **Check for existing Drizzle config** — look for `drizzle.config.ts` (or `.js`, `.json`) in the project root
2. **Identify the database dialect** — PostgreSQL (most common), MySQL, or SQLite
3. **Find schema files** — typically in `src/db/schema.ts`, `src/schema/`, or `drizzle/schema.ts`
4. **Check for existing migrations** — look in `drizzle/` or the configured `out` directory
5. **Identify the ORM package** — `drizzle-orm` + the dialect driver (`@neondatabase/serverless`, `postgres`, `better-sqlite3`, `mysql2`, etc.)

If no Drizzle config exists, help the user create one. Read `references/config-templates.md` for dialect-specific templates.

## Step 2: Schema change workflow

When the user wants to make a schema change, follow this sequence:

### 2a. Write the schema change

Edit the schema file(s) using Drizzle's table builder API. Key patterns:

**Adding a column:**
```typescript
// Add with a default so existing rows aren't broken
status: varchar("status", { length: 50 }).notNull().default("active"),
```

**Adding an index:**
```typescript
import { index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  // ... columns
}, (table) => [
  index("users_email_idx").on(table.email),
  uniqueIndex("users_username_idx").on(table.username),
]);
```

**Adding a relation:**
```typescript
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));
```

**Adding a new table with foreign key:**
```typescript
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 2b. Generate the migration

Run drizzle-kit to produce the SQL migration file:

```bash
npx drizzle-kit generate
```

This reads the schema, compares it to the migration history (the `_journal.json` and snapshot files in the `out` directory), and produces a new `.sql` file.

If the user prefers to apply changes directly without migration files (dev only):

```bash
npx drizzle-kit push
```

**When to use which:**
- `generate` → production projects, teams, CI/CD pipelines — creates versioned migration files you commit to git
- `push` → rapid prototyping, solo dev, early-stage projects — applies schema diff directly to the database

### 2c. Validate the generated migration

After generating, ALWAYS review the SQL file. Run the validation script:

```bash
# From the skill's scripts directory
node scripts/validate-migration.mjs <path-to-migration.sql> <dialect>
```

Or manually check for these **destructive operations** that need human confirmation:

- `DROP TABLE` — data loss, irreversible
- `DROP COLUMN` — data loss
- `ALTER COLUMN ... TYPE` — may fail if data can't be cast
- `ALTER COLUMN ... SET NOT NULL` — fails if nulls exist
- `DROP INDEX` on a column used in WHERE clauses — performance regression

If any destructive operation is detected, warn the user explicitly and suggest a safer alternative:

| Destructive operation | Safer alternative |
|---|---|
| DROP COLUMN | Add a migration to copy data first, or rename column to `_deprecated_*` |
| ALTER TYPE | Create new column → backfill → swap → drop old |
| SET NOT NULL | First UPDATE to fill nulls, then ALTER |
| DROP TABLE | Rename to `_archived_*`, drop after confirming |

### 2d. Apply the migration

```bash
npx drizzle-kit migrate
```

Or programmatically in the app's startup:

```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

await migrate(db, { migrationsFolder: "./drizzle" });
```

Read `references/migrate-programmatic.md` for driver-specific migration runner examples.

## Step 3: Common scenarios

### First-time setup

If the project has no Drizzle config or migrations directory:

1. Create `drizzle.config.ts` (see `references/config-templates.md`)
2. Ensure schema files exist with at least one table
3. Run `npx drizzle-kit generate` to create the initial migration
4. Run `npx drizzle-kit migrate` or `push` to apply
5. Commit the `drizzle/` folder (migrations + snapshots + journal)

### Fixing migration conflicts

When two branches modify the schema and both generate migrations:

1. Delete the conflicting migration files (keep the journal clean)
2. Run `npx drizzle-kit generate` again from the merged schema
3. Review the new migration — it should capture both changes
4. The `_journal.json` will have a new entry; commit it

### Squashing migrations

When the migrations folder gets large (50+ files), squash them:

1. Ensure all environments are up to date
2. Delete all migration files and the `_journal.json`
3. Run `npx drizzle-kit generate` — produces a single migration from current schema
4. Mark this migration as applied in all environments (or recreate the database)

This is a **coordinated operation** — all team members and environments must be in sync first.

### Introspecting an existing database

To pull a schema from a database that wasn't built with Drizzle:

```bash
npx drizzle-kit introspect
```

This generates schema TypeScript files from the live database. Review and clean up the generated code — auto-generated names may not match your conventions.

### Custom migration SQL

Sometimes you need to add manual SQL to a migration (data backfill, extension creation, etc.). Edit the generated `.sql` file directly — Drizzle won't overwrite it. Just make sure the SQL is idempotent where possible:

```sql
-- Add the uuid extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Backfill the new column
UPDATE users SET display_name = username WHERE display_name IS NULL;
```

## Step 4: CI/CD integration

For production deployments, migrations should run automatically. The pattern:

```bash
# In your CI/CD pipeline or Dockerfile
npx drizzle-kit migrate
```

Or use the programmatic migrator (Step 2d) in your app's startup/deploy script.

**Never run `drizzle-kit push` in production.** It skips migration files and applies diffs directly, which means no audit trail and no rollback path.

## Dialect-specific notes

- **PostgreSQL**: Full feature support. Use `serial`/`bigserial` or `uuid` for PKs. Supports `RETURNING`, array types, JSON operators.
- **MySQL**: No transactional DDL — each statement in a migration commits immediately. Failed migrations leave partial state. Use `int` with `autoincrement` for PKs.
- **SQLite**: Very limited ALTER TABLE. Adding columns works, but renaming/dropping columns requires table recreation. Drizzle-kit handles this automatically but generates longer SQL.

## Troubleshooting

**"No schema changes detected"** — Schema file path in `drizzle.config.ts` doesn't match actual file location. Check the `schema` field.

**"Column X already exists"** — Migration was partially applied. Check which statements ran and either fix the database state manually or regenerate.

**"Cannot drop column: depended on by view/trigger"** — Drop dependents first, then the column, then recreate dependents. Add all of this to a single migration file.

**Snapshot mismatch** — The `meta/_journal.json` or snapshot files got corrupted. Delete the `meta/` folder and regenerate from scratch (same as squashing).

**Type errors after migration** — Run `npx drizzle-kit generate` again — sometimes the TypeScript types lag behind the actual SQL migration. If using `drizzle-zod` or `drizzle-valibot`, regenerate validators too.
