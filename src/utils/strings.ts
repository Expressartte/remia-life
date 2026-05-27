// Pluralización simple en español: singular/plural según n.
export function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}
