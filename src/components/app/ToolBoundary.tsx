import { Component, type ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps one tool's failure inside that tool: the rest of the app (and your
 * roll, settings and other tools) keeps working, and the tool can be retried.
 */
export default class ToolBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`${this.props.label} stopped working:`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="panel tool-empty" role="alert" aria-label={`${this.props.label} stopped working`}>
        <p>{this.props.label} stopped working. The rest of the app is unaffected.</p>
        <button type="button" className="btn btn-red" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </section>
    );
  }
}
