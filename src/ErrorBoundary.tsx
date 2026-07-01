import React from 'react';
import CrashScreen from './components/CrashScreen';
import {buildGithubIssueUrl} from './services/crashReporter';

interface State {
  error: Error | null;
  info: string;
}

// Catches errors thrown during React render (not async/event-handler errors —
// see services/crashCapture.ts + GlobalCrashOverlay.tsx for those).
export default class ErrorBoundary extends React.Component<{children: React.ReactNode}, State> {
  state: State = {error: null, info: ''};

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({info: info.componentStack || ''});
  }

  reset = () => this.setState({error: null, info: ''});

  render() {
    const {error, info} = this.state;
    if (!error) return this.props.children;
    const githubUrl = buildGithubIssueUrl({
      message: error.message,
      stack: error.stack,
      componentStack: info || undefined,
      isFatal: true,
    });
    return <CrashScreen message={error.message} stack={error.stack} extra={info} onContinue={this.reset} githubUrl={githubUrl} />;
  }
}
