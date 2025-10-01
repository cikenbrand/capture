import { useCallback, useEffect, useRef, useState } from "react";
import { Listbox } from "../ui/listbox";
import { DraggableDialog } from "../ui/draggable-dialog";
import VideoDeviceConfigurations from "./VideoDeviceConfigurations";
import { MdSettings } from "react-icons/md";

const CHANNEL_ITEMS = [
  { value: "channel-1", label: "Channel 1" },
  { value: "channel-2", label: "Channel 2" },
  { value: "channel-3", label: "Channel 3" },
  { value: "channel-4", label: "Channel 4" },
  { value: "pip view", label: "Picture in Picture" },
  { value: "1 + 1 view", label: "Dual View" },
  { value: "2 + 1 view", label: "Triple View" },
  { value: "2 + 2 view", label: "Quad View" },
] as const;

const SINGLE_VIEW_ITEMS = CHANNEL_ITEMS.filter(i => /^channel-\d$/.test(i.value));
const MULTI_VIEW_ITEMS = CHANNEL_ITEMS.filter(i => !/^channel-\d$/.test(i.value));

type ChannelValue = (typeof CHANNEL_ITEMS)[number]["value"];

const CHANNEL_SCENE_CANDIDATES: Record<ChannelValue, string[]> = {
  "channel-1": ["Channel 1", "single_channel-1"],
  "channel-2": ["Channel 2", "single_channel-2"],
  "channel-3": ["Channel 3", "single_channel-3"],
  "channel-4": ["Channel 4", "single_channel-4"],
  "pip view": ["pip view", "Picture in Picture", "PIP"],
  "1 + 1 view": ["1 + 1 view", "Dual View"],
  "2 + 1 view": ["2 + 1 view", "Triple View"],
  "2 + 2 view": ["2 + 2 view", "Quad View"],
};

function matchSceneToValue(sceneName: string | null | undefined): ChannelValue | null {
  if (!sceneName) return null;
  const text = sceneName.trim().toLowerCase();
  if (!text) return null;

  const channelMatch = text.match(/single[_\s-]*channel[-\s]*(\d+)/i) || text.match(/channel[-\s]*(\d+)/i);
  if (channelMatch) {
    const channel = Math.max(1, Math.min(4, Number(channelMatch[1]) || 0));
    return (`channel-${channel}` as ChannelValue);
  }

  if (text === "pip view" || text === "picture in picture" || text === "picture-in-picture") {
    return "pip view";
  }

  const normalized = text.replace(/\s+/g, "");
  if (normalized === "1+1view" || text === "dual view") {
    return "1 + 1 view";
  }
  if (normalized === "2+1view" || text === "triple view") {
    return "2 + 1 view";
  }
  if (normalized === "2+2view" || text === "quad view") {
    return "2 + 2 view";
  }

  const directMatch = CHANNEL_ITEMS.find(
    item => item.value.toLowerCase() === text || (typeof item.label === "string" && item.label.toLowerCase() === text)
  );
  if (directMatch) return directMatch.value;

  for (const [value, names] of Object.entries(CHANNEL_SCENE_CANDIDATES) as Array<[ChannelValue, string[]]>) {
    if (names.some(name => name.toLowerCase() === text)) {
      return value;
    }
  }

  return null;
}

function valueToSceneNames(value: ChannelValue): string[] {
  const base = CHANNEL_SCENE_CANDIDATES[value] ?? [];
  const extra: string[] = [];

  const channelMatch = /^channel-(\d)$/.exec(value);
  if (channelMatch) {
    const n = Number(channelMatch[1]);
    extra.push(
      `Channel ${n}`,
      `channel ${n}`,
      `CHANNEL ${n}`,
      `single_channel-${n}`,
      `single-channel-${n}`,
      `single channel ${n}`,
      `Single Channel ${n}`
    );
  } else if (value === 'pip view') {
    extra.push('Picture in Picture', 'picture in picture', 'PIP', 'PiP', 'Picture-In-Picture');
  } else if (value === '1 + 1 view') {
    extra.push('1 + 1 view', '1+1 view', '1 + 1', '1+1', 'Dual View', 'dual view');
  } else if (value === '2 + 1 view') {
    extra.push('2 + 1 view', '2+1 view', '2 + 1', '2+1', 'Triple View', 'triple view');
  } else if (value === '2 + 2 view') {
    extra.push('2 + 2 view', '2+2 view', '2 + 2', '2+2', 'Quad View', 'quad view');
  }

  const dedup = new Set<string>();
  for (const name of [...base, ...extra]) {
    const trimmed = String(name ?? '').trim();
    if (trimmed && !dedup.has(trimmed)) dedup.add(trimmed);
  }
  return Array.from(dedup);
}

