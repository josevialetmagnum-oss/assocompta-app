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
  etats: "M3 3v18h18M7 15l4-4 3 3 5-6",
  parametrage:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  administration: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z",
  compte: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
} as const;

export const MENU_METIER: GroupeMenu[] = [
  { titre: "", entrees: [{ href: "/", libelle: "Tableau de bord", icone: ICONES.accueil }] },
  {
    titre: "Trésorerie",
    entrees: [{ href: "/mouvements", libelle: "Mouvements", icone: ICONES.mouvements }],
  },
  {
    titre: "États",
    entrees: [{ href: "/etats", libelle: "Soldes et résultats", icone: ICONES.etats }],
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
