/** Pure: first letter of the first two words of a name, uppercase ("Ana Ruiz" -> "AR"). */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase("es-MX"))
    .join("");
}
