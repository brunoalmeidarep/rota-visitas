import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Aguarda 2 frames pra garantir que o conteúdo da nova rota já renderizou
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0

        const root = document.getElementById('root')
        if (root) root.scrollTop = 0

        // Também tenta scrollar containers comuns que possam ter overflow
        const scrollables = document.querySelectorAll('[class*="content"], [class*="main"], main')
        scrollables.forEach(el => {
          el.scrollTop = 0
        })
      })
    })
  }, [pathname])

  return null
}
