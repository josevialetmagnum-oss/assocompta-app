import Image from "next/image";

// En-tête des états à l'impression (invisible à l'écran, voir .apercu-impression dans globals.css) :
// association, titre, date d'édition, et le logo LBSOFT à droite.
export function EnTeteImpression({ association, titre }: { association: string; titre: string }) {
  return (
    <div className="apercu-impression mb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-[var(--texte-discret)]">{association}</p>
          <h1 className="text-2xl font-semibold">{titre}</h1>
          <p className="text-[13px] text-[var(--texte-discret)]">Édité le {new Date().toLocaleDateString("fr-FR")}</p>
        </div>
        <Image src="/lbsoft-logo.png" alt="LBSOFT, solutions logicielles" width={1920} height={600} unoptimized className="h-9 w-auto shrink-0" />
      </div>
    </div>
  );
}
