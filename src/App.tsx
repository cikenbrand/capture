import { useEffect, useState } from 'react'

function App() {
  const [fileNameFormatting, setFileNameFormatting] = useState('')

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const value = await window.ipcRenderer.invoke('obs:get-file-name-formatting')
        if (isMounted) setFileNameFormatting(typeof value === 'string' ? value : '')
      } catch {
        if (isMounted) setFileNameFormatting('')
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className='h-screen bg-red-300 p-6 space-y-4'>
      <span>{fileNameFormatting || '—'}</span>
    </div>
  )
}

export default App
