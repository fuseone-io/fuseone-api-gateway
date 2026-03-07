export const locales = ["en", "pt-BR"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "en"

export const localeLabels: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Portugues (Brasil)",
}
