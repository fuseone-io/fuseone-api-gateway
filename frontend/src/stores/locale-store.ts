import { create } from "zustand"
import type { Locale } from "@/i18n/config"
import { defaultLocale, locales } from "@/i18n/config"

const LOCALE_COOKIE_NAME = "fuseone_locale"
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return defaultLocale
  const match = document.cookie.match(/(?:^|;\s*)fuseone_locale=([^;]*)/)
  if (!match) return defaultLocale
  const val = decodeURIComponent(match[1]) as Locale
  return (locales as readonly string[]).includes(val) ? val : defaultLocale
}

function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`
}

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: readLocaleCookie(),
  setLocale: (locale) => {
    writeLocaleCookie(locale)
    set({ locale })
  },
}))
