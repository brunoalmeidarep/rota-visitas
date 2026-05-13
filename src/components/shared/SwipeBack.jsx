import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function SwipeBack() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let startX = null
    let startY = null
    let startTime = null

    function onTouchStart(e) {
      const touch = e.touches[0]
      // Só dispara se o toque começou perto da borda esquerda (primeiros 30px)
      if (touch.clientX > 30) return
      startX = touch.clientX
      startY = touch.clientY
      startTime = Date.now()
    }

    function onTouchEnd(e) {
      if (startX === null) return

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - startX
      const deltaY = Math.abs(touch.clientY - startY)
      const deltaTime = Date.now() - startTime

      // Swipe da esquerda pra direita: pelo menos 80px horizontal, máximo 80px vertical, em menos de 600ms
      if (deltaX > 80 && deltaY < 80 && deltaTime < 600) {
        // Não volta se estiver na raiz
        if (location.pathname !== '/') {
          navigate(-1)
        }
      }

      startX = null
      startY = null
      startTime = null
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [navigate, location])

  return null
}
