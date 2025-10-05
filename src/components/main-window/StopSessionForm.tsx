import { memo } from "react"
import { Button } from "../ui/button"

type Props = {
  onClose: () => void
}

export default memo(function StopSessionForm({ onClose }: Props) {
  async function handleStop() {
    try {
      await window.ipcRenderer.invoke('obs:stop-recording')
    } catch {}
    onClose()
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="text-white/80">
        Are you sure you want to stop the session?
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleStop}>Stop Session</Button>
      </div>
    </div>
  )
})

