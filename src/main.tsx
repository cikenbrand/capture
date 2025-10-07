import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import OverlayEditor from './OverlayEditor'
import ExportProject from './ExportProject'
import { Toaster } from "@/components/ui/sonner"
import './index.css'

const params = new URLSearchParams(location.search)
const which = params.get('window')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <>
    {which === 'overlay-editor' ? <OverlayEditor /> : which === 'export-project' ? <ExportProject /> : <App />}
    <Toaster/>
    </>
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
