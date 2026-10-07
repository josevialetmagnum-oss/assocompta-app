/* eslint-disable @typescript-eslint/no-require-imports -- script Node autonome (CommonJS) */
// Convertit la lecture XML du manuel (docs) en structure JSON typée pour la page /manuel (AssoMembres, AssoCompta).
const fs = require("fs");
const [, , entree, sortie] = process.argv;
const brut = JSON.parse(fs.readFileSync(entree, "utf8")).data.xml;

// Mini-analyseur XML (balises simples, attributs entre apostrophes, entités &amp; &lt; &gt; &quot; &apos;).
const dec = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function analyser(xml) {
  const racine = { nom: "racine", attrs: {}, enfants: [] };
  const pile = [racine];
  const re = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z-]+='[^']*')*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[5] !== undefined) { pile[pile.length - 1].enfants.push({ texte: dec(m[5]) }); continue; }
    const [, fermant, nom, attrsBruts, autoFermant] = m;
    if (fermant) { pile.pop(); continue; }
    const attrs = {};
    for (const a of attrsBruts.matchAll(/([a-zA-Z-]+)='([^']*)'/g)) attrs[a[1]] = dec(a[2]);
    const n = { nom, attrs, enfants: [] };
    pile[pile.length - 1].enfants.push(n);
    if (!autoFermant) pile.push(n);
  }
  return racine.enfants[0];
}

// Suites de texte formaté (gras / code) d'un paragraphe.
function morceaux(n, style = {}) {
  const out = [];
  for (const e of n.enfants) {
    if (e.texte !== undefined) out.push({ t: e.texte, ...style });
    else if (e.nom === "text") out.push(...morceaux(e, style));
    else if (e.nom === "bold") out.push(...morceaux(e, { ...style, b: true }));
    else if (e.nom === "code") out.push(...morceaux(e, { ...style, c: true }));
    else if (e.nom === "comment") continue;
    else if (e.nom === "date" || e.nom === "mention") continue;
    else out.push(...morceaux(e, style));
  }
  return fusion(out);
}
function fusion(l) {
  const r = [];
  for (const x of l) {
    const p = r[r.length - 1];
    if (p && !!p.b === !!x.b && !!p.c === !!x.c) p.t += x.t;
    else r.push({ ...x });
  }
  return r;
}

function liste(n) {
  return {
    type: "liste",
    ordonnee: n.attrs.kind === "ordered",
    elements: n.enfants.filter((e) => e.nom === "listItem").map((li) => {
      const para = li.enfants.find((e) => e.nom === "paragraph");
      const sous = li.enfants.filter((e) => e.nom === "list").map(liste);
      return { texte: para ? morceaux(para) : [], sous };
    }),
  };
}
function tableau(n) {
  const lignes = n.enfants.filter((e) => e.nom === "row").map((r) =>
    r.enfants.filter((c) => c.nom === "cell").map((c) => {
      const t = [];
      for (const p of c.enfants.filter((e) => e.nom === "paragraph")) { if (t.length) t.push({ t: " " }); t.push(...morceaux(p)); }
      return fusion(t);
    }),
  );
  return { type: "tableau", entete: lignes[0], lignes: lignes.slice(1) };
}

const doc = analyser(brut);
const blocs = [];
for (const n of doc.enfants) {
  if (n.nom === "paragraph") {
    const t = morceaux(n);
    const plein = t.map((x) => x.t).join("").trim();
    if (!/[A-Za-z0-9À-ÿ]/.test(plein)) continue; // ignore les paragraphes vides ou réduits à de la ponctuation (ex. ligne de signature « · »)
    if (n.attrs.heading) blocs.push({ type: "titre", niveau: Number(n.attrs.heading), texte: plein });
    else blocs.push({ type: "paragraphe", texte: t });
  } else if (n.nom === "list") blocs.push(liste(n));
  else if (n.nom === "table") blocs.push(tableau(n));
}
fs.writeFileSync(sortie, JSON.stringify(blocs));
const stats = {};
for (const b of blocs) stats[b.type] = (stats[b.type] || 0) + 1;
console.log(stats, "titres h2:", blocs.filter((b) => b.type === "titre" && b.niveau === 2).length);
