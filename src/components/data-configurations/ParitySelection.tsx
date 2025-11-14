import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
    value?: string
    onChange?: (next: string) => void
}

export default function ParitySelection ({ value, onChange }: Props) {
    const options = [
        { value: 'none', label: 'None' },
        { value: 'even', label: 'Even' },
        { value: 'odd', label: 'Odd' },
        { value: 'mark', label: 'Mark' },
        { value: 'space', label: 'Space' },
    ]
    return (
        <div className="flex flex-col gap-1">
            <span className="text-slate-400">Parity</span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select parity" />
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

