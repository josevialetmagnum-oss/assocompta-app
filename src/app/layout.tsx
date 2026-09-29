import type { Metadata } from "next";
import "./globals.css";
import { CadreServeur } from "@/components/CadreServeur";

export const metadata: Metadata = {
  title: "AssoCompta — Comptabilité de trésorerie associative",
  description: "Suivi de trésorerie pour associations : mouvements, catégories, rapprochement bancaire, états.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <CadreServeur>{children}</CadreServeur>
      </body>
    </html>
  );
}
