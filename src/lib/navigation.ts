// Menu de l'application : une seule définition, pour le menu latéral et pour les tests.
// Fonctions pures (aucun accès base ni session) : ce qui est affiché dépend seulement du profil.

export type ProfilMenu = {
  role: string; // superviseur | tresorier | lecture_seule
  // Sans authentification active (développement local), tout est visible.
  authentification: boolean;
};

export type EntreeMenu = {
  href: string;
  libelle: string;
  // Icône : tracé SVG (attribut d) sur une grille de 24 × 24, trait de 1,8.
  icone: string;
  aussi?: string[];
};

export type GroupeMenu = { titre: string; entrees: EntreeMenu[] };

const ICONES = {
  accueil: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  mouvements: "M12 8v8M8 12h8M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0",
  rapprochement: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9",
  etats: "M3 3v18h18M7 15l4-4 3 3 5-6",
  analyse: "M4 6h16M4 12h16M4 18h10",
  bilan: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  parametrage:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  administration: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z",
  manuel: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z",
  compte: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
} as const;

export const MENU_METIER: GroupeMenu[] = [
  { titre: "", entrees: [{ href: "/", libelle: "Tableau de bord", icone: ICONES.accueil }] },
  {
    titre: "Trésorerie",
    entrees: [
      { href: "/mouvements", libelle: "Mouvements", icone: ICONES.mouvements },
      { href: "/rapprochement", libelle: "Rapprochement bancaire", icone: ICONES.rapprochement },
    ],
  },
  {
    titre: "États",
    entrees: [
      { href: "/etats", libelle: "Soldes et résultats", icone: ICONES.etats },
      { href: "/etats/bilan", libelle: "Bilan", icone: ICONES.bilan },
      { href: "/etats/analyse", libelle: "Analyse par lignes", icone: ICONES.analyse },
    ],
  },
  {
    titre: "Configuration",
    entrees: [{ href: "/parametrage", libelle: "Paramétrage", icone: ICONES.parametrage }],
  },
];

const MENU_ADMINISTRATION: GroupeMenu = {
  titre: "Administration",
  entrees: [{ href: "/administration", libelle: "Associations", icone: ICONES.administration }],
};

export const ENTREE_COMPTE: EntreeMenu = { href: "/compte", libelle: "Mon compte", icone: ICONES.compte };

// Le manuel est accessible à tous les profils (il ne contient aucune donnée d'association).
export const ENTREE_MANUEL: EntreeMenu = { href: "/manuel", libelle: "Manuel d'utilisation", icone: ICONES.manuel };

// Le superviseur (éditeur de la solution) n'a accès à aucune donnée d'association.
export function peutVoirLeMetier(p: ProfilMenu): boolean {
  return !p.authentification || p.role !== "superviseur";
}

export function peutVoirAdministration(p: ProfilMenu): boolean {
  return p.authentification && p.role === "superviseur";
}

export function menuPour(p: ProfilMenu): GroupeMenu[] {
  const groupes: GroupeMenu[] = [];
  if (peutVoirLeMetier(p)) groupes.push(...MENU_METIER);
  if (peutVoirAdministration(p)) groupes.push(MENU_ADMINISTRATION);
  return groupes;
}

export function entreesDuMenu(groupes: GroupeMenu[]): EntreeMenu[] {
  return groupes.flatMap((g) => g.entrees);
}

const ENTREES_METIER = entreesDuMenu(MENU_METIER);

// La lecture seule s'applique à toutes les pages de données (MENU_METIER) : jamais à
// /administration ni /compte. Fonction pure (testée sans rendre <Cadre>, qui n'a pas
// d'infrastructure de test de composants) — voir src/components/Cadre.tsx qui l'utilise.
export function lectureSeuleSurCettePage(chemin: string, estLectureSeule: boolean): boolean {
  return estLectureSeule && entreeActive(chemin, ENTREES_METIER) !== null;
}

// Pages d'états : on y consulte seulement (période, lignes à afficher). Leurs formulaires de
// sélection restent utilisables en lecture seule, ils ne modifient aucune donnée.
export function pageDeConsultation(chemin: string): boolean {
  return chemin === "/etats" || chemin.startsWith("/etats/");
}

// L'entrée active pour un chemin : la plus spécifique qui correspond. L'accueil ne correspond qu'à
// « / » exactement. Renvoie l'href de l'entrée, ou null.
export function entreeActive(chemin: string, entrees: EntreeMenu[]): string | null {
  const propre = chemin.length > 1 ? chemin.replace(/\/+$/, "") : chemin;
  let meilleure: { href: string; taille: number } | null = null;
  for (const e of entrees) {
    for (const cible of [e.href, ...(e.aussi ?? [])]) {
      const correspond = cible === "/" ? propre === "/" : propre === cible || propre.startsWith(`${cible}/`);
      if (correspond && (!meilleure || cible.length > meilleure.taille)) meilleure = { href: e.href, taille: cible.length };
    }
  }
  return meilleure?.href ?? null;
}

export const LIBELLE_ROLE: Record<string, string> = {
  superviseur: "Superviseur",
  tresorier: "Trésorier",
  lecture_seule: "Lecture seule",
};

// Pages sans cadre : la connexion (aucune session).
export function pageSansCadre(chemin: string): boolean {
  return chemin === "/connexion" || chemin.startsWith("/connexion/");
}
