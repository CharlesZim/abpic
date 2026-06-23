import { ogImage, ogSize } from '@/lib/og'

export const alt = 'Aide-moi à choisir ma photo'
export const size = ogSize
export const contentType = 'image/png'

// Generic branded image on purpose — never the user's uploaded photos.
export default function Image() {
  return ogImage('Aide-moi à choisir ma photo', 'Tape ta préférée, ça prend 10 secondes')
}
