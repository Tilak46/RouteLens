import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    try {
      (window as any).__routeLensDismissSplash?.();
    } catch {
      // ignore
    }
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
        if (this.props.fallback) return this.props.fallback;

      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-8 overflow-auto">
          <div className="flex flex-col items-center max-w-2xl gap-6 text-center">
            <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
                <AlertTriangle size={48} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-red-100">Something went wrong</h1>
            <p className="text-zinc-400">The application encountered an unexpected error.</p>
            
            <div className="w-full text-left bg-black/50 p-4 rounded-lg border border-red-500/20 font-mono text-xs overflow-auto max-h-64">
                <p className="text-red-400 font-bold mb-2">{this.state.error && this.state.error.toString()}</p>
                <pre className="text-zinc-500 whitespace-pre-wrap">
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
            </div>

            <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white text-black font-medium rounded hover:bg-zinc-200 transition-colors"
            >
                Reload Window
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
