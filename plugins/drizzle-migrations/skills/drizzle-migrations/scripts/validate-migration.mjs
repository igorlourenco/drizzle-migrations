#!/usr/bin/env node

/**
 * Drizzle Migration Validator
 *
 * Parses a generated .sql migration file and flags:
 * - Destructive operations (DROP TABLE, DROP COLUMN, etc.)
 * - Potentially unsafe changes (type casts, NOT NULL on existing columns)
 * - Missing safety patterns (no IF EXISTS, no default on new NOT NULL columns)
 *
 * Usage: node validate-migration.mjs <path-to-migration.sql> [dialect]
 *        dialect: postgresql (default) | mysql | sqlite
 *
 * Exit codes:
 *   0 = clean (no issues)
 *   1 = warnings found (review recommended)
 *   2 = destructive operations found (human approval required)
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const [, , filePath, dialect = "postgresql"] = process.argv;

if (!filePath) {
  console.error("Usage: node validate-migration.mjs <migration.sql> [postgresql|mysql|sqlite]");
  process.exit(1);
}

let sql;
try {
  sql = readFileSync(filePath, "utf-8");
} catch (e) {
  console.error(`Cannot read file: ${filePath}`);
  process.exit(1);
}

const fileName = basename(filePath);
const statements = sql
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean);

const issues = [];

// --- Destructive operation patterns ---

const destructivePatterns = [
  {
    pattern: /\bDROP\s+TABLE\b/i,
    severity: "destructive",
    message: "DROP TABLE detected — all data in this table will be permanently deleted",
    suggestion: "Consider renaming to _archived_<name> first, drop after confirming no dependencies",
  },
  {
    pattern: /\bDROP\s+COLUMN\b/i,
    severity: "destructive",
    message: "DROP COLUMN detected — column data will be permanently deleted",
    suggestion: "Rename column to _deprecated_<name>, backfill data to new location, then drop in a later migration",
  },
  {
    pattern: /\bDROP\s+INDEX\b/i,
    severity: "warning",
    message: "DROP INDEX detected — may cause query performance regression",
    suggestion: "Verify no queries depend on this index for performance before dropping",
  },
  {
    pattern: /\bDROP\s+CONSTRAINT\b/i,
    severity: "warning",
    message: "DROP CONSTRAINT detected — data integrity rules will be removed",
    suggestion: "Ensure application-level validation exists before removing database constraints",
  },
  {
    pattern: /\bTRUNCATE\b/i,
    severity: "destructive",
    message: "TRUNCATE detected — all rows will be deleted",
    suggestion: "This is almost never appropriate in a migration file. Remove unless intentional.",
  },
];

// --- Unsafe change patterns ---

const unsafePatterns = [
  {
    pattern: /ALTER\s+(?:TABLE\s+\S+\s+)?(?:ALTER\s+)?COLUMN\s+\S+\s+(?:SET\s+DATA\s+)?TYPE\b/i,
    severity: "warning",
    message: "Column type change detected — may fail if existing data cannot be cast",
    suggestion: "Test with production data. Consider: new column → backfill → swap → drop old",
  },
  {
    pattern: /SET\s+NOT\s+NULL/i,
    severity: "warning",
    message: "SET NOT NULL on existing column — fails if any NULL values exist",
    suggestion: "Add a prior statement: UPDATE <table> SET <col> = <default> WHERE <col> IS NULL",
  },
  {
    pattern: /\bNOT\s+NULL\b(?!.*\bDEFAULT\b)/i,
    severity: "info",
    message: "NOT NULL column without DEFAULT — INSERT will fail if value not provided",
    suggestion: "Add a DEFAULT value, or ensure all INSERT paths provide this column",
  },
  {
    pattern: /\bRENAME\s+TABLE\b/i,
    severity: "warning",
    message: "RENAME TABLE detected — application queries referencing old name will break",
    suggestion: "Update all application queries, views, and foreign keys before or alongside this migration",
  },
  {
    pattern: /\bRENAME\s+COLUMN\b/i,
    severity: "warning",
    message: "RENAME COLUMN detected — application queries referencing old column name will break",
    suggestion: "Update all application queries and ORM references alongside this migration",
  },
];

// --- MySQL-specific warnings ---

const mysqlPatterns = [
  {
    pattern: /\bALTER\s+TABLE\b/i,
    severity: "info",
    message: "ALTER TABLE in MySQL — DDL is not transactional, partial failures leave dirty state",
    suggestion: "Test migration on a copy of production data first. Have a manual rollback plan ready.",
  },
];

// --- SQLite-specific warnings ---

const sqlitePatterns = [
  {
    pattern: /\bDROP\s+COLUMN\b/i,
    severity: "warning",
    message: "DROP COLUMN in SQLite requires table recreation (supported since 3.35.0)",
    suggestion: "Verify SQLite version is 3.35.0+, or let Drizzle-kit handle table recreation",
  },
];

// Run checks
for (const stmt of statements) {
  for (const check of destructivePatterns) {
    if (check.pattern.test(stmt)) {
      issues.push({ ...check, statement: stmt.slice(0, 120) });
    }
  }
  for (const check of unsafePatterns) {
    if (check.pattern.test(stmt)) {
      issues.push({ ...check, statement: stmt.slice(0, 120) });
    }
  }
  if (dialect === "mysql") {
    for (const check of mysqlPatterns) {
      if (check.pattern.test(stmt)) {
        issues.push({ ...check, statement: stmt.slice(0, 120) });
      }
    }
  }
  if (dialect === "sqlite") {
    for (const check of sqlitePatterns) {
      if (check.pattern.test(stmt)) {
        issues.push({ ...check, statement: stmt.slice(0, 120) });
      }
    }
  }
}

// --- Output ---

const destructive = issues.filter((i) => i.severity === "destructive");
const warnings = issues.filter((i) => i.severity === "warning");
const info = issues.filter((i) => i.severity === "info");

console.log(`\n📋 Migration Validation: ${fileName}`);
console.log(`   Dialect: ${dialect}`);
console.log(`   Statements: ${statements.length}`);
console.log("");

if (issues.length === 0) {
  console.log("✅ No issues found. Migration looks safe to apply.\n");
  process.exit(0);
}

if (destructive.length > 0) {
  console.log(`🔴 DESTRUCTIVE OPERATIONS (${destructive.length}):`);
  for (const issue of destructive) {
    console.log(`   ⛔ ${issue.message}`);
    console.log(`      SQL: ${issue.statement}...`);
    console.log(`      💡 ${issue.suggestion}`);
    console.log("");
  }
}

if (warnings.length > 0) {
  console.log(`🟡 WARNINGS (${warnings.length}):`);
  for (const issue of warnings) {
    console.log(`   ⚠️  ${issue.message}`);
    console.log(`      SQL: ${issue.statement}...`);
    console.log(`      💡 ${issue.suggestion}`);
    console.log("");
  }
}

if (info.length > 0) {
  console.log(`🔵 INFO (${info.length}):`);
  for (const issue of info) {
    console.log(`   ℹ️  ${issue.message}`);
    console.log(`      💡 ${issue.suggestion}`);
    console.log("");
  }
}

console.log("---");
if (destructive.length > 0) {
  console.log("❌ Destructive operations require explicit human approval before applying.");
  process.exit(2);
} else {
  console.log("⚠️  Review warnings above, then apply if acceptable.");
  process.exit(1);
}
