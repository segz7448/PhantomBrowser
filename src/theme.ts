export const theme = {
  colors: {
    bg: '#0a0a0f',
    surface: '#13131c',
    surfaceAlt: '#1a1a26',
    border: '#23232f',
    accent: '#8b5cf6',
    accentDim: '#5b3a9e',
    success: '#22c55e',
    danger: '#ef4444',
    warning: '#fbbf24',
    text: '#f4f4f7',
    textDim: '#9ca0ab',
    textFaint: '#5c5f6b',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    pill: 999,
  },
  spacing: (n: number) => n * 4,
  shadow: {
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
  },
};

export type Theme = typeof theme;
export default theme;
