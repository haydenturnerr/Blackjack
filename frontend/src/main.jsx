import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { TonConnectUIProvider } from '@tonconnect/ui-react'

ReactDOM.createRoot(document.getElementById('root')).render(
  <TonConnectUIProvider manifestUrl="https://toncompetitions.vercel.app/tonconnect-manifest.json">
    <App />
  </TonConnectUIProvider>
)
