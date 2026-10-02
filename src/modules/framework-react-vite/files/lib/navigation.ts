import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'

export interface Router {
  push(href: string): void
  replace(href: string): void
}

/** next/navigation's useRouter on React Router, so the pages are the same in both frameworks. */
export function useRouter(): Router {
  const navigate = useNavigate()
  return useMemo(
    () => ({
      push: (href) => {
        void navigate(href)
      },
      replace: (href) => {
        void navigate(href, { replace: true })
      }
    }),
    [navigate]
  )
}

/** next/navigation's usePathname on React Router. */
export function usePathname(): string {
  return useLocation().pathname
}
