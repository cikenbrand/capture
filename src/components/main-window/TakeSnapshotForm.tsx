import { useState } from "react"
import { Checkbox } from "../ui/checkbox"
import { Button } from "../ui/button"

export default function TakeSnapshotForm () {
  const [ch1, setCh1] = useState(true)
  const [ch2, setCh2] = useState(false)
  const [ch3, setCh3] = useState(false)
  const [ch4, setCh4] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const OUTPUT_DIR = 'D:\\_blob_\\snapshots'

  async function onTake() {
    if (!ch1 && !ch2 && !ch3 && !ch4) return
    setIsSaving(true)
    try {
      await window.ipcRenderer.invoke('obs:take-snapshot', {
        ch1,
        ch2,
        ch3,
        ch4,
        outputDir: OUTPUT_DIR,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 w-[320px]">
      <div className="flex items-center gap-2">
        <Checkbox checked={ch1} onCheckedChange={(v) => setCh1(v === true)} />
        <span>Channel 1</span>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={ch2} onCheckedChange={(v) => setCh2(v === true)} />
        <span>Channel 2</span>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={ch3} onCheckedChange={(v) => setCh3(v === true)} />
        <span>Channel 3</span>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={ch4} onCheckedChange={(v) => setCh4(v === true)} />
        <span>Channel 4</span>
      </div>
      <div className="mt-1 flex justify-end">
        <Button disabled={isSaving || (!ch1 && !ch2 && !ch3 && !ch4)} onClick={onTake}>
          {isSaving ? 'Saving…' : 'Take Snapshot'}
        </Button>
      </div>
    </div>
  )
}