import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ancresDesTitres, MANUEL, sommaire, type Bloc, type BlocListe, type BlocTitre, type Morceau } from "@/lib/manuel";

export const metadata: Metadata = { title: "Manuel d'utilisation — AssoCompta" };

function Texte({ morceaux }: { morceaux: Morceau[] }) {
  return (
    <>
      {morceaux.map((m, i) =>
        m.c ? <code key={i} className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.9em]">{m.t}</code>
        : m.b ? <strong key={i}>{m.t}</strong>
        : <span key={i}>{m.t}</span>,
      )}
    </>
  );
}

function Liste({ liste, niveau = 0 }: { liste: BlocListe; niveau?: number }) {
  const Balise = liste.ordonnee ? "ol" : "ul";
  return (
    <Balise className={`${liste.ordonnee ? "list-decimal" : "list-disc"} space-y-1.5 pl-6 text-[15px] leading-relaxed ${niveau > 0 ? "mt-1.5" : ""}`}>
      {liste.elements.map((e, i) => (
        <li key={i}>
          <Texte morceaux={e.texte} />
          {e.sous.map((s, j) => <Liste key={j} liste={s} niveau={niveau + 1} />)}
        </li>
      ))}
    </Balise>
  );
}

function BlocManuel({ bloc, ancres }: { bloc: Bloc; ancres: Map<BlocTitre, string> }): ReactNode {
  if (bloc.type === "titre") {
    if (bloc.niveau === 1) return null; // le titre de la page est affiché plus haut
    const id = ancres.get(bloc);
    if (bloc.niveau === 2) {
      return (
        <h2 id={id} className="scroll-mt-6 border-t pt-8 font-sans text-[24px] font-bold tracking-tight">
          {bloc.texte}
        </h2>
      );
    }
    return <h3 id={id} className="scroll-mt-6 pt-2 font-sans text-[17px] font-bold tracking-normal">{bloc.texte}</h3>;
  }
  if (bloc.type === "paragraphe") return <p className="text-[15px] leading-relaxed"><Texte morceaux={bloc.texte} /></p>;
  if (bloc.type === "liste") return <Liste liste={bloc} />;
  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full min-w-[480px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="bg-neutral-50">
            {bloc.entete.map((c, i) => <th key={i} className="border-b px-3 py-2 font-semibold"><Texte morceaux={c} /></th>)}
          </tr>
        </thead>
        <tbody>
          {bloc.lignes.map((l, i) => (
            <tr key={i} className="border-b last:border-b-0 align-top">
              {l.map((c, j) => <td key={j} className="px-3 py-2"><Texte morceaux={c} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ManuelPage() {
  const ancres = ancresDesTitres(MANUEL);
  const entrees = sommaire(MANUEL);
  const intro = MANUEL.find((b) => b.type === "paragraphe");

  return (
    <main className="mx-auto max-w-[900px] space-y-5 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-[34px] leading-tight font-semibold">Manuel d&apos;utilisation</h1>
        {intro && intro.type === "paragraphe" && <p className="mt-1 text-base text-[var(--texte-discret)]"><Texte morceaux={intro.texte} /></p>}
      </div>

      <nav aria-label="Sommaire du manuel" className="rounded border p-5">
        <h2 className="mb-3 font-sans text-[17px] font-bold tracking-normal">Sommaire</h2>
        <ol className="grid gap-x-8 gap-y-1.5 text-[15px] sm:grid-cols-2">
          {entrees.map((e) => (
            <li key={e.ancre}>
              <a href={`#${e.ancre}`} className="font-semibold text-[var(--accent-fonce)] hover:underline">{e.titre}</a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="space-y-4">
        {MANUEL.filter((b) => b !== intro).map((b, i) => <BlocManuel key={i} bloc={b} ancres={ancres} />)}
      </article>

      <p className="border-t pt-4 text-sm"><a href="#" className="font-semibold text-[var(--accent-fonce)] hover:underline">↑ Retour en haut</a></p>
    </main>
  );
}
