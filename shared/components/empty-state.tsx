import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border bg-card/50 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center',
        className
      )}
    >
      {Icon && <Icon className="text-muted-foreground size-8" />}
      <div className="space-y-1">
        <p className="text-foreground font-medium">{title}</p>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action}
    </div>
  )
}
