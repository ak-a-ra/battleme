import { useCallback, useRef } from 'react'

export type SoundType = 'attack' | 'damage' | 'crit' | 'ko' | 'victory'

/// Web Audio API synthesized battle sounds — zero file dependencies.
/// Works in OBS browser source (CEF).
export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()
    }
    return ctxRef.current
  }, [])

  const play = useCallback((type: SoundType) => {
    const ctx = getCtx()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    const now = ctx.currentTime

    switch (type) {
      case 'attack': {
        // 400Hz → 800Hz sawtooth sweep, 150ms
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(400, now)
        osc.frequency.linearRampToValueAtTime(800, now + 0.15)
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.15)
        break
      }
      case 'damage': {
        // low thud 200Hz sine, 200ms
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(200, now)
        gain.gain.setValueAtTime(0.18, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.2)
        break
      }
      case 'crit': {
        // 800Hz → 1600Hz square + 1200Hz → 2400Hz sine, 200ms
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        osc1.type = 'square'
        osc2.type = 'sine'
        osc1.frequency.setValueAtTime(800, now)
        osc1.frequency.linearRampToValueAtTime(1600, now + 0.2)
        osc2.frequency.setValueAtTime(1200, now)
        osc2.frequency.linearRampToValueAtTime(2400, now + 0.2)
        gain.gain.setValueAtTime(0.1, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.2)
        osc2.start(now)
        osc2.stop(now + 0.2)
        break
      }
      case 'ko': {
        // descending 600Hz → 100Hz sawtooth, 400ms
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(600, now)
        osc.frequency.linearRampToValueAtTime(100, now + 0.4)
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.4)
        break
      }
      case 'victory': {
        // C-E-G chord (523, 659, 784 Hz), 600ms
        for (const freq of [523, 659, 784]) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now)
          gain.gain.setValueAtTime(0.08, now)
          gain.gain.linearRampToValueAtTime(0.12, now + 0.15)
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6)
          osc.connect(gain).connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.6)
        }
        break
      }
    }
  }, [getCtx])

  return { play }
}