function dispatchChannelChange(value: ChannelValue | null) {
  const match = value?.match(/^channel-(\d)$/);
  if (!match) return;
  const channel = Number(match[1]);
  if (!Number.isFinite(channel)) return;
  try {
    window.dispatchEvent(new CustomEvent("app:set-draw-channel", { detail: { channel } }));
  } catch { }
}

export default function ChannelViewList() {
  const [selectedValue, setSelectedValue] = useState<ChannelValue | null>(null);
  const [isVideoConfigOpen, setIsVideoConfigOpen] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applySelection = useCallback((value: ChannelValue | null) => {
    setSelectedValue(value);
    dispatchChannelChange(value);
  }, []);

  useEffect(() => {
    const obsApi = window.obs;
    if (!obsApi) {
      applySelection(null);
      return;
    }

    let disposed = false;

    async function syncFromCurrentScene() {
      try {
        const name = await obsApi.getCurrentScene();
        if (!isMountedRef.current || disposed) return;
        applySelection(matchSceneToValue(name));
      } catch {
        if (!isMountedRef.current || disposed) return;
        applySelection(null);
      }
    }

    syncFromCurrentScene();

    if (typeof obsApi.onCurrentSceneChanged !== "function") {
      return () => {
        disposed = true;
      };
    }

    const off = obsApi.onCurrentSceneChanged(sceneName => {
      if (!isMountedRef.current || disposed) return;
      applySelection(matchSceneToValue(sceneName));
    });

    return () => {
      disposed = true;
      try {
        off && off();
      } catch { }
    };
  }, [applySelection]);

  const handleChange = useCallback(
    (value: string) => {
      const nextValue = value as ChannelValue;
      applySelection(nextValue);

      const obsApi = window.obs;
      if (!obsApi) return;

      const candidates = valueToSceneNames(nextValue);
      if (!candidates.length) return;

      void (async () => {
        for (const sceneName of candidates) {
          if (!sceneName) continue;
          try {
            const setFn = (obsApi as any).setSelectedScene ?? obsApi.setCurrentScene;
            const ok = await setFn(sceneName);
            if (ok) return;
          } catch { }
        }

        try {
          const current = await obsApi.getCurrentScene();
          if (!isMountedRef.current) return;
          applySelection(matchSceneToValue(current));
        } catch { }
      })();
    },
    [applySelection]
  );

  return (
    <div className="flex flex-col gap-2">
      <button title="Edit Node" className="flex items-center justify-center gap-2 border border-white/10 h-[35px] bg-black/10 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none" onClick={() => setIsVideoConfigOpen(true)}>
        <MdSettings className="h-4.5 w-4.5" />
        <span>Video Configurations</span>
      </button>
      <DraggableDialog open={isVideoConfigOpen} onOpenChange={setIsVideoConfigOpen} title="Video Configurations">
        <VideoDeviceConfigurations />
      </DraggableDialog>
      <div className="flex flex-col gap-1">
        <span className="text-white font-semibold">Single View</span>
        <Listbox items={SINGLE_VIEW_ITEMS} selectedValue={selectedValue ?? undefined} onChange={handleChange} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-white font-semibold">Multi View</span>
        <Listbox items={MULTI_VIEW_ITEMS} selectedValue={selectedValue ?? undefined} onChange={handleChange} />
      </div>
    </div>
  );
}
