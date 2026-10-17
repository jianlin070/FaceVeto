import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'

// Keep in sync with the exact version pinned in package.json.
const MEDIAPIPE_VERSION = '1.1.1'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export type Challenge = 'blink' | 'turn_left' | 'turn_right'

export const CHALLENGE_TEXT: Record<Challenge, string> = {
  blink: 'Blink twice',
  turn_left: 'Turn your head to your left',
  turn_right: 'Turn your head to your right',
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null

export function loadLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`)
      const opts = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO' as const,
        numFaces: 2,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      })
      try {
        return await FaceLandmarker.createFromOptions(fileset, opts('GPU'))
      } catch {
        return await FaceLandmarker.createFromOptions(fileset, opts('CPU'))
      }
    })()
    landmarkerPromise.catch(() => { landmarkerPromise = null })
  }
  return landmarkerPromise
}

/**
 * Horizontal head position from the raw (unmirrored) camera frame:
 * nose tip (1) relative to the face contour points 234 (subject's right cheek, image left)
 * and 454 (subject's left cheek, image right). About 0.5 when facing the camera.
 * The value rises when the person turns to their own left.
 */
export function yawRatio(res: FaceLandmarkerResult): number | null {
  const lm = res.faceLandmarks[0]
  if (!lm) return null
  const nose = lm[1], a = lm[234], b = lm[454]
  const w = b.x - a.x
  if (Math.abs(w) < 1e-3) return null
  return (nose.x - a.x) / w
}

export const TURN = { left: 0.68, right: 0.32, centreMin: 0.4, centreMax: 0.6 }

export function isTurned(ratio: number, c: 'turn_left' | 'turn_right') {
  return c === 'turn_left' ? ratio > TURN.left : ratio < TURN.right
}

export function isCentred(ratio: number) {
  return ratio >= TURN.centreMin && ratio <= TURN.centreMax
}

function blendshape(res: FaceLandmarkerResult, name: string): number {
  return res.faceBlendshapes[0]?.categories.find((c) => c.categoryName === name)?.score ?? 0
}

/** Counts blinks: both eyes closed (> 0.5) then both open (< 0.2) within 600 ms. */
export class BlinkCounter {
  count = 0
  private closedAt: number | null = null

  update(res: FaceLandmarkerResult, t: number) {
    const l = blendshape(res, 'eyeBlinkLeft'), r = blendshape(res, 'eyeBlinkRight')
    if (this.closedAt === null && l > 0.5 && r > 0.5) {
      this.closedAt = t
    } else if (this.closedAt !== null && l < 0.2 && r < 0.2) {
      if (t - this.closedAt <= 600) this.count++
      this.closedAt = null
    }
  }

  reset() { this.count = 0; this.closedAt = null }
}
