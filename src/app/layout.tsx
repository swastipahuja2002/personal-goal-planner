import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from './components/Nav'

export const metadata: Metadata = {
  title: 'goal planner',
  description: 'personal goal planner',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'goal planner',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 80px' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
