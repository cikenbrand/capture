import { eventSections, EventSection } from "./eventsData";

type EventsGridProps = {
    sections?: EventSection[]
    disabled?: boolean
    onChipClick?: (chip: { label: string; code: string }) => void
}

export default function EventsGrid({ sections = eventSections, disabled = false, onChipClick }: EventsGridProps) {
    return (
        <div className="grid grid-cols-3 grid-rows-2 gap-2 h-full">
            {sections.map((section) => (
                <div key={section.title} className="flex flex-col bg-[#21262E] rounded-[2px] overflow-hidden border border-white/10">
                    <div className="flex-none w-full h-[37px] bg-[#363D4A] flex items-center px-2 gap-2">
                        <span className="text-white/80 font-semibold text-xs tracking-wide">{section.title}</span>
                        <div className="flex-1 h-[1px] bg-white/10" />
                        <div className="h-[20px] min-w-[20px] px-1 rounded-[4px] bg-[#2A313D] text-white/70 text-xs flex items-center justify-center border border-white/10">{section.items.length}</div>
                    </div>
                    <div className="flex-1 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                            {section.items.map((chip) => (
                                <div
                                    key={chip.label}
                                    className={`inline-flex items-center gap-1 h-fit px-2 rounded-md ${chip.bgClass} ${chip.textClass ?? 'text-white'} ${disabled ? 'opacity-30 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
                                    aria-disabled={disabled}
                                    onClick={() => { if (!disabled) onChipClick?.({ label: chip.label, code: chip.code }) }}
                                >
                                    <span className="text-sm font-semibold">{chip.label}</span>
                                    <span className={`text-[11px] font-semibold px-1 rounded ${chip.badgeBgClass ?? 'bg-white/20'}`}>{chip.code}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}


