import DataConfigAppBar from "./components/data-configurations/DataConfigAppBar";
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Select, SelectContent, SelectTrigger, SelectValue } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { Table } from "./components/ui/table";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import ComDeviceSelection from "./components/data-configurations/ComDeviceSelection";
import BaudRateSelection from "./components/data-configurations/BaudRateSelection";
import DataBitsSelection from "./components/data-configurations/DataBitsSelection";
import ParitySelection from "./components/data-configurations/ParitySelection";
import StopBitsSelection from "./components/data-configurations/StopBitsSelection";
import FlowControlSelection from "./components/data-configurations/FlowControlSelection";
import { Button } from "./components/ui/button";
import DataMapperTable from "./components/data-configurations/DataMapperTable";
import { BiPlus } from "react-icons/bi";
import { DraggableDialog } from "./components/ui/draggable-dialog";
import CreateDataKeyForm from "./components/data-configurations/CreateDataKeyForm";

export default function DataConfigurations() {
    const [selectedDevice, setSelectedDevice] = React.useState<string | undefined>(undefined)
    const [baudRate, setBaudRate] = React.useState<string>("9600")
    const [dataBits, setDataBits] = React.useState<string>("8")
    const [parity, setParity] = React.useState<string>("none")
    const [stopBits, setStopBits] = React.useState<string>("1")
    const [flowControl, setFlowControl] = React.useState<string>("none")
    const [isOpen, setIsOpen] = React.useState<boolean>(false)
    const [liveText, setLiveText] = React.useState<string>("")
    const [isCreateDataNameOpen, setIsCreateDataNameOpen] = React.useState(false)

    React.useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const res = await window.ipcRenderer.invoke('serial:getDeviceState')
                    if (!cancelled && res?.ok && res.data) {
                        const s = res.data as any
                        setSelectedDevice(s.device ?? undefined)
                        setBaudRate(String(s.baudRate ?? '9600'))
                        setDataBits(String(s.dataBits ?? '8'))
                        setParity(String(s.parity ?? 'none'))
                        setStopBits(String(s.stopBits ?? '1'))
                        setFlowControl(String(s.flowControl ?? 'none'))
                        setIsOpen(!!s.isOpen)
                        try {
                            const arr: string[] = Array.isArray(s.data) ? s.data : []
                            setLiveText(arr.join('\n'))
                        } catch { setLiveText('') }
                    }
                } catch { }
            })()
        return () => { cancelled = true }
    }, [])

    React.useEffect(() => {
        ; (async () => {
            try {
                await window.ipcRenderer.invoke('serial:updateDeviceState', {
                    device: selectedDevice ?? null,
                    baudRate, dataBits, parity, stopBits, flowControl,
                })
            } catch { }
        })()
    }, [selectedDevice, baudRate, dataBits, parity, stopBits, flowControl])

    React.useEffect(() => {
        let cancelled = false
        const id = setInterval(async () => {
            try {
                const res = await window.ipcRenderer.invoke('serial:getDeviceState')
                if (!cancelled && res?.ok && res.data) {
                    const s = res.data as any
                    setIsOpen(!!s.isOpen)
                    try {
                        const arr: string[] = Array.isArray(s.data) ? s.data : []
                        setLiveText(arr.join('\n'))
                    } catch { }
                }
            } catch { }
        }, 500)
        return () => { cancelled = true; clearInterval(id) }
    }, [])
    return (
        <div className='h-screen flex flex-col bg-[#1D2229]'>
            <DataConfigAppBar />
            <div className="flex-1 flex p-2 gap-1">
                <div className="flex-none flex flex-col gap-1 h-full w-[300px]">
                    <Tabs defaultValue="settings" className="h-full">
                        <TabsList>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                        </TabsList>
                        <TabsContent value="settings" className="flex flex-col gap-2 h-full p-1">
                            <div className="grid grid-cols-1 gap-2">
                                <ComDeviceSelection value={selectedDevice} onChange={setSelectedDevice} />
                                <BaudRateSelection value={baudRate} onChange={setBaudRate} />
                                <DataBitsSelection value={dataBits} onChange={setDataBits} />
                                <ParitySelection value={parity} onChange={setParity} />
                                <StopBitsSelection value={stopBits} onChange={setStopBits} />
                                <FlowControlSelection value={flowControl} onChange={setFlowControl} />
                                <Button onClick={async () => { try { await window.ipcRenderer.invoke('serial:updateDeviceState', { device: selectedDevice ?? null, baudRate, dataBits, parity, stopBits, flowControl }); const res = await window.ipcRenderer.invoke('serial:toggleOpen'); const nextOpen = !!(res?.ok && res.data?.isOpen); setIsOpen(nextOpen); if (!nextOpen) setLiveText(''); } catch { } }}>{isOpen ? 'Close Device' : 'Open Device'}</Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
                <div className="flex-1 flex flex-col">
                    <div className="flex-1">
                        <Tabs defaultValue="data-output" className="h-full">
                            <TabsList>
                                <TabsTrigger value="data-output">Data Output</TabsTrigger>
                            </TabsList>
                            <TabsContent value="data-output" className="flex flex-col p-2 gap-2">
                                <Textarea className="h-full w-full resize-none" value={liveText} onChange={() => { }} readOnly />
                                <div className="flex flex-col gap-1">
                                    <span>Separators</span>
                                    <RadioGroup className="flex flex-row gap-4" defaultValue=",">
                                        <label className="inline-flex items-center gap-2">
                                            <RadioGroupItem value="," />
                                            <span>Comma (,)</span>
                                        </label>
                                        <label className="inline-flex items-center gap-2">
                                            <RadioGroupItem value=";" />
                                            <span>Semicolon (;)</span>
                                        </label>
                                        <label className="inline-flex items-center gap-2">
                                            <RadioGroupItem value="|" />
                                            <span>Pipe (|)</span>
                                        </label>
                                        <label className="inline-flex items-center gap-2">
                                            <RadioGroupItem value="\t" />
                                            <span>Tab</span>
                                        </label>
                                    </RadioGroup>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                    <div className="flex-none h-[700px] overflow-hidden w-full">
                        <Tabs defaultValue="data-mapper" className="h-full">
                            <TabsList>
                                <TabsTrigger value="data-mapper">Data Mapper</TabsTrigger>
                            </TabsList>
                            <TabsContent value="data-mapper" className="flex flex-col gap-1 h-[200px]">
                                <div className="flex gap-2 items-center">
                                    <button
                                        title="Add Data Name"
                                        className="flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none"
                                        onClick={() => setIsCreateDataNameOpen(true)}>
                                        <BiPlus className="h-5 w-5" />
                                        <span className="font-medium">Create Data Name</span>
                                    </button>
                                </div>
                                <DataMapperTable />
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>
            <DraggableDialog open={isCreateDataNameOpen} onOpenChange={setIsCreateDataNameOpen} title="Create Data Name">
                <CreateDataKeyForm onClose={() => setIsCreateDataNameOpen(false)} />
            </DraggableDialog>
        </div>
    )
}