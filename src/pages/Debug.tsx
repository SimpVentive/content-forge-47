import { useEffect, useState } from 'react';

export default function Debug() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;
    const captured = [...logs];

    console.log = (...args) => {
      originalLog(...args);
      captured.push('[LOG] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
      setLogs([...captured]);
    };

    console.error = (...args) => {
      originalError(...args);
      captured.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
      setLogs([...captured]);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <h1>✓ Debug Page Loaded</h1>
      <p>If you can see this, React is working!</p>

      <section>
        <h2>Environment Variables</h2>
        <pre>
VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL || 'NOT SET'}
VITE_SUPABASE_PUBLISHABLE_KEY: {import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'SET (length: ' + import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY.length + ')' : 'NOT SET'}
        </pre>
      </section>

      <section>
        <h2>Console Logs ({logs.length})</h2>
        <pre style={{ backgroundColor: '#fff', padding: '10px', maxHeight: '400px', overflow: 'auto', border: '1px solid #ccc' }}>
          {logs.length === 0 ? '(no logs yet)' : logs.join('\n')}
        </pre>
      </section>

      <section>
        <h2>Test Actions</h2>
        <button onClick={() => console.log('Test log at ' + new Date().toISOString())} style={{ padding: '10px', marginRight: '10px' }}>
          Log Test Message
        </button>
        <button onClick={() => console.error('Test error at ' + new Date().toISOString())} style={{ padding: '10px', backgroundColor: '#ff6b6b', color: 'white' }}>
          Log Test Error
        </button>
      </section>
    </div>
  );
}
