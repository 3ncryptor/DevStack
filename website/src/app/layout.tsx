import type { Metadata, Viewport } from 'next'
import { Archivo, Geist, Geist_Mono } from 'next/font/google'

import { SmoothScroll } from '@/components/motion/smooth-scroll'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { githubStars } from '@/lib/site'

import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
/** The wide display face for headlines (the `display` utility sets 125% width). */
const archivo = Archivo({ variable: '--font-archivo', subsets: ['latin'], axes: ['wdth'] })

export const metadata: Metadata = {
  title: {
    default: 'DevStack: production-ready stacks, wired and verified',
    template: '%s · DevStack'
  },
  description:
    'Pick a stack, run one command, get a project that installs, passes its checks and boots.'
}

export const viewport: Viewport = { themeColor: '#000000', colorScheme: 'dark' }

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const stars = await githubStars()
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SmoothScroll>
          <SiteHeader stars={stars} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </SmoothScroll>
      </body>
    </html>
  )
}
