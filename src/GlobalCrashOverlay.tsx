import React, {useEffect, useState} from 'react';
import {subscribeToCrashes} from './services/crashCapture';
import {buildGithubIssueUrl} from './services/crashReporter';
import CrashScreen from './components/CrashScreen';

export default function GlobalCrashOverlay({children}: {children: React.ReactNode}) {
  const [error, setError] = useState<Error | null>(null);
  const [githubUrl, setGithubUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    return subscribeToCrashes((err, isFatal) => {
      setError(err);
      setGithubUrl(buildGithubIssueUrl({message: err.message, stack: err.stack, isFatal}));
    });
  }, []);

  if (error) {
    return (
      <CrashScreen
        message={error.message}
        stack={error.stack}
        githubUrl={githubUrl}
        onContinue={() => {
          setError(null);
          setGithubUrl(undefined);
        }}
      />
    );
  }

  return <>{children}</>;
}
