// Minimal cn utility without clsx/tailwind-merge dependencies
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}
