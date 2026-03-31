# drizzle-migrations

An [Agent Skill](https://agentskills.io) for Claude Code and OpenAI Codex CLI that generates, validates, and troubleshoots [Drizzle ORM](https://orm.drizzle.team) migrations.

Ships with a **destructive change detector** that catches `DROP TABLE`, `DROP COLUMN`, unsafe type casts, and `SET NOT NULL` on existing columns — before they hit your database.

Works with PostgreSQL, MySQL, SQLite, Neon, Supabase, Turso, and PlanetScale.

## What it does

- **Generates migrations** — walks you through schema changes following Drizzle best practices
- **Validates generated SQL** — runs the bundled `validate-migration.mjs` script to flag destructive and unsafe operations with actionable suggestions
- **Picks the right config** — includes templates for every dialect and major hosted provider (Neon, Supabase, Turso)
- **Handles edge cases** — migration conflicts, squashing, introspecting existing databases, custom SQL in migrations
- **CI/CD-ready** — programmatic migration runner examples for every Drizzle driver, plus Docker and GitHub Actions patterns

## Install

### Claude Code

```bash
# Add as a marketplace
/plugin marketplace add igorlourenco/drizzle-migrations

# Install the skill
/plugin install drizzle-migrations
```

Or manually:

```bash
# Personal (all projects)
git clone https://github.com/igorlourenco/drizzle-migrations.git ~/.claude/skills/drizzle-migrations

# Per-project (shared via git)
git clone https://github.com/igorlourenco/drizzle-migrations.git .claude/skills/drizzle-migrations
```

### OpenAI Codex CLI

```bash
git clone https://github.com/igorlourenco/drizzle-migrations.git ~/.codex/skills/drizzle-migrations
```

Both tools use the same Agent Skills format — install once, works everywhere.

## Usage

The skill triggers automatically when you mention anything related to Drizzle migrations. Just talk to Claude naturally:

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

The skill automatically runs the validator after generating migrations, but you can also use it standalone:

```bash
node scripts/validate-migration.mjs path/to/0001_migration.sql postgresql
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

## What's inside

```
drizzle-migrations/
├── SKILL.md                              # Main skill instructions
├── plugin.json                           # Marketplace manifest
├── scripts/
│   └── validate-migration.mjs            # Destructive change detector
└── references/
    ├── config-templates.md               # drizzle.config.ts for every dialect/provider
    └── migrate-programmatic.md           # Migration runners for every driver + CI/CD
```

## Supported dialects & drivers

| Dialect    | Drivers                                                        |
| ---------- | -------------------------------------------------------------- |
| PostgreSQL | `postgres`, `pg`, `@neondatabase/serverless`, Supabase         |
| MySQL      | `mysql2`, PlanetScale                                          |
| SQLite     | `better-sqlite3`, `bun:sqlite`                                 |
| Turso      | `@libsql/client`                                               |

## Detected issues

The validator flags these patterns in generated migration SQL:

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

PRs welcome. Some ideas:

- [ ] More dialect-specific validations (e.g., MySQL charset/collation changes)
- [ ] Rollback SQL generation for destructive migrations
- [ ] Integration with `drizzle-kit check` when it stabilizes
- [ ] JSON output mode for CI pipeline integration

## License

MIT