// Keeps a crash in one part of the page (the game scene, a building screen, the trading terminal) from
// blanking the rest. The fallback offers a retry, which re-mounts the part.

import { Component, type ReactNode } from 'react';

type Props = { name: string; children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.name}] crashed`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="notice err crash" role="alert">
        <b>The {this.props.name} hit an error.</b> The rest of HyperEmpire still works.
        <div className="mono small">{this.state.error.message}</div>
        <button type="button" className="btn small" onClick={() => this.setState({ error: null })}>
          TRY AGAIN
        </button>
      </div>
    );
  }
}
