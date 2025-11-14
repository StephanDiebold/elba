// src/components/shared/ErrorBoundary.tsx
import { Component, type ReactNode } from "react";

export default class ErrorBoundary extends Component<
  { fallback?: ReactNode; children: ReactNode },
  { err?: Error }
> {
  state = { err: undefined as Error | undefined };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  render() {
    if (this.state.err) {
      return (
        this.props.fallback ?? (
          <div className="p-6 text-sm text-red-600">
            Fehler beim Rendern: {this.state.err.message}
          </div>
        )
      );
    }
    return this.props.children;
  }
}
