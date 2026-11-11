
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error: error.message || "Unknown rendering error",
    };
  }

  componentDidCatch(error, info) {
    console.error("SINAG-ANI React error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{
          padding: "30px",
          background: "#101820",
          color: "#ffffff",
          minHeight: "100vh",
          fontFamily: "Arial, sans-serif"
        }}>
          <h1>SINAG-ANI Dashboard Error</h1>
          <p>The dashboard encountered a rendering problem.</p>
          <pre style={{ whiteSpace: "pre-wrap", color: "#fca5a5" }}>
            {this.state.error}
          </pre>
          <p>Check the browser console for more details.</p>
        </main>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("React root element not found. Check index.html.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
