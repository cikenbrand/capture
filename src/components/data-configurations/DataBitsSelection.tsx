import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
    value?: string
    onChange?: (next: string) => void
}

export default function DataBitsSelection ({ value, onChange }: Props) {
    return (
        <div className="flex flex-col gap-1">
            <span>Data Bits</span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select data bits" />
                </SelectTrigger>
                <SelectContent>
                    {[5, 6, 7, 8].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

