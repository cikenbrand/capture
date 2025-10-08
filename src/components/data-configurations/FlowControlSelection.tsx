import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
    value?: string
    onChange?: (next: string) => void
}

export default function FlowControlSelection ({ value, onChange }: Props) {
    const options = [
        { value: 'none', label: 'None' },
        { value: 'rtscts', label: 'RTS/CTS' },
        { value: 'xonxoff', label: 'XON/XOFF' },
    ]
    return (
        <div className="flex flex-col gap-1">
            <span>Flow Control</span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select flow control" />
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

