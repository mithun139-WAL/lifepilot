"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/30 flex flex-col items-center justify-center text-center space-y-2 h-full min-h-[150px]">
          <AlertTriangle className="text-red-500 w-8 h-8" />
          <h3 className="text-red-200 font-semibold text-sm">Widget Failed</h3>
          <p className="text-red-300/70 text-xs">There was an error loading this component.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-1 rounded-full transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
