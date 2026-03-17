import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-gray-400 selection:bg-sky-500/30 selection:text-gray-900",
        "bg-white border-gray-200 text-gray-900",
        "h-11 w-full min-w-0 rounded-[10px] border px-4 py-2.5 text-base shadow-sm",
        "transition-all duration-200 outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20",
        "hover:border-gray-300",
        "aria-invalid:ring-red-500/20 aria-invalid:border-red-500/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
