import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./client.js";

console.log("Running migrations…");

await migrate(db, {
  migrationsFolder: new URL("./migrations", import.meta.url).pathname,
});

console.log("Migrations complete ✓");
process.exit(0);
