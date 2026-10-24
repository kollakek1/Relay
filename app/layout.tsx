import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/shared/components/ui/sonner'
import { ThemeProvider } from '@/shared/components/theme-provider'
import { I18nProvider } from '@/shared/i18n/provider'
import { getTranslator } from '@/shared/i18n/server'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getTranslator()
  const title = t('meta.title')
  const description = t('meta.description')
  return {
    metadataBase: new URL(process.env.BASE_URL ?? 'http://localhost:3000'),
    title: { default: title, template: `%s · ${t('meta.siteName')}` },
    description,
    keywords: t('meta.keywords'),
    applicationName: t('meta.siteName'),
    openGraph: {
      type: 'website',
      title,
      description,
      siteName: t('meta.siteName'),
      locale: locale === 'ru' ? 'ru_RU' : 'en_US',
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: '/' },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { locale } = await getTranslator()
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <I18nProvider locale={locale}>
            <Toaster />
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
