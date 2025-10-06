import { useEffect, useState } from "react"
import { Checkbox } from "../ui/checkbox"
import { Button } from "../ui/button"

type Props = { onClose?: () => void }

export default function TakeSnapshotForm ({ onClose }: Props) {
  const [ch1, setCh1] = useState(true)
  const [ch2, setCh2] = useState(false)
  const [ch3, setCh3] = useState(false)
  const [ch4, setCh4] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [outputDir, setOutputDir] = useState('D:\\_blob_\\snapshots')
  const [file1, setFile1] = useState('')
  const [file2, setFile2] = useState('')
  const [file3, setFile3] = useState('')
  const [file4, setFile4] = useState('')

  function nowYYMMDDHHMMSS() {
    const n = new Date()
    const yy = String(n.getFullYear()).slice(-2)
    const mm = String(n.getMonth() + 1).padStart(2, '0')
    const dd = String(n.getDate()).padStart(2, '0')
    const hh = String(n.getHours()).padStart(2, '0')
    const mi = String(n.getMinutes()).padStart(2, '0')
    const ss = String(n.getSeconds()).padStart(2, '0')
    return `${yy}${mm}${dd}${hh}${mi}${ss}`
  }

  // Generate a single timestamp when the form opens and prefill inputs
  const [stamp, setStamp] = useState('')
  useEffect(() => {
    const s = nowYYMMDDHHMMSS()
    setStamp(s)
    setFile1(prev => prev || `ch1-${s}`)
    setFile2(prev => prev || `ch2-${s}`)
    setFile3(prev => prev || `ch3-${s}`)
    setFile4(prev => prev || `ch4-${s}`)
  }, [])

  async function onTake() {
    if (!ch1 && !ch2 && !ch3 && !ch4) return
    setIsSaving(true)
    try {
      const ts = stamp || nowYYMMDDHHMMSS()
      // Invoke per channel separately with dedicated filenames
      if (ch1) await window.ipcRenderer.invoke('obs:take-snapshot', { ch1: true, outputDir, fileName: (file1?.trim() || `ch1-${ts}`) })
      if (ch2) await window.ipcRenderer.invoke('obs:take-snapshot', { ch2: true, outputDir, fileName: (file2?.trim() || `ch2-${ts}`) })
      if (ch3) await window.ipcRenderer.invoke('obs:take-snapshot', { ch3: true, outputDir, fileName: (file3?.trim() || `ch3-${ts}`) })
      if (ch4) await window.ipcRenderer.invoke('obs:take-snapshot', { ch4: true, outputDir, fileName: (file4?.trim() || `ch4-${ts}`) })
      try { onClose?.() } catch {}
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col gap-1">
        <span className="text-xs opacity-80">Output Path</span>
        <input className="h-7 rounded bg-[#2B313C] px-2 text-sm" value={outputDir} onChange={(e) => setOutputDir(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={ch1} onCheckedChange={(v) => setCh1(v === true)} />
        <span>Channel 1</span>
      </div>
      <input className="h-7 rounded bg-[#2B313C] px-2 text-sm" placeholder="ch1-YYMMDDhhmmss" value={file1} onChange={(e) => setFile1(e.target.value)} />
      <div className="flex items-center gap-2">
        <Checkbox checked={ch2} onCheckedChange={(v) => setCh2(v === true)} />
        <span>Channel 2</span>
      </div>
      <input className="h-7 rounded bg-[#2B313C] px-2 text-sm" placeholder="ch2-YYMMDDhhmmss" value={file2} onChange={(e) => setFile2(e.target.value)} />
      <div className="flex items-center gap-2">
        <Checkbox checked={ch3} onCheckedChange={(v) => setCh3(v === true)} />
        <span>Channel 3</span>
      </div>
      <input className="h-7 rounded bg-[#2B313C] px-2 text-sm" placeholder="ch3-YYMMDDhhmmss" value={file3} onChange={(e) => setFile3(e.target.value)} />
      <div className="flex items-center gap-2">
        <Checkbox checked={ch4} onCheckedChange={(v) => setCh4(v === true)} />
        <span>Channel 4</span>
      </div>
      <input className="h-7 rounded bg-[#2B313C] px-2 text-sm" placeholder="ch4-YYMMDDhhmmss" value={file4} onChange={(e) => setFile4(e.target.value)} />
      <div className="mt-1 flex justify-end gap-2">
        <Button onClick={() => { try { onClose?.() } catch {} }} disabled={isSaving}>Cancel</Button>
        <Button disabled={isSaving || (!ch1 && !ch2 && !ch3 && !ch4)} onClick={onTake}>
          {isSaving ? 'Saving…' : 'Take Snapshot'}
        </Button>
      </div>
    </div>
  )
}