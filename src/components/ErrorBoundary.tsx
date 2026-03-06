import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import i18n from "@/i18n";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleCopyError = () => {
    const errorText = this.state.error?.stack || this.state.error?.message || "Unknown error";
    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      const t = i18n.t.bind(i18n);
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold">{t("errorBoundary.title")}</h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            {this.state.error?.message || t("errorBoundary.description")}
          </p>
          <div className="flex gap-2">
            <button
              onClick={this.handleCopyError}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-white/10"
            >
              {this.state.copied ? "✓" : t("errorBoundary.copyError")}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("errorBoundary.reload")}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
