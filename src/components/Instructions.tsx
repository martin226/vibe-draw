import { useEffect, useState } from 'react'

export function Instructions() {
  const [isMobile, setIsMobile] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0)

    const timer = setTimeout(() => {
      setIsVisible(false)
    }, 10000)

    return () => clearTimeout(timer)
  }, [])

  if (!isVisible) return null

  return (
    <div className="instructions">
      <h3>Controls:</h3>
      {isMobile ? (
        <p>Use the joystick in the bottom-left corner to move.<br />
           Swipe on the screen to look around.</p>
      ) : (
        <p>Use WASD keys to move.<br />
           Click and drag to look around.<br />
           Click to enable mouse control.</p>
      )}
    </div>
  )
} 