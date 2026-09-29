"use client";

// Cadre commun de l'application : menu latéral, barre du haut (association courante, compte) et
// zone de contenu. Repris du même schéma que raisins-app (LBSOFT).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { deconnecter } from "@/app/compte/actions";
import { ENTREE_COMPTE, entreeActive, entreesDuMenu, lectureSeuleSurCettePage, LIBELLE_ROLE, pageSansCadre, type GroupeMenu } from "@/lib/navigation";

export type DonneesCadre = {
  menu: GroupeMenu[];
  utilisateur: { email: string; role: string } | null;
  // Association courante ; null pour le superviseur (aucune donnée métier).
  association: { nom: string } | null;
  lectureSeule: boolean;
};

function Icone({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={d} />
    </svg>
  );
}

function initiales(email: string): string {
  const local = email.split("@")[0] ?? "";
  const morceaux = local.split(/[._-]+/).filter(Boolean);
  const lettres = morceaux.length >= 2 ? morceaux[0][0] + morceaux[1][0] : local.slice(0, 2);
  return (lettres || "?").toUpperCase();
}

function Menu({ donnees, chemin, surNavigation }: { donnees: DonneesCadre; chemin: string; surNavigation?: () => void }) {
  const active = entreeActive(chemin, [...entreesDuMenu(donnees.menu), ENTREE_COMPTE]);
  const lien = (href: string, libelle: string, icone: string) => {
    const estActive = active === href;
    return (
      <Link
        key={href}
        href={href}
        onClick={surNavigation}
        aria-current={estActive ? "page" : undefined}
        className={`flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
          estActive ? "bg-white/20 font-semibold text-white" : "text-[#DCEEE2] hover:bg-white/10"
        }`}
      >
        <Icone d={icone} />
        <span>{libelle}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto px-3.5 py-4">
      <div className="mb-1 flex flex-col gap-0.5 border-b border-white/20 px-2 pb-4">
        <span className="text-[24px] font-bold tracking-tight text-white">AssoCompta</span>
        <span className="text-[13px] text-[#B9DBC7]">Trésorerie associative</span>
      </div>

      <nav aria-label="Navigation principale" className="flex flex-col">
        {donnees.menu.map((g, i) => (
          <div key={`${g.titre}-${i}`} className="mb-1.5 flex flex-col gap-0.5">
            {g.titre && <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-bold tracking-[0.08em] text-[#B9DBC7] uppercase">{g.titre}</div>}
            {g.entrees.map((e) => lien(e.href, e.libelle, e.icone))}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-white/20 pt-3">
        {lien(ENTREE_COMPTE.href, ENTREE_COMPTE.libelle, ENTREE_COMPTE.icone)}
        <form action={deconnecter}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left text-[15px] text-[#DCEEE2] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Icone d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            <span>Se déconnecter</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export function Cadre({ donnees, children }: { donnees: DonneesCadre; children: React.ReactNode }) {
  const chemin = usePathname() ?? "/";
  const [ouvert, setOuvert] = useState(false);

  if (pageSansCadre(chemin)) return <>{children}</>;

  const u = donnees.utilisateur;
  const lectureSeuleIci = lectureSeuleSurCettePage(chemin, donnees.lectureSeule);

  return (
    <div className="flex min-h-screen bg-[var(--fond-app)]">
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 bg-[var(--foret)] text-white lg:block" aria-label="Menu">
        <Menu donnees={donnees} chemin={chemin} />
      </aside>

      {ouvert && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fermer le menu" onClick={() => setOuvert(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-[var(--foret)] text-white shadow-xl">
            <Menu donnees={donnees} chemin={chemin} surNavigation={() => setOuvert(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--bordure)] bg-[#FBFAF7] px-4 sm:px-8">
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#D8D1C5] bg-white lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {donnees.association ? (
            <div className="flex h-10 min-w-0 items-center gap-2.5 rounded-[10px] border border-[#D8D1C5] bg-white px-3.5 text-[15px]">
              <span className="truncate font-bold">{donnees.association.nom}</span>
              {lectureSeuleIci && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  Lecture seule
                </span>
              )}
            </div>
          ) : (
            <span className="text-[15px] font-semibold text-[var(--texte-discret)]">Administration de la plateforme</span>
          )}

          <div className="flex-1" />

          {u && (
            <form action={deconnecter} className="hidden sm:block">
              <button type="submit" className="flex h-9 items-center gap-2 rounded-lg border border-[#D8D1C5] bg-white px-3 text-sm font-semibold text-[var(--texte-discret)] hover:bg-[#F7F5F0]" aria-label="Se déconnecter">
                <Icone d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                <span className="hidden xl:inline">Déconnexion</span>
              </button>
            </form>
          )}

          {u && (
            <Link href="/compte" className="flex items-center gap-2.5" aria-label="Mon compte">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DCF0E4] text-sm font-bold text-[#1F5C3F]" aria-hidden="true">
                {initiales(u.email)}
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="text-sm font-semibold">{u.email}</span>
                <span className="text-xs text-[var(--texte-discret)]">{LIBELLE_ROLE[u.role] ?? u.role}</span>
              </span>
            </Link>
          )}
        </header>

        <div className="min-w-0 flex-1">
          {lectureSeuleIci ? (
            <fieldset disabled className="m-0 min-w-0 border-0 p-0">
              {children}
            </fieldset>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
