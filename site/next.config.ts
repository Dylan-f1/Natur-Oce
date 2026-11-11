import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Désactivés (activés par défaut dans Next 16) : avec OpenNext 1.20, le Worker se bloque
  // (« code had hung ») car Cache Components dépend d'un setTimeout que workerd n'imite pas.
  // Les pages publiques sont pré-générées, ces options n'apportent rien ici. À réévaluer
  // quand OpenNext annoncera leur prise en charge.
  cacheComponents: false,
  partialPrefetching: false,
  images: {
    // Pas d'optimisation à la volée (Cloudflare Images est payant au-delà d'un quota) :
    // les images sont exportées aux bonnes dimensions dans public/ (RSE-01).
    unoptimized: true,
  },
};

export default nextConfig;

// Donne accès aux bindings Cloudflare (D1, R2…) pendant `next dev`.
initOpenNextCloudflareForDev();
