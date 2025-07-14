'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
} from 'next-themes'
import type { ThemeProviderProps } from 'next-themes/dist/types'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      {children}
    </NextThemesProvider>
  );
}

// Agregar un manejo básico de errores para depuración
if (process.env.NODE_ENV !== 'production') {
  ThemeProvider.displayName = 'ThemeProvider';
}