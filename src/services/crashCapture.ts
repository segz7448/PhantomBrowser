type Listener = (error: Error, isFatal: boolean) => void;

const listeners: Listener[] = [];
let installed = false;

export function subscribeToCrashes(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

// Installs a handler for uncaught JS errors that happen OUTSIDE React's
// render phase — e.g. inside onPress handlers, setTimeout callbacks, promise
// rejections, or native-module callbacks. These are exactly the kind of
// errors that, in a release build, normally close the app instantly with no
// red screen. We intercept them, notify any subscribed UI (GlobalCrashOverlay)
// so the real error can be displayed instead, and only fall back to the
// default (crashing) behavior if nothing is listening.
export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;

  const g = global as any;
  if (!g.ErrorUtils) return;

  const defaultHandler = g.ErrorUtils.getGlobalHandler ? g.ErrorUtils.getGlobalHandler() : null;

  g.ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
    if (listeners.length > 0) {
      listeners.forEach(l => {
        try {
          l(error, isFatal);
        } catch {
          // ignore listener errors
        }
      });
    } else if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}
