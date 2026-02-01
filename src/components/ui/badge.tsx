import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-sky-500/20 text-sky-400 [a&]:hover:bg-sky-500/30",
        secondary:
          "border-slate-700 bg-slate-800 text-slate-300 [a&]:hover:bg-slate-700",
        destructive:
          "border-transparent bg-red-500/20 text-red-400 [a&]:hover:bg-red-500/30 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-slate-700 text-slate-300 [a&]:hover:bg-slate-800 [a&]:hover:text-white",
        success:
          "border-transparent bg-emerald-500/20 text-emerald-400 [a&]:hover:bg-emerald-500/30",
        warning:
          "border-transparent bg-amber-500/20 text-amber-400 [a&]:hover:bg-amber-500/30",
        milestone:
          "border-transparent bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-400 [a&]:hover:from-orange-500/30 [a&]:hover:to-amber-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
