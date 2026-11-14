// Palette from Lieflat Charts' "palm" preset (PolyForm Noncommercial 1.0.0); replace before commercial use.
export const theme = {
  paper: '#F0EFEB',
  ink: '#58402E',
  muted: 'rgba(88,64,46,.60)',
  faint: 'rgba(88,64,46,.32)',
  grid: 'rgba(88,64,46,.16)',
  water: '#DCDFD8',
  green: '#E6E6DC',
  urban: '#E7E3DC',
  field: '#D3D8BC',
  fieldLine: '#9EA67E',
  hero: '#D4A017',
  strokeScale: 1.8,
  textScale: 1,
  font: { medium: ['Noto Sans Medium'], css: "'Atkinson Hyperlegible Next', system-ui, sans-serif" },
}

export type Theme = typeof theme

export function themeCssVars(t: Theme): Record<string, string> {
  return {
    '--fp-paper': t.paper, '--fp-ink': t.ink, '--fp-muted': t.muted, '--fp-faint': t.faint,
    '--fp-grid': t.grid, '--fp-hero': t.hero, '--fp-field': t.field, '--fp-font': t.font.css,
  }
}
