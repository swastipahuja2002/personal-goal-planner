'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Today' },
  { href: '/month', label: 'Month' },
  { href: '/goals', label: 'Goals' },
  { href: '/habits', label: 'Habits' },
  { href: '/review', label: 'Review' },
  { href: '/import', label: '✦ Import' },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav style={{
      borderBottom: '1px solid #1a1a28',
      background: 'rgba(10,10,15,0.95)',
      backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{
        maxWidth: 860, margin: '0 auto',
        padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 2, height: 48,
        overflowX: 'auto', overflowY: 'hidden',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        <span style={{
          color: '#f472b6', fontWeight: 700, fontSize: 15,
          marginRight: 16, flexShrink: 0,
          letterSpacing: '-0.5px', textShadow: '0 0 20px rgba(244,114,182,0.4)',
        }}>
          planner.
        </span>
        {links.map(l => {
          const active = path === l.href
          return (
            <Link key={l.href} href={l.href} style={{
              color: active ? '#e0e0f0' : '#404058',
              fontSize: 13,
              fontWeight: active ? 500 : 400,
              padding: '5px 11px',
              borderRadius: 8,
              flexShrink: 0,
              background: active ? 'linear-gradient(135deg,#1e1e2e,#181828)' : 'transparent',
              border: active ? '1px solid #2a2a3e' : '1px solid transparent',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}>
              {l.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
