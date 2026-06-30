import {Vibration, Platform} from 'react-native';

// Lightweight haptic-style feedback using the built-in Vibration API, so no
// extra native dependency (e.g. react-native-haptic-feedback) is required.
// Wrapped in try/catch: on some devices/builds, Vibration.vibrate() can throw
// a native SecurityException if the VIBRATE permission isn't declared in
// AndroidManifest.xml — that exception is NOT catchable from JS try/catch in
// some RN versions and can crash the whole app in a release build. We guard
// every call so a missing permission degrades to "no vibration" instead of
// a crash. Add <uses-permission android:name="android.permission.VIBRATE" />
// to AndroidManifest.xml to get real haptic feedback.

function tap(pattern: number | number[]) {
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Vibration.vibrate(pattern);
    }
  } catch {
    // Silently ignore — missing permission or unsupported device.
  }
}

export const haptics = {
  light: () => tap(8),
  medium: () => tap(15),
  success: () => tap(12),
  warning: () => tap([0, 20, 40, 20]),
};

export default haptics;
