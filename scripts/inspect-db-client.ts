import { db } from "../src/prisma/db";

async function main() {
  const dbClient = db as unknown as { orm?: Record<string, unknown> };
  const orm = dbClient.orm;

  console.log("ORM type:", typeof orm);
  console.log("ORM keys:", Object.keys(orm ?? {}));
  console.log("ORM User accessor:", typeof orm?.User);
  console.log("ORM user accessor:", typeof orm?.user);
  console.log(
    "ORM prototype keys:",
    Object.getOwnPropertyNames(Object.getPrototypeOf(orm ?? {}))
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });
