import { ogImage, ogSize } from '@/lib/og'

export const alt = 'abpic — Quelle photo je poste ?'
export const size = ogSize
export const contentType = 'image/png'

export default function Image() {
  return ogImage('Quelle photo je poste ?', 'Aide tes amis à choisir la photo à poster')
}
