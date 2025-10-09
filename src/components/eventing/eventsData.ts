export type EventChip = {
    label: string
    code: string
    bgClass: string
    textClass?: string
    badgeBgClass?: string
}

export type EventSection = {
    title: string
    items: EventChip[]
}

export const eventSections: EventSection[] = [
    {
        title: 'CATHODIC PROTECTION',
        items: [
            { label: 'CP Stab', code: 'CP', bgClass: 'bg-[#1BAA63]', textClass: 'text-white' },
            { label: 'Anode', code: 'AN', bgClass: 'bg-[#A855F7]', textClass: 'text-white' },
            { label: 'Potential Drop', code: 'PD', bgClass: 'bg-[#15803D]', textClass: 'text-white' },
        ],
    },
    {
        title: 'PIPELINE INTEGRITY',
        items: [
            { label: 'Free Span', code: 'FS', bgClass: 'bg-[#F59E0B]', textClass: 'text-white' },
            { label: 'Exposure', code: 'EX', bgClass: 'bg-[#D97706]', textClass: 'text-white' },
            { label: 'Burial', code: 'BU', bgClass: 'bg-[#B45309]', textClass: 'text-white' },
            { label: 'Coating Damage', code: 'CD', bgClass: 'bg-[#EF4444]', textClass: 'text-white' },
            { label: 'Field Joint', code: 'FJ', bgClass: 'bg-[#EC4899]', textClass: 'text-white' },
            { label: 'Dent', code: 'DN', bgClass: 'bg-[#F43F5E]', textClass: 'text-white' },
            { label: 'Corrosion Patch', code: 'CPH', bgClass: 'bg-[#F472B6]', textClass: 'text-white' },
        ],
    },
    {
        title: 'OBSTRUCTIONS & EXTERNAL',
        items: [
            { label: 'Debris', code: 'DB', bgClass: 'bg-[#3B82F6]', textClass: 'text-white' },
            { label: 'Crossing', code: 'CR', bgClass: 'bg-[#10B981]', textClass: 'text-white' },
            { label: '3rd Party Damage', code: 'TPD', bgClass: 'bg-[#84CC16]', textClass: 'text-white' },
            { label: 'Fishing Net', code: 'FN', bgClass: 'bg-[#06B6D4]', textClass: 'text-white' },
            { label: 'Anchor Drag Mark', code: 'AD', bgClass: 'bg-[#10B981]', textClass: 'text-white' },
        ],
    },
    {
        title: 'PIPELINE FEATURES',
        items: [
            { label: 'Valve / Fitting', code: 'VF', bgClass: 'bg-[#6B7280]', textClass: 'text-white' },
            { label: 'Pipeline Start/End', code: 'PE', bgClass: 'bg-[#38BDF8]', textClass: 'text-white' },
            { label: 'Touch Down', code: 'TD', bgClass: 'bg-[#6366F1]', textClass: 'text-white' },
            { label: 'Tie-In Spool', code: 'TI', bgClass: 'bg-[#60A5FA]', textClass: 'text-white' },
            { label: 'Piggyback Line', code: 'PB', bgClass: 'bg-[#A78BFA]', textClass: 'text-white' },
        ],
    },
    {
        title: 'CRITICAL / OTHER',
        items: [
            { label: 'Leak', code: 'LK', bgClass: 'bg-[#DC2626]', textClass: 'text-white' },
            { label: 'Gas Bubble Release', code: 'GB', bgClass: 'bg-[#EF4444]', textClass: 'text-white' },
            { label: 'Oil Sheen', code: 'OS', bgClass: 'bg-[#B45309]', textClass: 'text-white' },
            // Comment with dark text
            { label: 'Comment', code: 'CM', bgClass: 'bg-[#9CA3AF]', textClass: 'text-black', badgeBgClass: 'bg-black/20' },
        ],
    },
    {
        title: 'SEABED & ENVIRONMENT',
        items: [
            { label: 'Scour', code: 'SC', bgClass: 'bg-[#F59E0B]', textClass: 'text-white' },
            { label: 'Sand Wave', code: 'SW', bgClass: 'bg-[#FBBF24]', textClass: 'text-white' },
            { label: 'Marine Growth', code: 'MG', bgClass: 'bg-[#10B981]', textClass: 'text-white' },
        ],
    },
]


