import { memo, useEffect } from "react"
import { Button } from "../ui/button"

type Props = { onClose?: () => void }

export default memo(function StartClipRecordingForm({ onClose }: Props) {
    async function handleStartClip() {
        try {
            await window.ipcRenderer.invoke('obs:start-clip-recording')
        } catch {}
        onClose?.()
    }
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const now = new Date()
                const yy = String(now.getFullYear()).slice(-2)
                const mm = String(now.getMonth() + 1).padStart(2, '0')
                const dd = String(now.getDate()).padStart(2, '0')
                const hh = String(now.getHours()).padStart(2, '0')
                const mi = String(now.getMinutes()).padStart(2, '0')
                const ss = String(now.getSeconds()).padStart(2, '0')
                const yymmddhhmmss = `${yy}${mm}${dd}${hh}${mi}${ss}`

                if (!cancelled) {
                    try { await window.ipcRenderer.invoke('obs:set-clip-file-name-formatting', yymmddhhmmss) } catch {}
                }
            } catch {}
        })()
        return () => { cancelled = true }
    }, [])

    return (
        <div className="flex flex-col gap-4">
            <div className="text-white/80">Clip filename will be set to clip-yymmddhhmmss.</div>
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose}>Close</Button>
                <Button onClick={handleStartClip}>Start Clip</Button>
            </div>
        </div>
    )
})