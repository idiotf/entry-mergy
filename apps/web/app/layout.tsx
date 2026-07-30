import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import { Providers } from './providers'
import { cn } from '@/lib/utils'
import './globals.css'

const notoSansKR = Noto_Sans_KR({
  subsets: [],
})

const bodyClass = cn(
  notoSansKR.className,
  'bg-background text-foreground antialiased'
)

export const metadata: Metadata = {
  title: 'Entry Mergy',
  description: '엔트리 작품 / 타이포그래피 작품 병합기',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang='ko' suppressHydrationWarning>
      <body className={bodyClass}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
