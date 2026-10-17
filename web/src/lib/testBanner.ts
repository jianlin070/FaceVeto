/** Turn any photo into a labelled test post (fake betting or scam banner) in the browser, for demos. */
export type Banner = 'none' | 'gambling' | 'scam' | 'birthday'

export const BANNERS: { value: Banner; label: string; caption: string }[] = [
  { value: 'none', label: 'No banner', caption: '' },
  { value: 'gambling', label: 'Test: betting ad', caption: 'Join now bro, confirm win. PM for agent link' },
  { value: 'scam', label: 'Test: crypto scam', caption: 'Thank you CryptoMax, changed my life. DM me' },
  { value: 'birthday', label: 'Harmless: birthday', caption: 'Happy birthday! Have a great year ahead' },
]

const LINES: Record<Exclude<Banner, 'none'>, { bg: string; top: string[]; bottom: string[]; topBg: string }> = {
  gambling: { bg: '#5a000a', topBg: '#c80000', top: ['DAFTAR SEKARANG!', 'Free kredit RM50'], bottom: ['Menang RM5k sehari', 'wa.me/60123456789'] },
  scam: { bg: '#0a285a', topBg: '#dc7800', top: ['I made RM20,000 in 1 week', 'with this crypto app!'], bottom: ['DM me to start', 'Guaranteed returns'] },
  birthday: { bg: '#ffecd2', topBg: '#ffffff', top: ['Happy birthday!'], bottom: [] },
}

export async function applyBanner(file: File, banner: Exclude<Banner, 'none'>): Promise<File> {
  const img = await createImageBitmap(file)
  const W = 720, H = 900
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const t = LINES[banner]
  g.fillStyle = t.bg
  g.fillRect(0, 0, W, H)
  const scale = Math.min((W - 80) / img.width, (H * 0.58) / img.height)
  const w = img.width * scale, h = img.height * scale
  g.drawImage(img, (W - w) / 2, H * 0.2, w, h)
  const dark = banner === 'birthday'
  g.textBaseline = 'top'
  t.top.forEach((line, i) => {
    g.font = `bold ${i === 0 ? 56 : 38}px Arial, sans-serif`
    if (i > 0) { g.fillStyle = t.topBg; g.fillRect(28, 30 + i * 80 - 8, g.measureText(line).width + 24, 52) }
    g.fillStyle = dark ? '#333' : i === 0 ? '#ffe600' : '#fff'
    g.fillText(line, 40, 30 + i * 80)
  })
  t.bottom.forEach((line, i) => {
    g.font = `bold ${i === 0 ? 44 : 34}px Arial, sans-serif`
    g.fillStyle = i === 0 ? '#ffe600' : '#fff'
    g.fillText(line, 40, H - 140 + i * 66)
  })
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('render failed'))), 'image/jpeg', 0.9))
  return new File([blob], `test-${banner}.jpg`, { type: 'image/jpeg' })
}
