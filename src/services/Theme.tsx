import {useAppSettings} from './AppSettings';

export interface ThemePalette {
  mode: 'dark' | 'light';
  background: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  cardBorder: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  divider: string;
  danger: string;
  dangerSoft: string;
  success: string;
  warning: string;
  warningSoft: string;
  shadow: string;
  statusBarStyle: 'light-content' | 'dark-content';
  navBackground: string;
  overlay: string;
}

const PRIMARY = '#7c3aed';
const PRIMARY_LIGHT = '#8b5cf6';

const dark: ThemePalette = {
  mode: 'dark',
  background: '#0d0d0d',
  surface: '#111',
  surfaceElevated: '#1a1a1a',
  card: '#16161f',
  cardBorder: '#23232f',
  primary: PRIMARY_LIGHT,
  primarySoft: 'rgba(139, 92, 246, 0.16)',
  onPrimary: '#ffffff',
  text: '#f5f5f7',
  textSecondary: '#aaaaaa',
  textMuted: '#6b7280',
  border: '#26262e',
  divider: '#1f1f27',
  danger: '#ef4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  success: '#22c55e',
  warning: '#fbbf24',
  warningSoft: '#3a1d00',
  shadow: '#000000',
  statusBarStyle: 'light-content',
  navBackground: '#0d0d0d',
  overlay: 'rgba(0,0,0,0.55)',
};

const light: ThemePalette = {
  mode: 'light',
  background: '#f4f4f7',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  card: '#ffffff',
  cardBorder: '#e6e6ec',
  primary: PRIMARY,
  primarySoft: 'rgba(124, 58, 237, 0.10)',
  onPrimary: '#ffffff',
  text: '#1a1a1f',
  textSecondary: '#5b5b66',
  textMuted: '#8a8a94',
  border: '#e3e3ea',
  divider: '#ececf2',
  danger: '#dc2626',
  dangerSoft: 'rgba(220, 38, 38, 0.08)',
  success: '#16a34a',
  warning: '#b45309',
  warningSoft: '#fff3da',
  shadow: '#9a9aa8',
  statusBarStyle: 'dark-content',
  navBackground: '#ffffff',
  overlay: 'rgba(20,20,30,0.45)',
};

export function useTheme(): ThemePalette {
  const settings = useAppSettings();
  return settings.theme === 'light' ? light : dark;
}

export const elevation = (theme: ThemePalette, level: 1 | 2 | 3) => {
  const heights = {1: 2, 2: 4, 3: 10};
  const opacities = theme.mode === 'light' ? {1: 0.08, 2: 0.12, 3: 0.18} : {1: 0.3, 2: 0.4, 3: 0.5};
  return {
    shadowColor: theme.shadow,
    shadowOffset: {width: 0, height: heights[level]},
    shadowOpacity: opacities[level],
    shadowRadius: heights[level] * 1.6,
    elevation: heights[level],
  };
};

export default useTheme;
