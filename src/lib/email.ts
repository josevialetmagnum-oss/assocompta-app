// Envoi d'emails par SMTP (nodemailer) — un seul compte, celui de la PLATEFORME (LBSOFT), utilisé
// uniquement pour le mot de passe oublié : contrairement à raisins-app, une association n'envoie
// jamais de document à un tiers depuis l'application, donc pas de second compte SMTP par tenant.
//
// PLATEFORME_SMTP_HOST, PLATEFORME_SMTP_PORT (465 = TLS implicite, sinon STARTTLS),
// PLATEFORME_SMTP_USER, PLATEFORME_SMTP_PASSWORD, PLATEFORME_SMTP_FROM (défaut : USER).

import nodemailer from "nodemailer";

export class EmailNonConfigure extends Error {}

export type EmailASendre = { to: string; subject: string; text: string; html: string };

type ConfigurationSmtp = { host: string; port: number; user: string; password: string; from: string };

function configurationPlateforme(): ConfigurationSmtp | null {
  const host = process.env.PLATEFORME_SMTP_HOST;
  const user = process.env.PLATEFORME_SMTP_USER;
  const password = process.env.PLATEFORME_SMTP_PASSWORD;
  if (!host || !user || !password) return null;
  return { host, port: Number(process.env.PLATEFORME_SMTP_PORT ?? 587), user, password, from: process.env.PLATEFORME_SMTP_FROM || user };
}

export function comptePlateformeConfigure(): boolean {
  return configurationPlateforme() !== null;
}

export async function envoyerEmailPlateforme(mail: EmailASendre): Promise<void> {
  const c = configurationPlateforme();
  if (!c) {
    throw new EmailNonConfigure("Email non envoyé : PLATEFORME_SMTP_HOST/USER/PASSWORD non configurés.");
  }
  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.port === 465,
    auth: { user: c.user, pass: c.password },
  });
  await transport.sendMail({ from: c.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
}
