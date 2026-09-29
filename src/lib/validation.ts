export function validerEmail(emailBrut: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBrut.trim());
}
