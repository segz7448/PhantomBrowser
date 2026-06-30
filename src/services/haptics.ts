import {Vibration, Platform} from 'react-native';

// Lightweight haptic-style feedback using the built-in Vibration API, so no
// extra native dependency (e.g. react-native-haptic-feedback) is required.
// For real taptic-engine-quality feedback on iOS/Android, swap these calls
// for that library later — the call sites below are already centralized here.

function tap(ms: number) {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    Vibration.vibrate(ms);
  }
}

export const haptics = {
  light: () => tap(8),
  medium: () => tap(15),
  success: () => tap(12),
  warning: () => tap([0, 20, 40, 20]),
};

export default haptics;
