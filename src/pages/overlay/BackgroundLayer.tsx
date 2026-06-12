import { Z } from './layers'

/// Background layer — CSS gradient sky backdrop.
/// No image file needed. Real background images can replace later.
export default function BackgroundLayer() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: Z.BACKGROUND,
      background: 'linear-gradient(to bottom, #0a0a2e 0%, #1a1a3e 40%, #2a1a0e 100%)',
    }} />
  )
}
