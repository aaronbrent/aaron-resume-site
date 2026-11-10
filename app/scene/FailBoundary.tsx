import { Component, type ReactNode } from "react";

/**
 * Renders nothing once a child throws and reports it, so a failed chunk load
 * or shader error never takes the document down. Three-free: SceneMount (the
 * eager side) and SceneCanvas (inside the R3F root, whose errors don't reach
 * DOM-side boundaries) both use it.
 */
export class FailBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
