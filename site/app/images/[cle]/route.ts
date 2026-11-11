import { lireImage } from "@/lib/db/images";
import { cleImageValide } from "@/lib/images";

// Image d'article lue dans D1 (D-22). Sert l'administration et les articles pas encore figés : une
// fois publiée, l'image est un fichier statique à la même adresse et ce code ne tourne plus (D-21).

export async function GET(_requete: Request, { params }: RouteContext<"/images/[cle]">): Promise<Response> {
  const { cle } = await params;
  const trouvee = cleImageValide(cle) ? await lireImage(cle) : null;
  if (!trouvee) return new Response("Image introuvable", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  return new Response(trouvee.donnees, {
    headers: {
      "Content-Type": trouvee.type,
      // La clé n'est jamais réutilisée : l'image peut rester en cache un an sans revalidation.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
