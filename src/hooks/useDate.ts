import { useEffect, useState } from "react";

type UseDateOptions = {
    locale?: string
    useUTC?: boolean
}

export function useDate(options: UseDateOptions = {}): string {
    const { locale, useUTC = false } = options
    const formatOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: useUTC ? 'UTC' : undefined,
    }

    const formatter = new Intl.DateTimeFormat(locale ?? undefined, formatOptions)

    const [value, setValue] = useState(() => formatter.format(new Date()))

    useEffect(() => {
        const interval = window.setInterval(() => {
            setValue(formatter.format(new Date()))
        }, 60 * 1000)
        setValue(formatter.format(new Date()))
        return () => window.clearInterval(interval)
    }, [locale, useUTC])

    return value
}
