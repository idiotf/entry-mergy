'use client'

import { ThemeProvider } from '@/components/theme-provider'

export function Providers({ children }: React.PropsWithChildren) {
  return (
    <ThemeProvider
      attribute='class'
      defaultTheme='system'
      enableSystem
      enableHotkey
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}
