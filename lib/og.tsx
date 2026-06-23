import { ImageResponse } from 'next/og'

export const ogSize = { width: 1200, height: 630 }

export function ogImage(title: string, subtitle: string) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          backgroundImage:
            'radial-gradient(circle at 25% 20%, rgba(168,85,247,0.45), transparent 55%), radial-gradient(circle at 80% 85%, rgba(217,70,239,0.32), transparent 55%)',
        }}
      >
        <div style={{ display: 'flex', fontSize: 150, fontWeight: 800, letterSpacing: -8, color: '#f5d0fe' }}>
          abpic
        </div>
        <div style={{ display: 'flex', marginTop: 6, fontSize: 48, fontWeight: 600, color: '#fafafa' }}>
          {title}
        </div>
        <div style={{ display: 'flex', marginTop: 26, fontSize: 30, color: '#a1a1aa' }}>{subtitle}</div>
      </div>
    ),
    ogSize
  )
}
