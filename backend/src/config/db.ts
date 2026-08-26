import { PrismaClient } from "@prisma/client";

// Shared PrismaClient instance for database access.
// In Node process lifecycle, reusing a single instance prevents pool exhaustion.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});
