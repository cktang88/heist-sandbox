import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, type MutableRefObject } from 'react'
import type { OrthographicCamera } from 'three'
import type { MapDefinition } from '../game/types'

export const MIN_ZOOM_FACTOR = 0.65
export const MAX_ZOOM_FACTOR = 2.2

export function clampZoomFactor(value: number): number {
  return Math.max(MIN_ZOOM_FACTOR, Math.min(MAX_ZOOM_FACTOR, value))
}

export function zoomFactorAfterWheel(current: number, deltaY: number): number {
  return clampZoomFactor(current * Math.exp(-Math.max(-120, Math.min(120, deltaY)) * 0.0015))
}

export function fitMapZoom(viewportWidth: number, viewportHeight: number, mapWidth: number, mapDepth: number): number {
  const usableWidth = Math.max(1, viewportWidth - 40)
  const usableHeight = Math.max(1, viewportHeight - 34)
  return Math.max(24, Math.min(62, usableWidth / (mapWidth + 3.5), usableHeight / (mapDepth + 3)))
}

export function CameraRig({ map, zoomFactor, shake }: {
  map: MapDefinition
  zoomFactor: number
  shake: MutableRefObject<number>
}) {
  const { camera, size } = useThree()
  const orthographic = camera as OrthographicCamera
  useEffect(() => {
    camera.lookAt(0, 0, 0)
  }, [camera])
  useFrame(({ clock }) => {
    const amount = shake.current
    orthographic.zoom = fitMapZoom(size.width, size.height, map.width, map.depth) * zoomFactor
    orthographic.position.set(Math.sin(clock.elapsedTime * 94) * amount, 15, 13 + Math.cos(clock.elapsedTime * 79) * amount)
    orthographic.updateProjectionMatrix()
  })
  return null
}
