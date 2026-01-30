import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Student React render error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="page student-page student-react-shell">
          <div className="card form-card">
            <p>Something went wrong. Please refresh the page.</p>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
