// Habillage commun des pages sans session (connexion, premier compte) : panneau de marque à gauche,
// formulaire dans une carte à droite. Sur petit écran, le panneau de marque devient un bandeau en haut.
import Image from "next/image";

export default function ConnexionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--fond-app)] lg:flex-row">
      <aside className="flex flex-col justify-between gap-8 bg-[var(--foret)] px-6 py-7 text-white sm:px-10 lg:w-[46%] lg:px-14 lg:py-12">
        <div className="space-y-4">
          <div className="flex h-[72px] w-full max-w-[320px] items-center justify-center overflow-hidden rounded-2xl bg-white px-3">
            <Image src="/lbsoft-logo.png" alt="LBSOFT, solutions logicielles" width={1920} height={600} priority unoptimized className="h-[64px] w-auto max-w-full object-contain" />
          </div>
          <p className="text-5xl leading-none font-bold tracking-tight sm:text-6xl">AssoCompta</p>
          <p className="max-w-md text-lg text-[#DCEEE2]">Comptabilité de trésorerie pour associations.</p>
          <ul className="hidden space-y-2 text-[15px] text-[#B9DBC7] lg:block">
            <li className="flex items-center gap-2.5">
              <span aria-hidden="true">✓</span> Mouvements, catégories et rapprochement bancaire
            </li>
            <li className="flex items-center gap-2.5">
              <span aria-hidden="true">✓</span> Soldes en temps réel et résultat analytique
            </li>
            <li className="flex items-center gap-2.5">
              <span aria-hidden="true">✓</span> Clôture d&apos;exercice
            </li>
          </ul>
        </div>

        <p className="hidden text-sm text-[#9FC7B0] lg:block">© LBSOFT — Solutions logicielles</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-2xl border border-[var(--bordure)] bg-white p-7 shadow-sm sm:p-9">{children}</div>
      </main>
    </div>
  );
}
