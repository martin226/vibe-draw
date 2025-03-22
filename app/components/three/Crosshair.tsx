import React, { useEffect, useState } from 'react';

export function Crosshair() {
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  
  useEffect(() => {
    const checkPointerLock = () => {
      setIsPointerLocked(!!document.pointerLockElement);
    };
    
    // Initial check
    checkPointerLock();
    
    // Add event listener for pointer lock changes
    document.addEventListener('pointerlockchange', checkPointerLock);
    
    return () => {
      document.removeEventListener('pointerlockchange', checkPointerLock);
    };
  }, []);
  
  // Styling to position the crosshair at the center of the screen
  const crosshairStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none', // Make it unselectable/non-interactive
    zIndex: 1000,
    mixBlendMode: 'difference', // Makes it visible on both light and dark backgrounds
    userSelect: 'none',
    opacity: isPointerLocked ? 1 : 0.5,
    transition: 'opacity 0.2s ease-in-out',
  };

  return (
    <div style={crosshairStyle}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Horizontal line */}
        <line x1="0" y1="16" x2="13" y2="16" stroke="white" strokeWidth="2" />
        <line x1="19" y1="16" x2="32" y2="16" stroke="white" strokeWidth="2" />
        
        {/* Vertical line */}
        <line x1="16" y1="0" x2="16" y2="13" stroke="white" strokeWidth="2" />
        <line x1="16" y1="19" x2="16" y2="32" stroke="white" strokeWidth="2" />
        
        {/* Center circle */}
        <circle cx="16" cy="16" r="4" stroke="white" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
} 