import type { Metadata } from 'next'
import { Inter, Lora } from 'next/font/google'
import '../styles/globals.css'

// Inter for UI chrome — neutral, legible, modern.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Lora for reading body text — a well-hinted serif with warm character.
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Siddartha',
  description: 'Your AI-powered reading companion',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // dark class on html enables Tailwind dark mode globally.
    // We start in dark mode — the reading experience is designed dark-first.
    <html lang="en" className={`${inter.variable} ${lora.variable} dark`}>
      <body className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  )
}
