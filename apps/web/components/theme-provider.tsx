'use client'

import { useEffect } from 'react'
import {
  useTheme,
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps as NextThemeProviderProps,
} from 'next-themes'

export interface ThemeProviderProps extends NextThemeProviderProps {
  enableHotkey?: boolean
}

export function ThemeProvider({
  children,
  enableHotkey,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute='class'
      defaultTheme='system'
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {enableHotkey && <ThemeHotkey />}
      {children}
    </NextThemesProvider>
  )
}

const typingTargets = ['INPUT', 'TEXTAREA', 'SELECT']

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return target.isContentEditable || typingTargets.includes(target.tagName)
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.toLowerCase() != 'd') return
      if (isTypingTarget(event.target)) return

      setTheme(
        event.shiftKey ? 'system' : resolvedTheme == 'dark' ? 'light' : 'dark'
      )
    }

    addEventListener('keydown', onKeyDown)

    return () => {
      removeEventListener('keydown', onKeyDown)
    }
  }, [resolvedTheme, setTheme])

  return null
}
