import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Align styling with Input component
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-black flex w-full min-w-0 rounded-none border bg-[#252B34] px-2 py-1 text-base outline-none disabled:pointer-events-none disabled:opacity-50 md:text-sm",
        // Focus styles (match Input)
        "focus-visible:border-black focus-visible:ring-blue-300 focus-visible:ring-[1px]",
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
