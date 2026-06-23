export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text font-extrabold lowercase tracking-tight text-transparent ${className}`}
    >
      abpic
    </span>
  )
}
