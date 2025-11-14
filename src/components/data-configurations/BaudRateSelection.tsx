import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
    value?: string
    onChange?: (next: string) => void
}

export default function BaudRateSelection ({ value, onChange }: Props) {
    return (
        <div className="flex flex-col gap-1">
        <span className="text-slate-400">Baud</span>
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select baud" />
            </SelectTrigger>
            <SelectContent>
                {[
                    110, 300, 600, 1200, 2400, 4800, 9600,
                    14400, 19200, 38400, 57600, 115200, 230400, 460800
                ].map(b => (
                    <SelectItem key={b} value={String(b)}>{b}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
    )
}