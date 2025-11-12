import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Base styles (match Input)
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full min-w-0 border border-white/10 bg-[#1E2129] px-2 py-1 text-[13px] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-slate-400",
        // Focus styles (match Input)
        "focus-visible:border-slate-700 focus-visible:ring-slate-700 focus-visible:ring-[1px]",
        // Error styles (match Input)
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        // Textarea-specific: ensure reasonable height
        "min-h-16",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
