'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Suppress all error popups and just console log them
    console.log('🔍 Error boundary caught error (suppressed popup):', error.message);

    // Don't show any error UI, just log it
    return;
  }, [error])

  // Don't render any error UI, just return null
  return null;
} 