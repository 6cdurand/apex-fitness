import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/20 hover:shadow-sky-400/30",
        destructive:
          "bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-2 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:border-slate-600",
        secondary:
          "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700",
        ghost:
          "text-slate-300 hover:bg-slate-800/50 hover:text-white",
        link: "text-sky-400 underline-offset-4 hover:underline hover:text-sky-300",
        progress: "bg-gradient-to-r from-sky-500 to-sky-400 text-white shadow-lg shadow-sky-500/30 hover:shadow-sky-400/40",
        milestone: "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-400/40",
      },
      size: {
        default: "h-10 px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-8 rounded-[8px] gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-12 rounded-[12px] px-8 has-[>svg]:px-6 text-base",
        icon: "size-10 rounded-[10px]",
        "icon-sm": "size-8 rounded-[8px]",
        "icon-lg": "size-12 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
