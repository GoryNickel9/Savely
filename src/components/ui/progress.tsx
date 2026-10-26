import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, max = 100, ...props }, ref) => {
  const maximum = Number.isFinite(max) && max > 0 ? max : 100;
  const progress = typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), maximum)
    : 0;

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={progress}
      max={maximum}
      className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(${(progress / maximum - 1) * 100}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
