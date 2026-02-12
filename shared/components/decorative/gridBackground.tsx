'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface GridBackgroundProps {
  className?: string
  squares?: number
  intensity?: number
}

export function GridBackground({ className, squares = 40, intensity = 20 }: GridBackgroundProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      setMousePosition({ x, y })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const transform = {
    x: mousePosition.x * intensity,
    y: mousePosition.y * intensity,
  }

  return (
    <div className={cn('fixed inset-0 -z-50', 'overflow-hidden', 'bg-background', className)}>
      <div
        className="absolute -top-12.5 -left-12.5 h-[calc(100%+100px)] w-[calc(100%+100px)]"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px)`,
          transition: 'transform 0.3s ease-out',
          backgroundImage: `
                        linear-gradient(to right, var(--border) 1px, transparent 1px),
                        linear-gradient(to bottom, var(--border) 1px, transparent 1px)
                    `,
          backgroundSize: `${squares}px ${squares}px`,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
                        linear-gradient(to top, var(--background) 0%, transparent 20%),
                        linear-gradient(to bottom, var(--background) 0%, transparent 20%),
                        linear-gradient(to left, var(--background) 0%, transparent 10%),
                        linear-gradient(to right, var(--background) 0%, transparent 10%)
                    `,
        }}
      />
    </div>
  )
}
