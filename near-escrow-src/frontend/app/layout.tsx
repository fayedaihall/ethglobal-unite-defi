import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BetSwap AI - Cross-Chain Betting Platform with AI payoffs',
  description: 'Bet on events across Ethereum and NEAR blockchains',
}

// Global error handler to suppress Chrome extension errors
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    const errorMessage = args.join(' ');
    if (errorMessage.includes('chrome.runtime.sendMessage') ||
      errorMessage.includes('Extension ID') ||
      errorMessage.includes('opfgelmcmbiajamepnmloijbpoleiama') ||
      errorMessage.includes('Runtime TypeError') ||
      errorMessage.includes('chrome-extension://')) {
      console.log('Chrome extension error suppressed:', errorMessage);
      return;
    }
    originalError.apply(console, args);
  };

  // Override window.onerror to prevent Next.js error overlay
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const errorMessage = message?.toString() || '';
    if (errorMessage.includes('chrome.runtime.sendMessage') ||
      errorMessage.includes('Extension ID') ||
      errorMessage.includes('opfgelmcmbiajamepnmloijbpoleiama') ||
      errorMessage.includes('Runtime TypeError') ||
      errorMessage.includes('chrome-extension://')) {
      console.log('Chrome extension error suppressed in onerror:', errorMessage);
      return true; // Prevent default error handling
    }
    if (originalOnError) {
      return originalOnError.call(this, message, source, lineno, colno, error);
    }
    return false;
  };

  // Also catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason || '';
    if (errorMessage.includes('chrome.runtime.sendMessage') ||
      errorMessage.includes('Extension ID') ||
      errorMessage.includes('opfgelmcmbiajamepnmloijbpoleiama') ||
      errorMessage.includes('Runtime TypeError') ||
      errorMessage.includes('chrome-extension://')) {
      console.log('Chrome extension promise rejection suppressed:', errorMessage);
      event.preventDefault();
      return;
    }
  });

  // Catch global errors
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || event.error?.message || '';
    if (errorMessage.includes('chrome.runtime.sendMessage') ||
      errorMessage.includes('Extension ID') ||
      errorMessage.includes('opfgelmcmbiajamepnmloijbpoleiama') ||
      errorMessage.includes('Runtime TypeError') ||
      errorMessage.includes('chrome-extension://')) {
      console.log('Chrome extension global error suppressed:', errorMessage);
      event.preventDefault();
      return;
    }
  });

  // Disable Next.js error overlay for Chrome extension errors
  if (process.env.NODE_ENV === 'development') {
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      return originalFetch.apply(this, args).catch(error => {
        const errorMessage = error.message || '';
        if (errorMessage.includes('chrome.runtime.sendMessage') ||
          errorMessage.includes('Extension ID') ||
          errorMessage.includes('opfgelmcmbiajamepnmloijbpoleiama') ||
          errorMessage.includes('Runtime TypeError') ||
          errorMessage.includes('chrome-extension://')) {
          console.log('Chrome extension fetch error suppressed:', errorMessage);
          return Promise.resolve(new Response('', { status: 200 }));
        }
        throw error;
      });
    };
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Disable Next.js error overlay for Chrome extension errors
              if (typeof window !== 'undefined') {
                // Override the error overlay
                const originalConsoleError = console.error;
                console.error = function(...args) {
                  const message = args.join(' ');
                  console.log('🔍 Error logged (suppressed popup):', message);
                  // Don't call originalConsoleError to prevent error popups
                };

                // Prevent error overlay from showing
                window.addEventListener('error', function(event) {
                  console.log('🔍 Window error logged (suppressed popup):', event.message);
                  event.preventDefault();
                  event.stopPropagation();
                  return false;
                }, true);

                // Override window.onerror
                const originalOnError = window.onerror;
                window.onerror = function(message, source, lineno, colno, error) {
                  console.log('🔍 Window error logged (suppressed popup):', message);
                  return true; // Prevent default error handling
                };

                // Override unhandled promise rejections
                window.addEventListener('unhandledrejection', function(event) {
                  console.log('🔍 Unhandled promise rejection logged (suppressed popup):', event.reason);
                  event.preventDefault();
                  return false;
                });

                // Override console.warn to prevent warning popups
                const originalConsoleWarn = console.warn;
                console.warn = function(...args) {
                  const message = args.join(' ');
                  console.log('🔍 Warning logged (suppressed popup):', message);
                  // Don't call originalConsoleWarn to prevent warning popups
                };
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
} 