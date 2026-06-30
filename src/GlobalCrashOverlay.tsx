import React, {useEffect, useState} from 'react';
import {subscribeToCrashes} from './services/crashCapture';
import CrashScreen from './components/CrashScreen';

export default function GlobalCrashOverlay({children}: {children: React.ReactNode}) {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    return subscribeToCrashes(err => setError(err));
  }, []);

  if (error) {
    return <CrashScreen message={error.message} stack={error.stack} onContinue={() => setError(null)} />;
  }

  return <>{children}</>;
}
