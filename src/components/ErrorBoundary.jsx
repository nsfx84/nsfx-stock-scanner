import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-panel border border-bad rounded-xl p-5 my-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-bad shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <div className="font-semibold text-bad mb-1">Something broke in this section</div>
              <div className="text-sm text-muted mb-2">
                {this.state.error?.message || 'Unknown error'}
              </div>
              <div className="text-xs text-muted mb-3">
                Open the browser console (F12) for the full stack trace and paste it back if this keeps happening.
              </div>
              <button
                onClick={this.reset}
                className="bg-accent text-black px-3 py-1 rounded text-sm font-medium"
              >Try again</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
