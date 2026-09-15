"use client";

import { Component, type ReactNode } from "react";

export class DiagErrorBoundary extends Component<
  { children: ReactNode; label: string },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode; label: string }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive bg-destructive/5 p-4">
          <p className="text-xs font-medium text-destructive">
            Erro real capturado em &quot;{this.props.label}&quot;:
          </p>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-destructive">
            {this.state.error.message}
          </pre>
          <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-[10px] text-muted-foreground">
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
