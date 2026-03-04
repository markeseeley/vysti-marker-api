import { Component } from "react";
import { getConfig } from "../config";
import { getDebugInfo, logCriticalError } from "../lib/logger";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: "",
      errorStack: ""
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Student React render error", error);
    logCriticalError("React render crash", {
      errorType: "render_crash",
      error: error?.message,
      componentStack: info?.componentStack?.slice(0, 500),
    });
    this.setState({
      componentStack: info?.componentStack || "",
      errorStack: error?.stack || ""
    });
  }

  handleCopyDetails = async () => {
    try {
      const errorMessage = this.state.error?.message || "Unknown error";
      const errorStack = this.state.errorStack || this.state.error?.stack || "";
      const componentStack = this.state.componentStack || "";
      const debugInfo = getDebugInfo() || {};
      const payload = JSON.stringify(
        {
          error: errorMessage,
          stack: errorStack,
          componentStack,
          buildId: debugInfo.buildId || "",
          recentEvents: debugInfo.recentEvents || [],
          url: window.location.href
        },
        null,
        2
      );
      await navigator.clipboard.writeText(payload);
    } catch (err) {
      console.warn("Copy debug info failed", err);
    }
  };

  render() {
    if (this.state.hasError) {
      const {
        inline = false,
        title = "Something broke while rendering the preview.",
        message = "Try reloading or returning to the classic view.",
        showClassic = true
      } = this.props;
      const debugHardening = Boolean(getConfig()?.featureFlags?.debugHardening);
      const showDebugStack = debugHardening;
      const errorMessage = this.state.error?.message || "Unknown error";
      const componentStack = this.state.componentStack || "";
      const Wrapper = inline ? "section" : "main";
      const wrapperClass = inline ? "" : "page student-page student-react-shell";
      return (
        <Wrapper className={wrapperClass}>
          <div className="card form-card">
            <p>{title}</p>
            <p className="helper-text">{message}</p>
            <p className="helper-text">Error: {errorMessage}</p>
            {showDebugStack && componentStack ? (
              <>
                <p className="helper-text">Component stack:</p>
                <pre className="preview-error-stack">{componentStack}</pre>
              </>
            ) : null}
            <div className="results-actions">
              <button type="button" className="secondary-btn" onClick={() => window.location.reload()}>
                Reload page
              </button>
              {showClassic ? (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => window.location.assign("/student.html")}
                >
                  Return to classic
                </button>
              ) : null}
              {showDebugStack ? (
                <button type="button" className="secondary-btn" onClick={this.handleCopyDetails}>
                  Copy debug info
                </button>
              ) : null}
            </div>
          </div>
        </Wrapper>
      );
    }
    return this.props.children;
  }
}
