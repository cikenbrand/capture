import { memo } from "react"
import { Button } from "../ui/button"

type Props = { onClose?: () => void }

export default memo(function StopClipRecordingForm({ onClose }: Props) {
    async function handleStop() {
        try {
            await window.ipcRenderer.invoke('obs:stop-clip-recording')
        } catch { }
        onClose?.()
    }
    return (
        <div className="flex flex-col gap-4">
            <div className="text-white/80">Are you sure you want to stop the clip?</div>
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleStop}>Stop Clip</Button>
            </div>
        </div>
    )
})

