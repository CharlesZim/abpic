import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const title = 'abpic · Quelle photo je poste ?'
const description = 'Aide tes amis à choisir la photo à poster.'

export const metadata: Metadata = {
  metadataBase: new URL('https://abpic.vercel.app'),
  applicationName: 'abpic',
  title: { default: title, template: '%s · abpic' },
  description,
  openGraph: {
    title,
    description,
    siteName: 'abpic',
    type: 'website',
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
}

export const viewport: Viewport = {
  themeColor: '#09090b',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
