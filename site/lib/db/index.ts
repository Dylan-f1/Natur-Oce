import { drizzle } from "drizzle-orm/d1";
import { env } from "@/lib/cloudflare";
import * as schema from "./schema";

/** Instance Drizzle liée à la base D1 de la requête en cours (binding `DB`). */
export async function db() {
  return drizzle((await env()).DB, { schema });
}
