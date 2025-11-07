import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("className={cn("animate-pulse rounded-md bg-muted", className)}", className)}
      {...props}
    />
  )
}

export { Skeleton }
