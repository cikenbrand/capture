import { memo } from "react"
import { Button } from "../ui/button"

type Props = { onClose?: () => void }

export default memo(function PauseSessionForm({ onClose }: Props) {
    async function handlePause() {
        try {
            await window.ipcRenderer.invoke('obs:pause-recording')
        } catch { }
        onClose?.()
    }
    return (
        <div className="flex flex-col gap-4">
            <div className="text-white/80">Pause or resume the current recording?</div>
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose}>Close</Button>
                <Button onClick={handlePause}>Toggle Pause</Button>
            </div>
        </div>
    )
})