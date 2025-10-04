import { memo, useEffect, useState } from "react"
import { Checkbox } from "../ui/checkbox"
import { Input } from "../ui/input"
import { Button } from "../ui/button"

type Props = {
    onClose: () => void
}

export default memo(function StartSessionForm({ onClose }: Props) {
    const [previewPath, setPreviewPath] = useState("")
    const [channel1Path, setChannel1Path] = useState("")
    const [channel2Path, setChannel2Path] = useState("")
    const [channel3Path, setChannel3Path] = useState("")
    const [channel4Path, setChannel4Path] = useState("")
    const [previewFileName, setPreviewFileName] = useState("")
    const [channel1FileName, setChannel1FileName] = useState("")
    const [channel2FileName, setChannel2FileName] = useState("")
    const [channel3FileName, setChannel3FileName] = useState("")
    const [channel4FileName, setChannel4FileName] = useState("")

    useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const now = new Date()
                    const dd = String(now.getDate()).padStart(2, '0')
                    const mm = String(now.getMonth() + 1).padStart(2, '0')
                    const yy = String(now.getFullYear()).slice(-2)
                    const hh = String(now.getHours()).padStart(2, '0')
                    const mi = String(now.getMinutes()).padStart(2, '0')
                    const ss = String(now.getSeconds()).padStart(2, '0')
                    const ddmmyyhhmmss = `${dd}${mm}${yy}${hh}${mi}${ss}`

                    try { await window.ipcRenderer.invoke('obs:set-file-name-formatting', ddmmyyhhmmss) } catch { }

                const dir = await window.ipcRenderer.invoke('obs:get-recording-directory') as unknown
                    const safe = typeof dir === 'string' ? dir : ""
                const currentFmt = await window.ipcRenderer.invoke('obs:get-file-name-formatting') as any
                const previewFmt = currentFmt && typeof currentFmt.preview === 'string' ? currentFmt.preview : ""
                const ch1Fmt = currentFmt && typeof currentFmt.ch1 === 'string' ? currentFmt.ch1 : ""
                const ch2Fmt = currentFmt && typeof currentFmt.ch2 === 'string' ? currentFmt.ch2 : ""
                const ch3Fmt = currentFmt && typeof currentFmt.ch3 === 'string' ? currentFmt.ch3 : ""
                const ch4Fmt = currentFmt && typeof currentFmt.ch4 === 'string' ? currentFmt.ch4 : ""
                    if (cancelled) return
                    setPreviewPath(safe)
                    setChannel1Path(safe)
                    setChannel2Path(safe)
                    setChannel3Path(safe)
                    setChannel4Path(safe)
                setPreviewFileName(previewFmt)
                setChannel1FileName(ch1Fmt)
                setChannel2FileName(ch2Fmt)
                setChannel3FileName(ch3Fmt)
                setChannel4FileName(ch4Fmt)
                } catch {
                    // ignore
                }
            })()
        return () => { cancelled = true }
    }, [])

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <Checkbox />
                    <span className="font-bold">Preview</span>
                </div>
                <div className="flex gap-2 items-center text-nowrap">
                    <div className="flex gap-1 items-center">
                        <span>Path</span>
                        <Input className="h-7" value={previewPath} onChange={(e) => setPreviewPath(e.target.value)} />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span>File Name</span>
                        <Input className="h-7" value={previewFileName} onChange={(e) => setPreviewFileName(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <Checkbox />
                    <span className="font-bold">Channel 1</span>
                </div>
                <div className="flex gap-2 items-center text-nowrap">
                    <div className="flex gap-1 items-center">
                        <span>Path</span>
                        <Input className="h-7" value={channel1Path} onChange={(e) => setChannel1Path(e.target.value)} />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span>File Name</span>
                        <Input className="h-7" value={channel1FileName} onChange={(e) => setChannel1FileName(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <Checkbox />
                    <span className="font-bold">Channel 2</span>
                </div>
                <div className="flex gap-2 items-center text-nowrap">
                    <div className="flex gap-1 items-center">
                        <span>Path</span>
                        <Input className="h-7" value={channel2Path} onChange={(e) => setChannel2Path(e.target.value)} />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span>File Name</span>
                        <Input className="h-7" value={channel2FileName} onChange={(e) => setChannel2FileName(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <Checkbox />
                    <span className="font-bold">Channel 3</span>
                </div>
                <div className="flex gap-2 items-center text-nowrap">
                    <div className="flex gap-1 items-center">
                        <span>Path</span>
                        <Input className="h-7" value={channel3Path} onChange={(e) => setChannel3Path(e.target.value)} />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span>File Name</span>
                        <Input className="h-7" value={channel3FileName} onChange={(e) => setChannel3FileName(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <Checkbox />
                    <span className="font-bold">Channel 4</span>
                </div>
                <div className="flex gap-2 items-center text-nowrap">
                    <div className="flex gap-1 items-center">
                        <span>Path</span>
                        <Input className="h-7" value={channel4Path} onChange={(e) => setChannel4Path(e.target.value)} />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span>File Name</span>
                        <Input className="h-7" value={channel4FileName} onChange={(e) => setChannel4FileName(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={onClose}>Start Session</Button>
            </div>
        </div>
    )
})

