import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SkulletProvider } from 'skullet/react'
import './styles/index.css'
import App from './App.tsx'
import { SKULLET_THEME } from './lib/skeleton'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SkulletProvider theme={SKULLET_THEME} mode='light'>
      <App />
    </SkulletProvider>
  </StrictMode>,
)
