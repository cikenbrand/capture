import { useEffect, useState } from "react";

type UseTimeOptions = {
    twentyFourHour?: boolean
    useUTC?: boolean
    locale?: string
}

function formatTime(date: Date, { twentyFourHour = true, useUTC = false, locale }: UseTimeOptions): string {
    const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !twentyFourHour,
        timeZone: useUTC ? 'UTC' : undefined,
    }
    return new Intl.DateTimeFormat(locale ?? undefined, options).format(date)
}

export function useTime(options: UseTimeOptions = {}): string {
    const [value, setValue] = useState(() => formatTime(new Date(), options))

    useEffect(() => {
        const update = () => setValue(formatTime(new Date(), options))
        const id = window.setInterval(update, 1000)
        update()
        return () => window.clearInterval(id)
    }, [options.twentyFourHour, options.useUTC, options.locale])

    return value
}
