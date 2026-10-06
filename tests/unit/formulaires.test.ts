import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// React 19 remet à zéro un formulaire soumis par <form action={…}> après CHAQUE envoi, même en cas d'erreur : toute la saisie
// est perdue et les choix pilotés par l'état (ventilation d'un mouvement, soldes d'ouverture) se désynchronisent de ce qui est
// affiché. Les formulaires passent donc par useActionSansReinit (soumission par onSubmit). Ce test empêche de réintroduire
// l'ancienne forme par inadvertance.

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

const racine = path.resolve(__dirname, "../../src");
const sources = fichiers(racine).map((f) => ({ f: path.relative(racine, f).replace(/\\/g, "/"), texte: readFileSync(f, "utf8") }));
const HOOK = "components/useActionSansReinit.ts";
const texteDe = (f: string) => sources.find((s) => s.f === f)?.texte ?? "";

describe("formulaires", () => {
  it("aucun formulaire n'est soumis par <form action={formAction}> ni ne dépend de useActionState directement", () => {
    const fautifs = sources.filter(({ f, texte }) => f !== HOOK && (/action=\{formAction\}/.test(texte) || /\buseActionState\b/.test(texte))).map(({ f }) => f);
    expect(fautifs).toEqual([]);
  });

  it("tout formulaire lié à une action passe par useActionSansReinit et se soumet par onSubmit", () => {
    const clients = sources.filter(({ f, texte }) => f !== HOOK && texte.includes("useActionSansReinit") && texte.includes("<form"));
    expect(clients.length).toBeGreaterThanOrEqual(14);
    for (const { f, texte } of clients) expect(/<form[^>]*onSubmit=/.test(texte) || /<form\s[^>]*?onSubmit=/s.test(texte), f).toBe(true);
  });

  it("les formulaires qui préparent un champ caché le font AVANT de lire les données (ventilation, soldes d'ouverture)", () => {
    for (const f of ["app/mouvements/MouvementForm.tsx", "app/parametrage/ExerciceForm.tsx"]) {
      const t = texteDe(f);
      const remplissage = t.indexOf("champ.value = JSON.stringify(donnees)");
      const soumission = t.indexOf("onSubmit(e);");
      expect(remplissage, f).toBeGreaterThan(-1);
      expect(soumission, f).toBeGreaterThan(remplissage);
    }
  });

  it("les formulaires de connexion et de mot de passe effacent les mots de passe après envoi", () => {
    for (const f of ["app/connexion/LoginForm.tsx", "app/connexion/reinitialiser/Formulaire.tsx", "app/connexion/premier-compte/PremierCompteForm.tsx", "app/compte/ChangerMotDePasseForm.tsx"]) {
      expect(texteDe(f), f).toContain("viderMotsDePasse: true");
    }
  });

  it("les formulaires de création qui restent affichés se vident seulement après un succès", () => {
    for (const f of [
      "app/parametrage/CategorieForm.tsx", "app/parametrage/SousCategorieForm.tsx", "app/parametrage/JournalForm.tsx", "app/parametrage/ExerciceForm.tsx",
      "app/parametrage/CompteLectureSeuleForm.tsx", "app/administration/AssociationForm.tsx",
    ]) {
      expect(texteDe(f), f).toContain("viderApresSucces: true");
    }
    // Le formulaire de mouvement ne se vide qu'à la création (la modification se referme d'elle-même).
    expect(texteDe("app/mouvements/MouvementForm.tsx")).toContain("viderApresSucces: !mouvement");
  });
});
