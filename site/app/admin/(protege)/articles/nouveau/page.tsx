import type { Metadata } from "next";
import Link from "next/link";
import { listerCategories } from "@/lib/db/articles";
import { exigerSession } from "@/lib/session";
import { enregistrerNouvelArticle } from "../actions";
import { FormulaireArticle } from "../FormulaireArticle";

export const metadata: Metadata = { title: "Nouvel article" };

export default async function NouvelArticle() {
  await exigerSession();
  const categories = await listerCategories();

  return (
    <>
      <p className="fil"><Link href="/admin">Articles</Link> / Nouvel article</p>
      <h1>Nouvel article</h1>
      <FormulaireArticle
        action={enregistrerNouvelArticle}
        categories={categories}
        initial={{ titre: "", resume: "", categorieId: "", nouvelleCategorie: "", contenu: "" }}
      />
    </>
  );
}
