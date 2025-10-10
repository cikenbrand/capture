import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import OverlayEditor from './OverlayEditor'
import ExportProject from './ExportProject'
import PictureInPicture from './PictureInPicture'
import FullScreenPreview from './FullScreenPreview'
import Eventing from './Eventing'
import DataConfigurations from './DataConfigurations'
import { Toaster } from "@/components/ui/sonner"
import './index.css'

const params = new URLSearchParams(location.search)
const which = params.get('window')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <>
    {which === 'overlay-editor' ? <OverlayEditor />
      : which === 'export-project' ? <ExportProject />
      : which === 'picture-in-picture' ? <PictureInPicture />
      : which === 'channel-preview' ? <FullScreenPreview />
      : which === 'eventing' ? <Eventing />
      : which === 'data-configurations' ? <DataConfigurations />
      : <App />}
    <Toaster/>
    </>
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
