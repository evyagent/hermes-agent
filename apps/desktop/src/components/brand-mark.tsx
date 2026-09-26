import { cn } from '@/lib/utils'

// EVY fork: the V mark (same path as the EVY panel/landing logo), no tile:
// it follows the foreground colour. Size via className (default size-14).
const MARK_VIEWBOX = '259 202 110 116'
const MARK_PATH =
  'M364.44,212.44c0-5.86-6.16-8.61-9.32-3.79l-29.2,47.41c-2.73,4.45-7.31,6.68-11.91,6.7h0c-4.59-.02-9.18-2.25-11.91-6.7l-29.2-47.41c-3.15-4.83-9.32-2.07-9.32,3.79,0,0-.21,24.71,0,33.17.22,8.91,3.64,24.85,18.43,36.96,10.4,8.52,15.8,15.6,18.82,20.39,1.21,1.92,2.25,4.09,3.71,6.07,2.25,3.03,5.98,4.21,9.46,4.36h0c3.48-.15,7.21-1.33,9.46-4.36,1.47-1.98,2.5-4.15,3.71-6.07,3.02-4.79,8.42-11.87,18.82-20.39,14.8-12.11,18.22-28.05,18.43-36.96.21-8.46,0-33.17,0-33.17Z'

export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex size-14 shrink-0 items-center justify-center overflow-hidden text-foreground',
        className
      )}
      {...props}
    >
      <svg aria-hidden="true" className="size-[78%]" fill="currentColor" focusable="false" viewBox={MARK_VIEWBOX}>
        <path d={MARK_PATH} />
      </svg>
    </span>
  )
}
