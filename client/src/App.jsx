import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getAuthStatus } from './api/index.js'
import { LoadingScreen } from './components/ui/index.js'
import Login from './pages/Login.jsx'
import Inbox from './pages/Inbox.jsx'

export default function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    getAuthStatus()
      .then(({ connected: isConnected, error: statusError }) => {
        setConnected(!!isConnected)
        if (statusError) console.warn('Auth status:', statusError)
        setAuthChecked(true)
      })
      .catch((err) => {
        console.warn('Auth check failed:', err.message)
        setAuthChecked(true)
      })
  }, [])

  if (!authChecked) return <LoadingScreen />

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            connected ? <Navigate to="/inbox" replace /> : <Login onConnect={() => setConnected(true)} />
          }
        />
        <Route
          path="/inbox"
          element={
            connected ? <Inbox onDisconnect={() => setConnected(false)} /> : <Navigate to="/" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
