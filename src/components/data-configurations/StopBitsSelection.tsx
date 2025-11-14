import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
    value?: string
    onChange?: (next: string) => void
}

export default function StopBitsSelection ({ value, onChange }: Props) {
    const options = [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
    ]
    return (
        <div className="flex flex-col gap-1">
            <span className="text-slate-400">Stop Bits</span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select stop bits" />
                </SelectTrigger>
                <SelectContent>
                    {options.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

