import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function SwipeBack() {
  const navigate = useNavigate()
  const location = useLocation()
  const stateRef = useRef({
    startX: null,
    startY: null,
    startTime: null,
    tracking: false,
  })

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return

    function onTouchStart(e) {
      const touch = e.touches[0]
      // Só dispara se começou nos primeiros 30px da borda esquerda
      if (touch.clientX > 30) return
      // Não anima se está na raiz
      if (location.pathname === '/') return

      stateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        tracking: true,
      }
    }

    function onTouchMove(e) {
      const s = stateRef.current
      if (!s.tracking) return

      const touch = e.touches[0]
      const deltaX = Math.max(0, touch.clientX - s.startX)
      const deltaY = Math.abs(touch.clientY - s.startY)

      // Se moveu muito pra baixo/cima, cancela (é scroll, não swipe)
      if (deltaY > 50) {
        s.tracking = false
        root.style.transition = 'transform 200ms ease-out'
        root.style.transform = ''
        return
      }

      // Aplica a translação seguindo o dedo
      root.style.transition = 'none'
      root.style.transform = `translateX(${deltaX}px)`
    }

    function onTouchEnd(e) {
      const s = stateRef.current
      if (!s.tracking) return
      s.tracking = false

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - s.startX
      const deltaTime = Date.now() - s.startTime
      const screenWidth = window.innerWidth

      // Critério pra "voltar":
      // - deslocou mais de 40% da tela, OU
      // - movimento rápido (>80px em <400ms — flick)
      const passedThreshold = deltaX > screenWidth * 0.4
      const wasFlick = deltaX > 80 && deltaTime < 400

      if (passedThreshold || wasFlick) {
        // Anima até sair da tela e navega
        root.style.transition = 'transform 250ms ease-out'
        root.style.transform = `translateX(${screenWidth}px)`
        setTimeout(() => {
          root.style.transition = 'none'
          root.style.transform = ''
          navigate(-1)
        }, 250)
      } else {
        // Cancela e volta pra posição original
        root.style.transition = 'transform 200ms ease-out'
        root.style.transform = ''
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      root.style.transition = ''
      root.style.transform = ''
    }
  }, [navigate, location])

  return null
}
