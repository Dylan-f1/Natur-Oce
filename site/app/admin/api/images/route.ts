import { origineDesEntetes } from "@/lib/auth";
import { enregistrerImage } from "@/lib/db/images";
import { TAILLE_MAX_SERVEUR, analyserImage } from "@/lib/images";
import { sessionCourante } from "@/lib/session";

// Réception d'une image d'article, déjà réduite par le navigateur (specs/SPEC-images.md, EF-11).
// Corps : le fichier brut (WebP ou JPEG). Rien de ce que le navigateur annonce n'est cru : type et
// dimensions sont lus dans le fichier lui-même.

function erreur(statut: number, message: string): Response {
  return Response.json({ erreur: message }, { status: statut, headers: { "Cache-Control": "no-store" } });
}

export async function POST(requete: Request): Promise<Response> {
  // Même origine seulement (le cookie SameSite=Lax protège déjà ; ceci ferme la porte en plus).
  if (requete.headers.get("origin") !== origineDesEntetes(requete.headers)) {
    return erreur(403, "Envoi refusé : il doit venir de l’administration du site.");
  }
  if (!(await sessionCourante())) return erreur(401, "Votre session a expiré. Reconnectez-vous puis réessayez.");

  // Taille annoncée d'abord, pour ne pas lire un corps démesuré ; puis taille réelle.
  const annoncee = Number(requete.headers.get("content-length") ?? "0");
  if (annoncee > TAILLE_MAX_SERVEUR) return erreur(413, "L’image réduite dépasse 1,5 Mo. Choisissez une photo plus petite.");
  const octets = new Uint8Array(await requete.arrayBuffer());

  const analyse = analyserImage(octets);
  if (!analyse.ok) return erreur(octets.length > TAILLE_MAX_SERVEUR ? 413 : 415, `${analyse.raison}.`);

  const cle = `${crypto.randomUUID()}.${analyse.extension}`;
  try {
    await enregistrerImage({ cle, type: analyse.type, donnees: octets, largeur: analyse.largeur, hauteur: analyse.hauteur });
  } catch (e) {
    console.error("[images] enregistrement impossible", e);
    return erreur(500, "L’image n’a pas pu être enregistrée. Réessayez dans un instant.");
  }
  return Response.json(
    { src: `/images/${cle}`, largeur: analyse.largeur, hauteur: analyse.hauteur },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
