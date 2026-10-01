/**
 * ErrorBoundary.jsx
 * Place at: src/components/ErrorBoundary.jsx
 *
 * Wraps any subtree. On a render error, shows a tasteful fallback
 * instead of crashing the whole app. Use the `inline` prop for
 * section-level boundaries that render a small card instead of
 * a full-screen takeover.
 */
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.setState({ componentStack: info.componentStack });
  }

  reset = () => this.setState({ hasError: false, error: null, componentStack: null, copied: false });

  copyDiagnostics = () => {
    const { error, componentStack } = this.state;
    const report = [
      `Afterhours error report`,
      `Time:      ${new Date().toISOString()}`,
      `URL:       ${window.location.href}`,
      `UserAgent: ${navigator.userAgent}`,
      ``,
      `Error:`,
      error?.toString() || '(unknown)',
      ``,
      `Component stack:`,
      componentStack || '(not available)',
    ].join('\n');

    // Fallback: open in a new tab as a text blob
    const openAsBlob = () => {
      const blob = new Blob([report], { type: 'text/plain' });
      window.open(URL.createObjectURL(blob));
    };
    // navigator.clipboard is undefined on http and in some in-app browsers;
    // `?.writeText(...).then` would then throw inside the error UI itself.
    if (!navigator.clipboard?.writeText) { openAsBlob(); return; }
    navigator.clipboard.writeText(report).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    }).catch(openAsBlob);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { inline = false, fallback } = this.props;
    const { error, copied } = this.state;

    // Custom fallback supplied by parent
    if (fallback) return fallback;

    // Inline variant — small card, no full-page takeover
    if (inline) {
      return (
        <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl mb-2 block">
            sentiment_dissatisfied
          </span>
          <p className="text-sm text-on-surface-variant mb-3">
            Something went wrong loading this section.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.reset}
              className="text-xs font-bold text-primary uppercase tracking-wide hover:underline"
            >
              Try again
            </button>
            <span className="text-outline-variant/40 text-xs">·</span>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-bold text-on-surface-variant uppercase tracking-wide hover:underline"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    // Full-page fallback
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-error-container/30 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-error text-2xl">warning</span>
          </div>
          <h2 className="font-headline text-xl font-bold text-on-surface mb-2">Something went wrong</h2>
          <p className="text-sm text-on-surface-variant mb-6">
            An unexpected error occurred. You can try refreshing or going back to a working state.
          </p>

          {/* Primary actions */}
          <div className="flex gap-3 justify-center mb-4">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:brightness-110 transition-all"
            >
              Reload page
            </button>
            <button
              onClick={() => window.location.replace('/')}
              className="px-5 py-2.5 bg-surface-container text-on-surface-variant rounded-xl text-sm font-bold hover:bg-surface-container-high transition-all"
            >
              Go home
            </button>
          </div>

          {/* Diagnostics */}
          <button
            onClick={this.copyDiagnostics}
            className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 13 }}
            >
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? 'Diagnostics copied' : 'Copy diagnostics'}
          </button>

          {import.meta.env.DEV && error && (
            <pre className="mt-6 text-left text-[10px] text-error/70 bg-error-container/10 rounded-xl p-4 overflow-auto max-h-40">
              {error.toString()}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
