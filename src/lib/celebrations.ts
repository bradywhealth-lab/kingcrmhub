// Confetti celebration utility for Elite CRM
import confetti from 'canvas-confetti'

export function triggerWinCelebration() {
  const count = 200
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  }

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    })
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: ['#D4AF37', '#F4D03F', '#0A0A0A'],
  })
  fire(0.2, {
    spread: 60,
    colors: ['#D4AF37', '#FFFFFF'],
  })
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    colors: ['#D4AF37', '#F4D03F'],
  })
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    colors: ['#D4AF37'],
  })
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    colors: ['#0A0A0A', '#D4AF37'],
  })
}

export function triggerSmallCelebration() {
  confetti({
    particleCount: 50,
    spread: 60,
    colors: ['#D4AF37', '#F4D03F'],
    origin: { y: 0.8 },
    zIndex: 9999,
  })
}

export function triggerSparkles(x: number, y: number) {
  confetti({
    particleCount: 20,
    spread: 30,
    colors: ['#D4AF37', '#F4D03F'],
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
    zIndex: 9999,
  })
}

// Success sound (subtle chime)
export function playSuccessSound() {
  const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)() : null
  if (!audioContext) return
  
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  oscillator.frequency.value = 800
  oscillator.type = 'sine'
  
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
  
  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.3)
}

// Click feedback
export function triggerClickFeedback() {
  confetti({
    particleCount: 5,
    spread: 20,
    colors: ['#D4AF37'],
    origin: { y: 0.9 },
    zIndex: 9999,
    scalar: 0.5,
    ticks: 20,
  })
}
