'use client';
import { Component, Suspense, type ReactNode } from 'react';

class ToolBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="tool-recovery" role="alert"><h3>{this.props.name} could not finish loading</h3><p>You can continue using the other tools, or try this section again.</p><button onClick={() => this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }))}>Try {this.props.name} again</button></section>;
    return <Suspense key={this.state.attempt} fallback={<p className="tool-recovery" role="status">Opening {this.props.name}…</p>}>{this.props.children}</Suspense>;
  }
}
export default function ToolPanel({ name, children }: { name: string; children: ReactNode }) {
  return <ToolBoundary name={name}>{children}</ToolBoundary>;
}
