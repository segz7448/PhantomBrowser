import React from 'react';
import CrashScreen from './components/CrashScreen';
import {reportCrash, ReportStatus} from './services/crashReporter';

interface State {
  error: Error | null;
  info: string;
  reportStatus?: ReportStatus | 'sending';
}

// Catches errors thrown during React render (not async/event-handler errors —
// see services/crashCapture.ts + GlobalCrashOverlay.tsx for those).
export default class ErrorBoundary extends React.Component<{children: React.ReactNode}, State> {
  state: State = {error: null, info: ''};

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({info: info.componentStack || '', reportStatus: 'sending'});
    reportCrash({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack || undefined,
      isFatal: true,
    }).then(status => this.setState({reportStatus: status}));
  }

  reset = () => this.setState({error: null, info: '', reportStatus: undefined});

  render() {
    const {error, info, reportStatus} = this.state;
    if (!error) return this.props.children;
    return (
      <CrashScreen
        message={error.message}
        stack={error.stack}
        extra={info}
        onContinue={this.reset}
        reportStatus={reportStatus}
      />
    );
  }
}
