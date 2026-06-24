import Link from 'next/link'

export function Wordmark({ className = '', href }: { className?: string; href?: string }) {
  const cls = `inline-block bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text font-extrabold lowercase tracking-tight text-transparent ${className}`
  if (href) {
    return (
      <Link href={href} className={cls}>
        abpic
      </Link>
    )
  }
  return <span className={cls}>abpic</span>
}
