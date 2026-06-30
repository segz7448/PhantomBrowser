import React, {useEffect, useState} from 'react';
import {subscribeToCrashes} from './services/crashCapture';
import {reportCrash, ReportStatus} from './services/crashReporter';
import CrashScreen from './components/CrashScreen';

export default function GlobalCrashOverlay({children}: {children: React.ReactNode}) {
  const [error, setError] = useState<Error | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus | 'sending' | undefined>(undefined);

  useEffect(() => {
    return subscribeToCrashes((err, isFatal) => {
      setError(err);
      setReportStatus('sending');
      reportCrash({message: err.message, stack: err.stack, isFatal}).then(setReportStatus);
    });
  }, []);

  if (error) {
    return (
      <CrashScreen
        message={error.message}
        stack={error.stack}
        onContinue={() => {
          setError(null);
          setReportStatus(undefined);
        }}
        reportStatus={reportStatus}
      />
    );
  }

  return <>{children}</>;
}
