import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Granica błędów Reacta — bez niej dowolny nieoczekiwany wyjątek w renderowaniu
 * (np. dane z API w nietypowym kształcie) kończył się białym ekranem bez żadnej
 * informacji dla użytkownika.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Nieoczekiwany błąd renderowania:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-state" role="alert">
          <h3>Coś poszło nie tak</h3>
          <p>Wystąpił nieoczekiwany błąd aplikacji. Spróbuj odświeżyć stronę.</p>
          <button className="retry-btn" onClick={this.handleReload}>Odśwież stronę</button>
        </div>
      );
    }
    return this.props.children;
  }
}
