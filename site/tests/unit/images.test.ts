import { describe, expect, it } from "vitest";
import {
  TAILLE_MAX_NAVIGATEUR,
  TAILLE_MAX_SERVEUR,
  analyserImage,
  cleImageValide,
  verifierFichierChoisi,
} from "@/lib/images";
import { imageSure, rendreArticle } from "@/lib/articles/rendu";

// T10 · Images des articles (specs/SPEC-images.md, EF-11, D-22).

/** En-tête RIFF/WEBP suivi d'un morceau `fourcc` de `corps` (taille réelle respectée). */
function webp(fourcc: string, corps: number[]): Uint8Array {
  const morceau = [...fourcc].map((c) => c.charCodeAt(0));
  const taille = corps.length;
  const donnees = [...morceau, taille & 255, (taille >> 8) & 255, (taille >> 16) & 255, (taille >> 24) & 255, ...corps];
  const riff = 4 + donnees.length;
  return new Uint8Array([
    ..."RIFF".split("").map((c) => c.charCodeAt(0)),
    riff & 255, (riff >> 8) & 255, (riff >> 16) & 255, (riff >> 24) & 255,
    ..."WEBP".split("").map((c) => c.charCodeAt(0)),
    ...donnees,
  ]);
}

/** VP8 (avec perte) : 3 octets d'étiquette, code de départ, largeur et hauteur sur 14 bits. */
const vp8 = (l: number, h: number) => webp("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, l & 255, l >> 8, h & 255, h >> 8, 0, 0]);

/** VP8L (sans perte) : signature 0x2f puis largeur-1 et hauteur-1 sur 14 bits chacune. */
function vp8l(l: number, h: number): Uint8Array {
  const bits = (l - 1) | ((h - 1) << 14);
  return webp("VP8L", [0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >> 24) & 255, 0]);
}

/** VP8X (étendu) : drapeaux puis largeur-1 et hauteur-1 sur 24 bits. */
const vp8x = (l: number, h: number) =>
  webp("VP8X", [0, 0, 0, 0, (l - 1) & 255, ((l - 1) >> 8) & 255, ((l - 1) >> 16) & 255, (h - 1) & 255, ((h - 1) >> 8) & 255, ((h - 1) >> 16) & 255]);

/** JPEG minimal : SOI, un segment APP0, puis SOF0 (hauteur, largeur), puis SOS. */
const jpeg = (l: number, h: number, sof = 0xc0) =>
  new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46,
    0xff, sof, 0x00, 0x0b, 0x08, h >> 8, h & 255, l >> 8, l & 255, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x02,
  ]);

describe("analyserImage — signature et dimensions lues dans le fichier", () => {
  it("WebP avec perte (VP8)", () => {
    expect(analyserImage(vp8(1600, 1067))).toEqual({ ok: true, type: "image/webp", extension: "webp", largeur: 1600, hauteur: 1067 });
  });

  it("WebP sans perte (VP8L)", () => {
    expect(analyserImage(vp8l(1200, 800))).toMatchObject({ ok: true, type: "image/webp", largeur: 1200, hauteur: 800 });
  });

  it("WebP étendu (VP8X)", () => {
    expect(analyserImage(vp8x(1600, 2400))).toMatchObject({ ok: true, type: "image/webp", largeur: 1600, hauteur: 2400 });
  });

  it("JPEG (de base et progressif)", () => {
    expect(analyserImage(jpeg(1600, 1200))).toEqual({ ok: true, type: "image/jpeg", extension: "jpg", largeur: 1600, hauteur: 1200 });
    expect(analyserImage(jpeg(800, 600, 0xc2))).toMatchObject({ ok: true, largeur: 800, hauteur: 600 });
  });

  it("refuse PNG, GIF, SVG, HTML déguisé et fichiers vides ou tronqués", () => {
    const refus = [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG
      new TextEncoder().encode("GIF89a"),
      new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      new TextEncoder().encode("<!DOCTYPE html><script>alert(1)</script>"),
      new Uint8Array([]),
      vp8(100, 100).slice(0, 24), // coupé avant les dimensions
      jpeg(100, 100).slice(0, 12), // coupé avant SOF
    ];
    for (const octets of refus) expect(analyserImage(octets).ok).toBe(false);
  });

  it("refuse un WebP dont la taille annoncée dépasse le fichier", () => {
    const faux = vp8(100, 100);
    faux[4] = 0xff; faux[5] = 0xff; // taille RIFF énorme
    expect(analyserImage(faux).ok).toBe(false);
  });

  it("refuse des dimensions nulles ou démesurées", () => {
    expect(analyserImage(jpeg(0, 100)).ok).toBe(false);
    expect(analyserImage(vp8x(9000, 100)).ok).toBe(false); // au-delà de 4000 px : pas une image réduite par le site
  });

  it(`refuse au-delà de ${TAILLE_MAX_SERVEUR} octets, en le disant`, () => {
    const lourd = new Uint8Array(TAILLE_MAX_SERVEUR + 1);
    lourd.set(jpeg(1600, 1200));
    const r = analyserImage(lourd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/1,5 Mo/);
  });
});

describe("cleImageValide", () => {
  it("accepte <uuid>.webp et <uuid>.jpg, rien d'autre", () => {
    expect(cleImageValide("3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b.webp")).toBe(true);
    expect(cleImageValide("3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b.jpg")).toBe(true);
    for (const cle of ["../x.webp", "3f2a.webp", "3F2A9C1E-5B7D-4E8F-9A0B-1C2D3E4F5A6B.webp", "3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b.png", "a/b.webp", ""]) {
      expect(cleImageValide(cle), cle).toBe(false);
    }
  });
});

describe("verifierFichierChoisi — avant toute réduction dans le navigateur", () => {
  it("accepte JPEG, PNG, WebP et HEIC de moins de 10 Mo", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
      expect(verifierFichierChoisi({ size: 3_000_000, type }), type).toBeNull();
    }
  });

  it("refuse un fichier trop lourd ou d'un autre type, avec la limite et les formats dans le message", () => {
    expect(verifierFichierChoisi({ size: TAILLE_MAX_NAVIGATEUR + 1, type: "image/jpeg" })).toBe(
      "Cette image pèse plus de 10 Mo. Choisissez une photo plus légère (JPEG, PNG, WebP ou HEIC).",
    );
    expect(verifierFichierChoisi({ size: 1000, type: "application/pdf" })).toBe(
      "Ce fichier n’est pas une image acceptée. Formats possibles : JPEG, PNG, WebP ou HEIC, 10 Mo au plus.",
    );
  });
});

describe("rendu : images du site en .webp ou .jpg seulement", () => {
  it("accepte une image JPEG du site", () => {
    expect(imageSure("/images/3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b.jpg")).toBe("/images/3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b.jpg");
    const doc = { type: "doc", content: [{ type: "image", attrs: { src: "/images/3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b.jpg", alt: "Bol", width: 1600, height: 1200 } }] };
    expect(rendreArticle(doc)).toContain('<img src="/images/3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b.jpg" alt="Bol" width="1600" height="1200"');
  });

  it("refuse toujours PNG, SVG et les adresses externes", () => {
    for (const src of ["/images/a.png", "/images/a.svg", "https://exemple.test/a.jpg", "/images/../a.jpg"]) {
      expect(imageSure(src), src).toBeNull();
    }
  });
});
