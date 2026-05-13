import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Tenta scroll em múltiplos lugares pra garantir
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    // Caso o scroll esteja em um container interno (#root)
    const root = document.getElementById('root')
    if (root) root.scrollTop = 0
  }, [pathname])

  return null
}
