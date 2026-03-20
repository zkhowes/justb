import { neon } from "@neondatabase/serverless";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log("migrate: DATABASE_URL not set, skipping migrations");
  process.exit(0);
}

const sql = neon(DATABASE_URL);

async function run() {
  // Ensure migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Get already-applied migrations
  const applied = await sql`SELECT name FROM _migrations ORDER BY name`;
  const appliedSet = new Set(applied.map((r) => r.name));

  // Read migration files
  const dir = join(process.cwd(), "migrations");
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ranCount = 0;
  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const content = await readFile(join(dir, file), "utf-8");
    console.log(`migrate: applying ${file}`);

    // Split on semicolons and run each statement
    const statements = content
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await sql.query(stmt);
    }

    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    ranCount++;
  }

  if (ranCount === 0) {
    console.log("migrate: all migrations already applied");
  } else {
    console.log(`migrate: applied ${ranCount} migration(s)`);
  }
}

run().catch((err) => {
  console.error("migrate: error:", err.message);
  process.exit(1);
});
