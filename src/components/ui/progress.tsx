"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

type StrengthTier = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite';

const tierGradients: Record<StrengthTier, string> = {
  beginner: 'linear-gradient(to right, #22c55e, #4ade80)',       // Green
  novice: 'linear-gradient(to right, #0ea5e9, #38bdf8)',         // Sky blue
  intermediate: 'linear-gradient(to right, #10b981, #34d399)',   // Emerald/green
  advanced: 'linear-gradient(to right, #a855f7, #c084fc)',       // Purple
  elite: 'linear-gradient(to right, #f59e0b, #fbbf24)',          // Amber/gold
};

function Progress({
  className,
  value,
  variant = "default",
  tier,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  variant?: "default" | "milestone"
  tier?: StrengthTier
}) {
  const getGradientStyle = (): React.CSSProperties => {
    if (variant === "milestone") {
      return { background: 'linear-gradient(to right, #f97316, #fbbf24)' };
    }
    if (tier && tierGradients[tier]) {
      return { background: tierGradients[tier] };
    }
    return { background: 'linear-gradient(to right, #0ea5e9, #38bdf8, #fb923c)' };
  };

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-slate-800 relative h-2.5 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 transition-all duration-500 ease-out rounded-full"
        style={{ 
          transform: `translateX(-${100 - (value || 0)}%)`,
          ...getGradientStyle()
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
