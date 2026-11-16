/**
 * Skeleton colours from the app's palette: brand ink at 8% on paper, with a paper-coloured shimmer.
 * The app has one light look, so dark mode reuses the same colours.
 */
export const SKULLET_THEME = {
  light: { base: 'rgb(88 64 46 / 0.08)', highlight: 'rgb(247 246 242 / 0.7)' },
  dark: { base: 'rgb(88 64 46 / 0.08)', highlight: 'rgb(247 246 242 / 0.7)' },
  animation: 'shimmer',
  speed: 'slow',
  radius: '6px',
} as const
