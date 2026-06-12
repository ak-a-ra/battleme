import { Z } from './layers'

/// Environment layer — ground strip + scrolling tree canopy parallax.
export default function EnvironmentLayer() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: Z.ENVIRONMENT, pointerEvents: 'none' }}>
      {/* Ground strip */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 120,
        background: 'linear-gradient(to top, #2d4a1e, transparent)',
      }} />
      {/* Tree strip — scrolling parallax */}
      <div
        className="trees-scroll"
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0, right: 0,
          height: 200,
          width: '100%',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 200'%3E%3Crect x='80' y='40' width='8' height='60' fill='%2344220a'/%3E%3Ccircle cx='84' cy='30' r='30' fill='%231a4a0a'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: '192px 200px',
          animation: 'scroll-left 20s linear infinite',
        }}
      />
    </div>
  )
}
