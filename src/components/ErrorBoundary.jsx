import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown runtime error',
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application runtime error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen flex items-center justify-center bg-bg px-6">
          <div className="max-w-xl w-full rounded-lg border border-border-md bg-white p-6 shadow-md">
            <h1 className="font-serif text-2xl text-ink-dark mb-3">Application Error</h1>
            <p className="text-ink-light mb-4">
              The app hit a runtime error. Check the browser console for full details.
            </p>
            <pre className="text-xs whitespace-pre-wrap break-words bg-bg-alt p-3 rounded">
              {this.state.errorMessage}
            </pre>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
