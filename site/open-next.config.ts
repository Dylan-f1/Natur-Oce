// Configuration OpenNext pour Cloudflare.
// Pas de cache incrémental R2 pour l'instant : les pages publiques sont pré-générées.
// À ajouter quand l'administration publiera des articles (revalidation).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
