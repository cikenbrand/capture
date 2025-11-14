import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
    onClose?: () => void
}

type HorizontalAlign = 'left' | 'center' | 'right'
type VerticalAlign = 'top' | 'center' | 'bottom'

type TextStyleShape = {
    fontSize?: number
    fontWeight?: number | string
    letterSpacing?: number
    fontFamily?: string
    color?: string
    align?: HorizontalAlign | 'start' | 'end'
    verticalAlign?: VerticalAlign | 'start' | 'end' | 'middle'
    [key: string]: any
}

type OverlayComponentForEdit = {
    customText?: string
    twentyFourHour?: boolean
    useUTC?: boolean
    _id: string
    name?: string
    type?: string
    backgroundColor?: string
    textStyle?: TextStyleShape
    nodeLevel?: number
    projectDetail?: 'name' | 'client' | 'vessel' | 'location' | 'contractor'
    dataKey?: string | null
}

const FONT_WEIGHT_OPTIONS = [
    { value: '300', label: 'Light (300)' },
    { value: '400', label: 'Regular (400)' },
    { value: '700', label: 'Bold (700)' },
] as const

const FONT_FAMILY_OPTIONS = [
    { value: 'Inter, ui-sans-serif, system-ui', label: 'Inter' },
    { value: 'Roboto, sans-serif', label: 'Roboto' },
    { value: '"Helvetica Neue", Arial, sans-serif', label: 'Helvetica' },
] as const

const H_ALIGN_OPTIONS = [
    { value: 'left' as HorizontalAlign, label: 'Start' },
    { value: 'center' as HorizontalAlign, label: 'Center' },
    { value: 'right' as HorizontalAlign, label: 'End' },
] as const

const V_ALIGN_OPTIONS = [
    { value: 'top' as VerticalAlign, label: 'Start' },
    { value: 'center' as VerticalAlign, label: 'Center' },
    { value: 'bottom' as VerticalAlign, label: 'End' },
] as const

const DEFAULT_FONT_FAMILY = 'Inter, ui-sans-serif, system-ui'
const DEFAULT_FONT_COLOR = '#FFFFFF'
const DEFAULT_BACKGROUND_COLOR = '#000000'
const DEFAULT_HORIZONTAL_ALIGN: HorizontalAlign = 'left'
const DEFAULT_VERTICAL_ALIGN: VerticalAlign = 'center'

const DEFAULT_TEXT_STYLE: TextStyleShape = {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: 16,
    fontWeight: 'normal',
    color: DEFAULT_FONT_COLOR,
    align: DEFAULT_HORIZONTAL_ALIGN,
    verticalAlign: DEFAULT_VERTICAL_ALIGN,
    letterSpacing: 0,
}

function normalizeFontFamily(value: unknown): string {
    if (typeof value === 'string' && value.trim()) return value
    return DEFAULT_FONT_FAMILY
}

function normalizeHexColor(value: unknown, fallback: string): string {
    if (typeof value === 'string') {
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value
        if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
            const expanded = value.slice(1).split('').map((ch) => ch + ch).join('')
            return `#${expanded}`
        }
    }
    return fallback
}

function normalizeHorizontalAlign(value: unknown): HorizontalAlign {
    if (value === 'center') return 'center'
    if (value === 'right' || value === 'end' || value === 'flex-end') return 'right'
    return 'left'
}

function normalizeVerticalAlign(value: unknown): VerticalAlign {
    if (value === 'bottom' || value === 'end' || value === 'flex-end') return 'bottom'
    if (value === 'center' || value === 'middle') return 'center'
    return 'top'
}

function normalizeFontWeight(value: unknown): string | undefined {
    if (typeof value === 'number') return String(value)
    if (value === 'bold') return '700'
    if (value === 'normal') return '400'
    if (typeof value === 'string') {
        const numeric = Number(value)
        if (Number.isFinite(numeric) && numeric > 0) return String(numeric)
    }
    return undefined
}

function parseFontWeight(value: string): number | null {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) return null
    return numeric
}

