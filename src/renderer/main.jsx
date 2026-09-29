import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL RENDER ERROR CAUGHT IN REACT:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, background: '#18181a', color: '#ff4d4f', fontFamily: 'monospace', minHeight: '100vh', overflow: 'auto' }}>
          <h2 style={{ color: '#fff', fontSize: 20 }}>React Rendering Error Caught</h2>
          <pre style={{ background: '#222', padding: 20, borderRadius: 8, color: '#ff7875', whiteSpace: 'pre-wrap', marginTop: 16 }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ background: '#111', padding: 20, borderRadius: 8, color: '#aaa', whiteSpace: 'pre-wrap', marginTop: 16, fontSize: 11 }}>
            {this.state.errorInfo?.componentStack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, padding: '10px 20px', background: '#FA2D48', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

