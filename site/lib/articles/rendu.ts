// Rendu des articles : JSON de l'éditeur (Tiptap / ProseMirror) → HTML public, en liste blanche
// (specs/SPEC-articles.md, D-20). Logique pure, testée dans tests/unit/articles.test.ts.
//
// Principe : on ne nettoie pas du HTML, on le fabrique. Chaque nœud et chaque marque connus
// produisent un HTML fixe ; le texte est toujours échappé ; les liens et les images n'acceptent
// que des adresses vérifiées ; tout ce qui est inconnu ou mal formé est ignoré. Aucun HTML saisi
// ne peut donc arriver tel quel dans la page.

type Marque = { type?: unknown; attrs?: Record<string, unknown> };
type Noeud = { type?: unknown; text?: unknown; attrs?: Record<string, unknown>; marks?: unknown; content?: unknown };

const PROFONDEUR_MAX = 20; // listes imbriquées, citations… au-delà : ignoré
const DOMAINE = "natur-oce.fr";

const ENTITES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function echapper(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => ENTITES[c]);
}

/** Lien autorisé : https, http, mailto, ou chemin interne (« /conseils/… », pas « //… »). */
export function lienSur(href: unknown): { href: string; externe: boolean } | null {
  if (typeof href !== "string") return null;
  const brut = href.trim();
  if (brut.length === 0 || brut.length > 2000) return null;
  if (/^\/(?!\/)/.test(brut)) return /[\s\\]/.test(brut) ? null : { href: brut, externe: false };
  let url: URL;
  try {
    url = new URL(brut);
  } catch {
    return null;
  }
  if (url.protocol === "mailto:") return { href: url.href, externe: false };
  if (url.protocol !== "https:" && url.protocol !== "http:") return null; // javascript:, data:, vbscript:…
  if (url.username || url.password) return null; // https://natur-oce.fr@pirate.example
  const interne = url.hostname === DOMAINE || url.hostname === `www.${DOMAINE}`;
  return { href: url.href, externe: !interne };
}

/** Image autorisée : uniquement celles servies par le site (module images, R2). */
export function imageSure(src: unknown): string | null {
  return typeof src === "string" && /^\/images\/[a-z0-9][a-z0-9/-]{0,120}\.webp$/.test(src) && !src.includes("..")
    ? src
    : null;
}

function entierPositif(v: unknown, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 && v <= max ? v : null;
}

function marques(n: Noeud): Marque[] {
  return Array.isArray(n.marks) ? (n.marks.filter((m) => m && typeof m === "object") as Marque[]) : [];
}

function enfants(n: Noeud): Noeud[] {
  return Array.isArray(n.content) ? (n.content.filter((c) => c && typeof c === "object") as Noeud[]) : [];
}

function rendreTexte(n: Noeud): string {
  if (typeof n.text !== "string" || n.text.length === 0) return "";
  let html = echapper(n.text);
  const types = new Set(marques(n).map((m) => m.type));
  if (types.has("italic")) html = `<em>${html}</em>`;
  if (types.has("bold")) html = `<strong>${html}</strong>`;
  const lien = marques(n).find((m) => m.type === "link");
  if (lien) {
    const sur = lienSur(lien.attrs?.href);
    if (sur) html = `<a href="${echapper(sur.href)}"${sur.externe ? ' rel="noopener noreferrer"' : ""}>${html}</a>`;
  }
  return html;
}

function rendreEnfants(n: Noeud, profondeur: number): string {
  return enfants(n)
    .map((c) => rendreNoeud(c, profondeur + 1))
    .join("");
}

function rendreNoeud(n: Noeud, profondeur: number): string {
  if (profondeur > PROFONDEUR_MAX) return "";
  switch (n.type) {
    case "text":
      return rendreTexte(n);
    case "paragraph": {
      const contenu = rendreEnfants(n, profondeur);
      return contenu ? `<p>${contenu}</p>` : "";
    }
    case "heading": {
      // h1 = titre de la page : les intertitres de l'article sont h2 ou h3.
      const niveau = entierPositif(n.attrs?.level, 6) === 2 || n.attrs?.level === 1 ? 2 : 3;
      const contenu = rendreEnfants(n, profondeur);
      return contenu ? `<h${niveau}>${contenu}</h${niveau}>` : "";
    }
    case "bulletList":
      return `<ul>${rendreEnfants(n, profondeur)}</ul>`;
    case "orderedList": {
      const debut = entierPositif(n.attrs?.start, 1000);
      return `<ol${debut && debut > 1 ? ` start="${debut}"` : ""}>${rendreEnfants(n, profondeur)}</ol>`;
    }
    case "listItem":
      return `<li>${rendreEnfants(n, profondeur)}</li>`;
    case "blockquote":
      return `<blockquote>${rendreEnfants(n, profondeur)}</blockquote>`;
    case "hardBreak":
      return "<br>";
    case "image": {
      const src = imageSure(n.attrs?.src);
      const alt = typeof n.attrs?.alt === "string" ? n.attrs.alt.trim() : "";
      if (!src || !alt) return ""; // description obligatoire (RGAA, EF-11)
      const l = entierPositif(n.attrs?.width, 4000);
      const h = entierPositif(n.attrs?.height, 4000);
      const dims = l && h ? ` width="${l}" height="${h}"` : "";
      return `<img src="${echapper(src)}" alt="${echapper(alt)}"${dims} loading="lazy" decoding="async">`;
    }
    default:
      return ""; // nœud inconnu (code, iframe, tableau…) : ignoré, avec son contenu
  }
}

/** HTML public d'un article à partir du JSON de l'éditeur. Entrée invalide → chaîne vide. */
export function rendreArticle(doc: unknown): string {
  if (!doc || typeof doc !== "object" || (doc as Noeud).type !== "doc") return "";
  return rendreEnfants(doc as Noeud, 0);
}

/** Texte brut de l'article (description par défaut, recherche), sans balise. */
export function texteBrut(doc: unknown, limite = 300): string {
  const morceaux: string[] = [];
  const parcourir = (n: Noeud, profondeur: number) => {
    if (profondeur > PROFONDEUR_MAX || morceaux.join(" ").length > limite) return;
    if (n.type === "text" && typeof n.text === "string") morceaux.push(n.text);
    for (const c of enfants(n)) parcourir(c, profondeur + 1);
  };
  if (doc && typeof doc === "object") parcourir(doc as Noeud, 0);
  const texte = morceaux.join(" ").replace(/\s+/g, " ").trim();
  return texte.length > limite ? `${texte.slice(0, limite - 1).trimEnd()}…` : texte;
}
