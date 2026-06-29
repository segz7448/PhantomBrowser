/**
 * AdBlocker - blocks known ad/tracker domains via:
 * 1. URL blocking in onShouldStartLoadWithRequest
 * 2. JS injection to block DOM ad elements
 */

const BLOCKED_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'adservice.google.com',
  'ads.twitter.com', 'connect.facebook.net', 'googletagmanager.com',
  'googletagservices.com', 'google-analytics.com', 'analytics.google.com',
  'scorecardresearch.com', 'outbrain.com', 'taboola.com', 'ads.yahoo.com',
  'advertising.com', 'adnxs.com', 'rubiconproject.com', 'openx.net',
  'pubmatic.com', 'criteo.com', 'moatads.com', 'hotjar.com',
  'mixpanel.com', 'segment.io', 'amplitude.com', 'heap.io',
  'bugsnag.com', 'sentry.io', 'mouseflow.com', 'fullstory.com',
  'cdn.mxpnl.com', 'pardot.com', 'marketo.net', 'quantserve.com',
  'chartbeat.com', 'newrelic.com', 'nr-data.net', 'pingdom.net',
];

const BLOCKED_PATTERNS = [
  /\/ads?\//i, /\/advert/i, /\/tracker/i, /\/tracking/i,
  /\/analytics/i, /\/pixel\?/i, /\/beacon\?/i, /\/telemetry/i,
  /\/collect\?/i, /googleads/i, /pagead/i,
];

const AdBlocker = {
  shouldBlock(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, '');
      if (BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
        return true;
      }
      if (BLOCKED_PATTERNS.some(p => p.test(url))) {
        return true;
      }
    } catch {}
    return false;
  },

  getInjectionScript(): string {
    return `
(function() {
  'use strict';

  // Remove common ad/tracker elements by selector
  const AD_SELECTORS = [
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="adservice"]',
    'div[id*="google_ads"]',
    'div[class*="AdContainer"]',
    'div[class*="ad-container"]',
    'div[id*="ad-banner"]',
    'ins.adsbygoogle',
    'div[data-ad-slot]',
    'div[class*="taboola"]',
    'div[class*="outbrain"]',
    'div[id*="outbrain"]',
    'div[id*="taboola"]',
  ];

  function removeAds() {
    AD_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.remove();
      });
    });
  }

  // Run on load and observe DOM changes
  removeAds();
  const observer = new MutationObserver(() => removeAds());
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Block WebRTC to prevent IP leaks
  if (window.RTCPeerConnection) {
    window.RTCPeerConnection = function() {
      throw new DOMException('WebRTC disabled by Phantom Browser');
    };
  }
  if (window.webkitRTCPeerConnection) {
    window.webkitRTCPeerConnection = function() {
      throw new DOMException('WebRTC disabled by Phantom Browser');
    };
  }

  // Block canvas fingerprinting
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const ctx = origGetContext.call(this, type, ...args);
    if (type === '2d' && ctx) {
      const origGetImageData = ctx.getImageData.bind(ctx);
      ctx.getImageData = function(x, y, w, h) {
        const imageData = origGetImageData(x, y, w, h);
        // Add minor noise to prevent exact fingerprint
        for (let i = 0; i < imageData.data.length; i += 100) {
          imageData.data[i] = imageData.data[i] ^ 1;
        }
        return imageData;
      };
    }
    return ctx;
  };

  true; // required for RN WebView injectedJavaScript
})();
`;
  },
};

export default AdBlocker;