export default function EditComponentForm({ onClose }: Props) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [overlayComponents, setOverlayComponents] = useState<OverlayComponentForEdit[]>([])
    const [componentType, setComponentType] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [textStyle, setTextStyle] = useState<TextStyleShape | undefined>(undefined)
    const [fontSize, setFontSize] = useState('')
    const [letterSpacing, setLetterSpacing] = useState('')
    const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_FAMILY)
    const [horizontalAlign, setHorizontalAlign] = useState<HorizontalAlign>(DEFAULT_HORIZONTAL_ALIGN)
    const [verticalAlign, setVerticalAlign] = useState<VerticalAlign>(DEFAULT_VERTICAL_ALIGN)
    const [fontColor, setFontColor] = useState(DEFAULT_FONT_COLOR)
    const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR)
    const [backgroundEnabled, setBackgroundEnabled] = useState(false)
    const [fontWeight, setFontWeight] = useState<string | undefined>(undefined)
    const [customText, setCustomText] = useState('')
    const [twentyFourHour, setTwentyFourHour] = useState(true)
    const [useUTC, setUseUTC] = useState(false)
    const [nodeLevel, setNodeLevel] = useState(1)
    const [projectDetail, setProjectDetail] = useState<'name' | 'client' | 'vessel' | 'location' | 'contractor'>('name')
    const [dataKey, setDataKey] = useState<string | null>(null)
    const [availableDataKeys, setAvailableDataKeys] = useState<Array<{ _id: string; name: string }>>([])
    const [imageUploading, setImageUploading] = useState(false)
    const [imageDeleting, setImageDeleting] = useState(false)
    const [imageOpacity, setImageOpacity] = useState('1')
    const [imagesLoading, setImagesLoading] = useState(false)
    const [overlayImages, setOverlayImages] = useState<Array<{ fileUrl: string; filename: string }>>([])
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const canEdit = selectedIds.length === 1
    const canEditTextStyle = canEdit && componentType !== 'image'

    useEffect(() => {
        let active = true
        let latestRequestId = 0

        const resetState = () => {
            setName('')
            setTextStyle(undefined)
            setFontSize('')
            setLetterSpacing('')
            setFontFamily(DEFAULT_FONT_FAMILY)
            setHorizontalAlign(DEFAULT_HORIZONTAL_ALIGN)
            setVerticalAlign(DEFAULT_VERTICAL_ALIGN)
            setFontColor(DEFAULT_FONT_COLOR)
            setBackgroundColor(DEFAULT_BACKGROUND_COLOR)
            setBackgroundEnabled(false)
            setFontWeight(undefined)
            setCustomText('')
            setTwentyFourHour(true)
            setUseUTC(false)
            setNodeLevel(1)
            setComponentType(null)
            setOverlayComponents([])
        }

        const syncFromIds = async (ids: string[]) => {
            latestRequestId += 1
            const requestId = latestRequestId
            if (!active) return
            setSelectedIds(ids)
            if (ids.length !== 1) {
                if (active) resetState()
                return
            }
            try {
                const overlayRes = await window.ipcRenderer.invoke('app:getSelectedOverlayLayerId')
                const overlayId: string | null = overlayRes?.ok ? (overlayRes.data ?? null) : null
                if (!overlayId) {
                    if (active && requestId === latestRequestId) resetState()
                    return
                }
                const res = await window.ipcRenderer.invoke('db:getOverlayComponentsForRender', { overlayId })
                const components: OverlayComponentForEdit[] = res?.ok && Array.isArray(res.data) ? res.data : []
                const match = components.find((item) => item._id === ids[0])
                if (active && requestId === latestRequestId) {
                    setOverlayComponents(components)
                    setComponentType(match?.type ?? null)
                    setName(match?.name ?? '')

                    if (match && match.type !== 'image') {
                        const rawStyle = match.textStyle && typeof match.textStyle === 'object' ? match.textStyle : undefined
                        const resolvedStyle: TextStyleShape = { ...DEFAULT_TEXT_STYLE, ...(rawStyle ?? {}) }
                        setTextStyle(resolvedStyle)
                        setFontSize(typeof resolvedStyle.fontSize === 'number' ? String(resolvedStyle.fontSize) : '')
                        setLetterSpacing(typeof resolvedStyle.letterSpacing === 'number' ? String(resolvedStyle.letterSpacing) : '')
                        setFontFamily(normalizeFontFamily(resolvedStyle.fontFamily))
                        setHorizontalAlign(normalizeHorizontalAlign(resolvedStyle.align))
                        setVerticalAlign(normalizeVerticalAlign(resolvedStyle.verticalAlign))
                        setFontColor(normalizeHexColor(resolvedStyle.color, DEFAULT_FONT_COLOR))
                        setFontWeight(normalizeFontWeight(resolvedStyle.fontWeight))
                    } else {
                        setTextStyle(undefined)
                        setFontSize('')
                        setLetterSpacing('')
                        setFontFamily(DEFAULT_FONT_FAMILY)
                        setHorizontalAlign(DEFAULT_HORIZONTAL_ALIGN)
                        setVerticalAlign(DEFAULT_VERTICAL_ALIGN)
                        setFontColor(DEFAULT_FONT_COLOR)
                        setFontWeight(undefined)
                    }

                    setBackgroundColor(normalizeHexColor(match?.backgroundColor, DEFAULT_BACKGROUND_COLOR))
                    setBackgroundEnabled(typeof match?.backgroundColor === 'string' && match.backgroundColor.trim().toLowerCase() !== 'transparent')
                    setCustomText(match?.type === 'custom-text' || match?.type === 'task' ? (match?.customText ?? '') : '')
                    setTwentyFourHour(match?.twentyFourHour ?? true)
                    setUseUTC(match?.useUTC ?? false)
                    setNodeLevel(typeof (match as any)?.nodeLevel === 'number' ? (match as any).nodeLevel : 1)
                    setProjectDetail((match as any)?.projectDetail ?? 'name')
                    setDataKey((match as any)?.dataKey ?? null)
                    setImageOpacity(String((match as any)?.opacity ?? 1))
                }
            } catch {
                if (active && requestId === latestRequestId) resetState()
            }
        }

            ; (async () => {
                try {
                    const res = await window.ipcRenderer.invoke('app:getSelectedOverlayComponentIds')
                    const ids = res?.ok && Array.isArray(res.data) ? res.data : []
                    await syncFromIds(ids)
                } catch {
                    await syncFromIds([])
                }
            })()

        const onSelectedIdsChanged = (e: any) => {
            try {
                const ids = Array.isArray(e?.detail) ? e.detail : []
                void syncFromIds(ids)
            } catch {
                void syncFromIds([])
            }
        }

        window.addEventListener('selectedOverlayComponentIdsChanged', onSelectedIdsChanged as any)
        return () => {
            active = false
            window.removeEventListener('selectedOverlayComponentIdsChanged', onSelectedIdsChanged as any)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await window.ipcRenderer.invoke('db:fetchDataKeys')
                if (!cancelled && res?.ok && Array.isArray(res.data)) {
                    setAvailableDataKeys(res.data.map((k: any) => ({ _id: String(k._id), name: String(k.name) })))
                }
            } catch {}
        })()
        return () => { cancelled = true }
    }, [])

    const broadcastUpdate = useCallback((ids: string[]) => {
        if (!ids.length) return
        try {
            const ev = new CustomEvent('overlayComponentsChanged', { detail: { action: 'edited', ids } })
            window.dispatchEvent(ev)
        } catch { }
    }, [])

    const updateComponentName = useCallback(async (nextName: string, ids: string[]) => {
        try {
            const res = await window.ipcRenderer.invoke('db:editOverlayComponent', {
                ids,
                updates: { name: nextName }
            })
            if (res?.ok) {
                setOverlayComponents((prev) => prev.map((component) => (
                    ids.includes(component._id)
                        ? { ...component, name: nextName }
                        : component
                )))
                broadcastUpdate(ids)
                try {
                    const ev = new CustomEvent('overlay:refresh')
                    window.dispatchEvent(ev)
                } catch {}
            }
        } catch {
            // ignore errors during live editing
        }
    }, [broadcastUpdate])

    const updateComponentTextStyle = useCallback(async (style: TextStyleShape, ids: string[]) => {
        try {
            const res = await window.ipcRenderer.invoke('db:editOverlayComponent', {
                ids,
                updates: { textStyle: style }
            })
            if (res?.ok) {
                setOverlayComponents((prev) => prev.map((component) => (
                    ids.includes(component._id)
                        ? { ...component, textStyle: { ...(component.textStyle ?? {}), ...style } }
                        : component
                )))
                broadcastUpdate(ids)
                try {
                    const ev = new CustomEvent('overlay:refresh')
                    window.dispatchEvent(ev)
                } catch {}
            }
        } catch {
            // ignore errors during live editing
        }
    }, [broadcastUpdate])

    const updateComponentBackgroundColor = useCallback(async (color: string, ids: string[]) => {
        try {
            const res = await window.ipcRenderer.invoke('db:editOverlayComponent', {
                ids,
                updates: { backgroundColor: color }
            })
            if (res?.ok) {
                setOverlayComponents((prev) => prev.map((component) => (
                    ids.includes(component._id)
                        ? { ...component, backgroundColor: color }
                        : component
                )))
                broadcastUpdate(ids)
                try {
                    const ev = new CustomEvent('overlay:refresh')
                    window.dispatchEvent(ev)
                } catch {}
            }
        } catch {
            // ignore errors during live editing
        }
    }, [broadcastUpdate])

    const updateComponentCustomText = useCallback(async (value: string, ids: string[]) => {
        try {
            const res = await window.ipcRenderer.invoke('db:editOverlayComponent', {
                ids,
                updates: { customText: value }
            })
            if (res?.ok) {
                setOverlayComponents((prev) => prev.map((component) => (
                    ids.includes(component._id)
                        ? { ...component, customText: value }
                        : component
                )))
                broadcastUpdate(ids)
                try {
                    const ev = new CustomEvent('overlay:refresh')
                    window.dispatchEvent(ev)
                } catch {}
            }
        } catch {
            // ignore errors during live editing
        }
    }, [broadcastUpdate])

    const updateComponentImagePath = useCallback(async (imagePath: string, ids: string[]) => {
        try {
            const res = await window.ipcRenderer.invoke('db:editOverlayComponent', {
                ids,
                updates: { imagePath }
            })
            if (res?.ok) {
                setOverlayComponents((prev) => prev.map((component) => (
                    ids.includes(component._id)
                        ? { ...component, imagePath }
                        : component
                )))
                broadcastUpdate(ids)
                try {
                    const ev = new CustomEvent('overlay:refresh')
                    window.dispatchEvent(ev)
                } catch {}
            }
        } catch {}
    }, [broadcastUpdate])

    const updateComponentOpacity = useCallback(async (opacity: number, ids: string[]) => {
        try {
            const res = await window.ipcRenderer.invoke('db:editOverlayComponent', {
                ids,
                updates: { opacity }
            })
            if (res?.ok) {
                setOverlayComponents((prev) => prev.map((component) => (
                    ids.includes(component._id)
                        ? { ...component, opacity } as any
                        : component
                )))
                broadcastUpdate(ids)
                try {
                    const ev = new CustomEvent('overlay:refresh')
                    window.dispatchEvent(ev)
                } catch {}
            }
        } catch {}
    }, [broadcastUpdate])

    const updateComponentTimeSettings = useCallback(async (updates: Partial<{ twentyFourHour: boolean; useUTC: boolean }>, ids: string[]) => {
        try {
            const res = await window.ipcRenderer.invoke('db:editOverlayComponent', {
                ids,
                updates,
            })
            if (res?.ok) {
                setOverlayComponents((prev) => prev.map((component) => (
                    ids.includes(component._id)
                        ? { ...component, ...updates }
                        : component
                )))
                broadcastUpdate(ids)
                try {
                    const ev = new CustomEvent('overlay:refresh')
                    window.dispatchEvent(ev)
                } catch {}
            }
        } catch {
            // ignore errors during live editing
        }
    }, [broadcastUpdate])

    const updateComponentNodeLevel = useCallback(async (level: number, ids: string[]) => {
        try {
            const res = await window.ipcRenderer.invoke('db:editOverlayComponent', {
                ids,
                updates: { nodeLevel: level }
            })
            if (res?.ok) {
                setOverlayComponents((prev) => prev.map((component) => (
                    ids.includes(component._id)
                        ? { ...component, nodeLevel: level }
                        : component
                )))
                broadcastUpdate(ids)
                try {
                    const ev = new CustomEvent('overlay:refresh')
                    window.dispatchEvent(ev)
                } catch {}
            }
        } catch {
            // ignore errors during live editing
        }
    }, [broadcastUpdate])

    const applyTextStyleChange = useCallback(async (nextSelectedStyle: TextStyleShape) => {
        if (!canEditTextStyle) return
        setTextStyle(nextSelectedStyle)
        void updateComponentTextStyle(nextSelectedStyle, selectedIds)
    }, [canEditTextStyle, selectedIds, updateComponentTextStyle])

    const applyBackgroundColorChange = useCallback(async (color: string) => {
        if (!canEditTextStyle) return
        void updateComponentBackgroundColor(color, selectedIds)
    }, [broadcastUpdate, canEditTextStyle, componentType, overlayComponents, selectedIds, updateComponentBackgroundColor])

    const applyTimeSettingChange = useCallback(async (updates: Partial<{ twentyFourHour: boolean; useUTC: boolean }>) => {
        if (!canEdit || componentType !== 'time') return
        void updateComponentTimeSettings(updates, selectedIds)
    }, [broadcastUpdate, canEdit, componentType, selectedIds, updateComponentTimeSettings])

    const applyNodeLevelChange = useCallback(async (level: number) => {
        if (!canEdit || componentType !== 'node') return
        void updateComponentNodeLevel(level, selectedIds)
    }, [broadcastUpdate, canEdit, componentType, selectedIds, updateComponentNodeLevel])

    const handleCustomTextChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value
        setCustomText(nextValue)
        if (!canEdit || (componentType !== 'custom-text' && componentType !== 'task')) return
        void updateComponentCustomText(nextValue, selectedIds)
    }

    const applyProjectDetailChange = useCallback(async (value: 'name' | 'client' | 'vessel' | 'location' | 'contractor') => {
        if (!canEdit || componentType !== 'project') return
        try {
            const res = await window.ipcRenderer.invoke('db:editOverlayComponent', {
                ids: selectedIds,
                updates: { projectDetail: value }
            })
            if (res?.ok) {
                setOverlayComponents((prev) => prev.map((component) => (
                    selectedIds.includes(component._id)
                        ? { ...component, projectDetail: value }
                        : component
                )))
                broadcastUpdate(selectedIds)
                try {
                    const ev = new CustomEvent('overlay:refresh')
                    window.dispatchEvent(ev)
                } catch {}
            }
        } catch {}
    }, [broadcastUpdate, canEdit, componentType, selectedIds])

    const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextName = event.target.value
        setName(nextName)
        if (!canEdit) return
        void updateComponentName(nextName, selectedIds)
    }

    const handleFontSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value
        setFontSize(nextValue)
        if (!canEditTextStyle) return
        const parsed = Number(nextValue)
        if (!Number.isFinite(parsed) || parsed <= 0) return
        const stylePatch: TextStyleShape = { fontSize: parsed }
        const nextStyle = { ...(textStyle ?? DEFAULT_TEXT_STYLE), ...stylePatch }
        void applyTextStyleChange(nextStyle)
    }

    const handleLetterSpacingChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value
        setLetterSpacing(nextValue)
        if (!canEditTextStyle) return
        const trimmed = nextValue.trim()
        if (trimmed === '') return
        const parsed = Number(trimmed)
        if (!Number.isFinite(parsed)) return
        const stylePatch: TextStyleShape = { letterSpacing: parsed }
        const nextStyle = { ...(textStyle ?? DEFAULT_TEXT_STYLE), ...stylePatch }
        void applyTextStyleChange(nextStyle)
    }

    const handleHorizontalAlignChange = (value: HorizontalAlign) => {
        const normalized = normalizeHorizontalAlign(value)
        setHorizontalAlign(normalized)
        if (!canEditTextStyle) return
        const stylePatch: TextStyleShape = { align: normalized }
        const nextStyle = { ...(textStyle ?? DEFAULT_TEXT_STYLE), ...stylePatch }
        void applyTextStyleChange(nextStyle)
    }

    const handleVerticalAlignChange = (value: VerticalAlign) => {
        const normalized = normalizeVerticalAlign(value)
        setVerticalAlign(normalized)
        if (!canEditTextStyle) return
        const stylePatch: TextStyleShape = { verticalAlign: normalized }
        const nextStyle = { ...(textStyle ?? DEFAULT_TEXT_STYLE), ...stylePatch }
        void applyTextStyleChange(nextStyle)
    }

    const handleFontFamilyChange = (value: string) => {
        const normalized = normalizeFontFamily(value)
        setFontFamily(normalized)
        if (!canEditTextStyle) return
        const stylePatch: TextStyleShape = { fontFamily: normalized }
        const nextStyle = { ...(textStyle ?? DEFAULT_TEXT_STYLE), ...stylePatch }
        void applyTextStyleChange(nextStyle)
    }

    const handleFontColorChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = normalizeHexColor(event.target.value, DEFAULT_FONT_COLOR)
        setFontColor(nextValue)
        if (!canEditTextStyle) return
        if (!/^#[0-9A-Fa-f]{6}$/.test(nextValue)) return
        const stylePatch: TextStyleShape = { color: nextValue }
        const nextStyle = { ...(textStyle ?? DEFAULT_TEXT_STYLE), ...stylePatch }
        void applyTextStyleChange(nextStyle)
    }

    const handleBackgroundColorChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = normalizeHexColor(event.target.value, DEFAULT_BACKGROUND_COLOR)
        setBackgroundColor(nextValue)
        if (!canEditTextStyle) return
        if (!/^#[0-9A-Fa-f]{6}$/.test(nextValue)) return
        void applyBackgroundColorChange(nextValue)
    }

    const applyBackgroundEnabledChange = useCallback(async (enabled: boolean) => {
        if (!canEditTextStyle) return
        const colorToApply = enabled ? backgroundColor : 'transparent'
        await applyBackgroundColorChange(colorToApply)
    }, [applyBackgroundColorChange, backgroundColor, canEditTextStyle])

    const handleFontWeightChange = (value: string) => {
        setFontWeight(value)
        if (!canEditTextStyle) return
        const parsed = parseFontWeight(value)
        if (parsed === null) return
        const stylePatch: TextStyleShape = { fontWeight: parsed }
        const nextStyle = { ...(textStyle ?? DEFAULT_TEXT_STYLE), ...stylePatch }
        void applyTextStyleChange(nextStyle)
    }

    const handleTwentyFourHourChange = (value: '24' | '12') => {
        const nextValue = value === '24'
        setTwentyFourHour(nextValue)
        void applyTimeSettingChange({ twentyFourHour: nextValue })
    }

    const handleUseUTCChange = (checked: boolean) => {
        setUseUTC(checked)
        void applyTimeSettingChange({ useUTC: checked })
    }

    const handleNodeLevelChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = Number(event.target.value)
        if (!Number.isFinite(nextValue)) return
        const sanitized = Math.max(1, Math.floor(nextValue))
        setNodeLevel(sanitized)
        void applyNodeLevelChange(sanitized)
    }

    const handleUploadImageClick = () => {
        try { fileInputRef.current?.click() } catch {}
    }

    const handleImageFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
        try {
            const file = event.target.files && event.target.files[0]
            // reset value to allow re-selecting same file next time
            try { (event.target as HTMLInputElement).value = '' } catch {}
            if (!file) return
            const ext = (file.name.split('.').pop() || '').toLowerCase()
            if (!['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) return
            setImageUploading(true)
            const arrayBuffer = await file.arrayBuffer()
            const bytes = new Uint8Array(arrayBuffer)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
            const base64 = btoa(binary)
            const res = await window.ipcRenderer.invoke('fs:uploadOverlayImage', { bytesBase64: base64, filename: file.name })
            if (res?.ok && (res.data?.httpUrl || res.data?.fileUrl)) {
                const nextUrl = String(res.data?.httpUrl || res.data?.fileUrl)
                void updateComponentImagePath(nextUrl, selectedIds)
                try { await loadOverlayImages() } catch {}
            }
        } catch {
            // ignore
        } finally {
            setImageUploading(false)
        }
    }

    const loadOverlayImages = useCallback(async () => {
        try {
            setImagesLoading(true)
            const res = await window.ipcRenderer.invoke('fs:getAllOverlayImages')
            const items = res?.ok && Array.isArray(res.data) ? res.data : []
            setOverlayImages(items.map((i: any) => ({ fileUrl: String(i.httpUrl || i.fileUrl || ''), filename: String(i.filename || '') })))
        } catch {
            setOverlayImages([])
        } finally {
            setImagesLoading(false)
        }
    }, [])

    useEffect(() => {
        if (componentType === 'image') {
            void loadOverlayImages()
        }
    }, [componentType, loadOverlayImages])

    const selectedImagePath = (canEdit && selectedIds.length === 1)
        ? (overlayComponents.find((c) => c._id === selectedIds[0]) as any)?.imagePath
        : undefined

    const handleDeleteSelectedImage = useCallback(async () => {
        if (!canEdit || componentType !== 'image') return
        const current = selectedImagePath
        if (!current) return
        try {
            setImageDeleting(true)
            const entry = overlayImages.find((i) => i.fileUrl === current)
            const filename = entry?.filename || ''
            const res = await window.ipcRenderer.invoke('fs:deleteOverlayImage', filename ? { filename } : { fileUrl: current })
            if (res?.ok) {
                if (current === selectedImagePath) {
                    try { await updateComponentImagePath('', selectedIds) } catch {}
                }
                try { await loadOverlayImages() } catch {}
            }
        } catch {
        } finally {
            setImageDeleting(false)
        }
    }, [canEdit, componentType, loadOverlayImages, overlayImages, selectedIds, selectedImagePath, updateComponentImagePath])

    const handleApplyAllClick = useCallback(async () => {
        const targets = overlayComponents.filter((component) => component.type !== 'image')
        if (!targets.length) return
        const targetIds = targets.map((component) => component._id)

        const stylePatch: TextStyleShape = {}
        const parsedFontSize = Number(fontSize)
        if (Number.isFinite(parsedFontSize) && parsedFontSize > 0) stylePatch.fontSize = parsedFontSize
        const parsedWeight = fontWeight ? parseFontWeight(fontWeight) : null
        if (parsedWeight !== null && parsedWeight !== undefined) stylePatch.fontWeight = parsedWeight
        const parsedLetterSpacing = Number(letterSpacing)
        if (letterSpacing !== '' && Number.isFinite(parsedLetterSpacing)) stylePatch.letterSpacing = parsedLetterSpacing
        if (fontFamily) stylePatch.fontFamily = normalizeFontFamily(fontFamily)
        if (fontColor) stylePatch.color = normalizeHexColor(fontColor, DEFAULT_FONT_COLOR)
        stylePatch.align = normalizeHorizontalAlign(horizontalAlign)
        stylePatch.verticalAlign = normalizeVerticalAlign(verticalAlign)

        await Promise.all(targets.map(async (component) => {
            const baseStyle = { ...(component.textStyle ?? {}), ...stylePatch }
            try {
                await window.ipcRenderer.invoke('db:editOverlayComponent', {
                    ids: [component._id],
                    updates: { textStyle: baseStyle }
                })
            } catch {}
        }))
        setOverlayComponents((prev) => prev.map((component) => (
            targetIds.includes(component._id)
                ? { ...component, textStyle: { ...(component.textStyle ?? {}), ...stylePatch } }
                : component
        )))

        const colorToApply = backgroundEnabled ? backgroundColor : 'transparent'
        await updateComponentBackgroundColor(colorToApply, targetIds)
    }, [overlayComponents, fontSize, fontWeight, letterSpacing, fontFamily, fontColor, horizontalAlign, verticalAlign, backgroundEnabled, backgroundColor, updateComponentBackgroundColor])

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <span>Component Name</span>
                <Input
                    value={name}
                    onChange={handleNameChange}
                    disabled={!canEdit}
                    placeholder={canEdit ? undefined : 'Select a single component to edit'}
                />
            </div>
            <div className="flex flex-col gap-2">
                {componentType === 'custom-text' || componentType === 'task' ? (
                    <div className="flex flex-col gap-1">
                        <span>Text</span>
                        <Input
                            value={customText}
                            onChange={handleCustomTextChange}
                            disabled={!canEdit}
                            placeholder="Enter text"
                        />
                    </div>
                ) : null}

                {componentType === 'time' ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Time Format</span>
                            <Select
                                value={twentyFourHour ? '24' : '12'}
                                onValueChange={handleTwentyFourHourChange}
                                disabled={!canEdit}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select time format" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="24">24-hour format</SelectItem>
                                    <SelectItem value="12">12-hour format</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-400">
                            <Checkbox
                                checked={useUTC}
                                onCheckedChange={(checked) => handleUseUTCChange(checked === true)}
                                disabled={!canEdit}
                            />
                            <span>Use UTC time</span>
                        </label>
                    </div>
                ) : null}

                {componentType === 'image' ? (
                    <div className="flex flex-col gap-2">
                        <span className="text-slate-400">Image Selection</span>
                        <div>
                            {imagesLoading ? (
                                <div className="text-white/60 text-sm">Loading images…</div>
                            ) : overlayImages.length === 0 ? (
                                <div className="text-white/60 text-sm">No images uploaded yet.</div>
                            ) : (
                                <div className="grid grid-cols-6 gap-2">
                                    {overlayImages.map((img, idx) => (
                                        <button
                                            key={`${img.filename}-${idx}`}
                                            type="button"
                                            className={`w-full aspect-square bg-[#252B34] border border-4 ${selectedImagePath === img.fileUrl ? 'border-blue-700' : 'border-[#4C525E]'} rounded overflow-hidden hover:border-[#71BCFC] focus:outline-none disabled:opacity-50`}
                                            onClick={() => { if (!canEdit) return; void updateComponentImagePath(img.fileUrl, selectedIds) }}
                                            disabled={!canEdit}
                                            title={img.filename}
                                        >
                                            <img src={img.fileUrl} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button onClick={handleUploadImageClick} disabled={!canEdit || imageUploading}>{imageUploading ? 'Uploading…' : 'Upload Image'}</Button>
                            <Button onClick={handleDeleteSelectedImage} disabled={!canEdit || imageDeleting || !selectedImagePath}>{imageDeleting ? 'Deleting…' : 'Delete Image'}</Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/bmp"
                                className="hidden"
                                onChange={handleImageFileSelected}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Opacity</span>
                            <Input
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                value={imageOpacity}
                                onChange={(e) => {
                                    const v = e.target.value
                                    setImageOpacity(v)
                                    const num = Number(v)
                                    if (!canEdit || !Number.isFinite(num)) return
                                    const clamped = Math.max(0, Math.min(1, num))
                                    void updateComponentOpacity(clamped, selectedIds)
                                }}
                                disabled={!canEdit}
                            />
                        </div>
                    </div>
                ) : null}

                {componentType === 'data' ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Data Type</span>
                            <Select
                                value={dataKey ?? 'undefined'}
                                onValueChange={async (v) => {
                                    const next = v === 'undefined' ? null : v
                                    setDataKey(next)
                                    try {
                                        const res = await window.ipcRenderer.invoke('db:editOverlayComponent', { ids: selectedIds, updates: { dataKey: next } })
                                        if (res?.ok) {
                                            setOverlayComponents((prev) => prev.map((component) => (
                                                selectedIds.includes(component._id)
                                                    ? { ...component, dataKey: next ?? null }
                                                    : component
                                            )))
                                            broadcastUpdate(selectedIds)
                                            try { const ev = new CustomEvent('overlay:refresh'); window.dispatchEvent(ev) } catch {}
                                        }
                                    } catch {}
                                }}
                                disabled={!canEdit}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select data key" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="undefined">undefined</SelectItem>
                                    {availableDataKeys.map(k => (
                                        <SelectItem key={k._id} value={k.name}>{k.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ) : null}

                {componentType === 'project' ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Project Details</span>
                            <Select
                                value={projectDetail}
                                onValueChange={(v) => { const val = (v as any) as 'name' | 'client' | 'vessel' | 'location' | 'contractor'; setProjectDetail(val); void applyProjectDetailChange(val) }}
                                disabled={!canEdit}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select detail" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name">Project Name</SelectItem>
                                    <SelectItem value="client">Client</SelectItem>
                                    <SelectItem value="vessel">Vessel</SelectItem>
                                    <SelectItem value="location">Location</SelectItem>
                                    <SelectItem value="contractor">Contractor</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ) : null}

                {componentType === 'node' ? (
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Node Level</span>
                        <Input
                            type="number"
                            min={1}
                            step={1}
                            value={String(nodeLevel)}
                            onChange={handleNodeLevelChange}
                            disabled={!canEdit}
                            placeholder="Enter node level"
                        />
                    </div>
                ) : null}

                {componentType !== 'image' ? (
                    <>
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Font Size</span>
                            <Input
                                type="number"
                                min={1}
                                step={1}
                                value={fontSize}
                                onChange={handleFontSizeChange}
                                disabled={!canEditTextStyle}
                                placeholder={canEditTextStyle ? undefined : 'Font size available for text components only'}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Font Weight</span>
                            <Select
                                value={fontWeight}
                                onValueChange={handleFontWeightChange}
                                disabled={!canEditTextStyle}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select font weight" />
                                </SelectTrigger>
                                <SelectContent>
                                    {FONT_WEIGHT_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Font Family</span>
                            <Select
                                value={fontFamily}
                                onValueChange={handleFontFamilyChange}
                                disabled={!canEditTextStyle}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select font family" />
                                </SelectTrigger>
                                <SelectContent>
                                    {FONT_FAMILY_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Horizontal Align</span>
                            <Select
                                value={horizontalAlign}
                                onValueChange={handleHorizontalAlignChange}
                                disabled={!canEditTextStyle}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select horizontal align" />
                                </SelectTrigger>
                                <SelectContent>
                                    {H_ALIGN_OPTIONS.map((option) => (
                                        <SelectItem key={`h-${option.value}`} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Vertical Align</span>
                            <Select
                                value={verticalAlign}
                                onValueChange={handleVerticalAlignChange}
                                disabled={!canEditTextStyle}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select vertical align" />
                                </SelectTrigger>
                                <SelectContent>
                                    {V_ALIGN_OPTIONS.map((option) => (
                                        <SelectItem key={`v-${option.value}`} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Letter Spacing</span>
                            <Input
                                type="number"
                                step={0.1}
                                value={letterSpacing}
                                onChange={handleLetterSpacingChange}
                                disabled={!canEditTextStyle}
                                placeholder={canEditTextStyle ? undefined : 'Letter spacing available for text components only'}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-400">Font Color</span>
                            <input
                                type="color"
                                value={fontColor}
                                onChange={handleFontColorChange}
                                disabled={!canEditTextStyle}
                                className="h-9 w-full rounded border border-[#4C525E] bg-[#252B34] p-1 disabled:opacity-50"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="flex gap-1 items-center text-slate-400">
                                <Checkbox
                                    checked={backgroundEnabled}
                                    onCheckedChange={(checked) => {
                                        const enabled = checked === true
                                        setBackgroundEnabled(enabled)
                                        void applyBackgroundEnabledChange(enabled)
                                    }}
                                    disabled={!canEditTextStyle}
                                />
                                <span>Background Color</span>
                            </label>
                            <input
                                type="color"
                                value={backgroundColor}
                                onChange={handleBackgroundColorChange}
                                disabled={!canEditTextStyle || !backgroundEnabled}
                                className="h-9 w-full rounded border border-[#4C525E] bg-[#252B34] p-1 disabled:opacity-50"
                            />
                        </div>
                    </>
                ) : null}
                
            </div>
            <div className="mt-2 flex justify-end gap-2">
                {componentType !== 'image' ? (
                    <Button onClick={handleApplyAllClick}>Apply to All Components</Button>
                ) : null}
                <Button onClick={() => onClose?.()}>Close</Button>
            </div>
        </div>
    )
}

