/* eslint-disable no-unused-vars -- JSX uses these */
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAuthStatus } from './api';
import Login from './pages/Login';
import Inbox from './pages/Inbox';

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    getAuthStatus()
      .then(({ connected: c }) => {
        setConnected(!!c);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  if (!authChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={connected ? <Navigate to="/inbox" replace /> : <Login onConnect={() => setConnected(true)} />} />
        <Route path="/inbox" element={connected ? <Inbox onDisconnect={() => setConnected(false)} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
