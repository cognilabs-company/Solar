import { useEffect, useRef, useState } from 'react'
import type { SidebarSolarScene } from './sidebarSolarScene'

interface SidebarSolarBadgeProps {
	/** Offset of the active link; a change flips the panel toward the move. */
	top: number
	hovered: boolean
}

/**
 * 3D solar tracker that rides the active sidebar link. three.js is loaded as a
 * separate chunk; if WebGL is unavailable the badge simply doesn't render.
 */
function SidebarSolarBadge({ top, hovered }: SidebarSolarBadgeProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const sceneRef = useRef<SidebarSolarScene | null>(null)
	const [ready, setReady] = useState(false)
	const lastTop = useRef<number | null>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return undefined

		let cancelled = false
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

		import('./sidebarSolarScene')
			.then(({ createSidebarSolarScene }) => {
				if (cancelled) return
				try {
					sceneRef.current = createSidebarSolarScene(canvas, { reducedMotion })
					setReady(true)
				} catch {
					// No WebGL: keep the plain indicator.
				}
			})
			.catch(() => undefined)

		return () => {
			cancelled = true
			sceneRef.current?.dispose()
			sceneRef.current = null
		}
	}, [])

	useEffect(() => {
		const previous = lastTop.current
		lastTop.current = top
		if (previous === null || previous < 0 || top < 0 || previous === top) return
		sceneRef.current?.flip(top > previous ? 1 : -1)
	}, [top])

	useEffect(() => {
		sceneRef.current?.setHover(hovered)
	}, [hovered, ready])

	return (
		<canvas
			ref={canvasRef}
			aria-hidden='true'
			className={[
				'sidebar-solar-badge pointer-events-none absolute right-1 top-1/2 h-[52px] w-[52px] -translate-y-1/2 transition-opacity duration-500',
				ready ? 'opacity-100' : 'opacity-0',
			].join(' ')}
		/>
	)
}

export default SidebarSolarBadge
