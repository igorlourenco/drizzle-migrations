# drizzle-migrations

A Claude Code plugin that generates, validates, and troubleshoots [Drizzle ORM](https://orm.drizzle.team) migrations.

Ships with a **destructive change detector** that catches `DROP TABLE`, `DROP COLUMN`, unsafe type casts, and `SET NOT NULL` on existing columns — before they hit your database.

Works with PostgreSQL, MySQL, SQLite, Neon, Supabase, Turso, and PlanetScale.

## What it does

- **Generates migrations** — walks you through schema changes following Drizzle best practices
- **Validates generated SQL** — flags destructive and unsafe operations with actionable fix suggestions
- **Picks the right config** — includes templates for every dialect and major hosted provider
- **Handles edge cases** — migration conflicts, squashing, introspecting existing databases, custom SQL
- **CI/CD-ready** — programmatic migration runner examples for every Drizzle driver, Docker, and GitHub Actions

## Install

```bash
# 1. Add the marketplace
/plugin marketplace add igorlourenco/drizzle-migrations

# 2. Install the plugin
/plugin install drizzle-migrations@igorlourenco-drizzle-migrations
```

Also works with OpenAI Codex CLI (same Agent Skills format).

## Usage

The skill triggers automatically when you mention anything related to Drizzle migrations. Just talk naturally:

```
> Add a "status" column to the posts table with a default of "draft"
```

```
> Set up Drizzle migrations for my Neon Postgres project from scratch
```

```
> I have a migration that drops a column — is it safe?
```

```
> Squash my 47 migration files into one
```

```
> Generate the programmatic migrator for my Hono app using @neondatabase/serverless
```

### Validation script

The skill runs the validator automatically after generating migrations. You can also run it standalone:

```bash
node plugins/drizzle-migrations/skills/drizzle-migrations/scripts/validate-migration.mjs path/to/0001_migration.sql postgresql
```

Example output:

```
📋 Migration Validation: 0001_migration.sql
   Dialect: postgresql
   Statements: 5

🔴 DESTRUCTIVE OPERATIONS (2):
   ⛔ DROP COLUMN detected — column data will be permanently deleted
      SQL: ALTER TABLE "users" DROP COLUMN "legacy_field"...
      💡 Rename column to _deprecated_<n>, backfill data to new location, then drop in a later migration

   ⛔ DROP TABLE detected — all data in this table will be permanently deleted
      SQL: DROP TABLE "old_logs"...
      💡 Consider renaming to _archived_<n> first, drop after confirming no dependencies

🟡 WARNINGS (1):
   ⚠️  SET NOT NULL on existing column — fails if any NULL values exist
      SQL: ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL...
      💡 Add a prior statement: UPDATE <table> SET <col> = <default> WHERE <col> IS NULL

---
❌ Destructive operations require explicit human approval before applying.
```

Exit codes: `0` = clean, `1` = warnings, `2` = destructive (needs approval).

## Repo structure

```
drizzle-migrations/
├── .claude-plugin/
│   └── marketplace.json                          # Marketplace manifest
├── plugins/
│   └── drizzle-migrations/
│       ├── .claude-plugin/
│       │   └── plugin.json                       # Plugin manifest
│       └── skills/
│           └── drizzle-migrations/
│               ├── SKILL.md                      # Main skill instructions
│               ├── scripts/
│               │   └── validate-migration.mjs    # Destructive change detector
│               └── references/
│                   ├── config-templates.md        # drizzle.config.ts for every dialect
│                   └── migrate-programmatic.md    # Migration runners + CI/CD patterns
└── README.md
```

## Supported dialects & drivers

| Dialect    | Drivers                                                        |
| ---------- | -------------------------------------------------------------- |
| PostgreSQL | `postgres`, `pg`, `@neondatabase/serverless`, Supabase         |
| MySQL      | `mysql2`, PlanetScale                                          |
| SQLite     | `better-sqlite3`, `bun:sqlite`                                 |
| Turso      | `@libsql/client`                                               |

## Detected issues

| Severity    | Pattern              | What it catches                                    |
| ----------- | -------------------- | -------------------------------------------------- |
| Destructive | `DROP TABLE`         | Permanent data loss                                |
| Destructive | `DROP COLUMN`        | Column data deleted                                |
| Destructive | `TRUNCATE`           | All rows deleted                                   |
| Warning     | `DROP INDEX`         | Potential query performance regression              |
| Warning     | `DROP CONSTRAINT`    | Data integrity rules removed                       |
| Warning     | `SET NOT NULL`       | Fails if NULLs exist in the column                 |
| Warning     | `ALTER COLUMN TYPE`  | Fails if data can't be cast to new type            |
| Warning     | `RENAME TABLE`       | Breaks queries referencing old name                |
| Warning     | `RENAME COLUMN`      | Breaks queries referencing old column name          |
| Info        | `NOT NULL` no default| INSERTs fail if column value not provided          |

MySQL-specific: warns that DDL is not transactional (partial failures leave dirty state).
SQLite-specific: warns about limited ALTER TABLE support.

## Contributing

PRs welcome. Ideas:

- [ ] More dialect-specific validations (e.g., MySQL charset/collation changes)
- [ ] Rollback SQL generation for destructive migrations
- [ ] Integration with `drizzle-kit check` when it stabilizes
- [ ] JSON output mode for CI pipeline integration

## License

MIT