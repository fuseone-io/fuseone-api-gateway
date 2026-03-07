"use client"

import { useEffect, useState } from "react"
import { NextIntlClientProvider } from "next-intl"
import { useLocaleStore } from "@/stores/locale-store"
import type { Locale } from "@/i18n/config"

import enMessages from "@/i18n/messages/en.json"
import ptBRMessages from "@/i18n/messages/pt-BR.json"

const messages: Record<Locale, typeof enMessages> = {
  en: enMessages,
  "pt-BR": ptBRMessages,
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocaleStore((s) => s.locale)

  // Sync <html lang> attribute with the current locale
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  )
}
