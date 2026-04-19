const PADDING_X = 24

export type NormalizedAnchor = { nx: number; ny: number }

export const DEFAULT_TOP_ANCHOR: NormalizedAnchor = { nx: 0.5, ny: 0.14 }
export const DEFAULT_BOTTOM_ANCHOR: NormalizedAnchor = { nx: 0.5, ny: 0.86 }

export const WIDTH_FRAC_MIN = 0.2
export const WIDTH_FRAC_MAX = 1

export function innerContentWidth(canvasWidth: number): number {
  return canvasWidth - PADDING_X * 2
}

export function computeScaledDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxW / naturalWidth, maxH / naturalHeight)
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  }
}

function setMemeFont(ctx: CanvasRenderingContext2D, sizePx: number) {
  ctx.font = `${sizePx}px Impact, "Arial Black", sans-serif`
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    const w = ctx.measureText(test).width
    if (w > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawOutlinedBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  maxWidth: number,
  anchorY: number,
  fontSize: number,
  fillColor: string,
  strokeColor: string,
) {
  const t = text.trim()
  if (!t) return

  const strokeW = Math.max(2, Math.round(fontSize / 14))

  ctx.save()
  setMemeFont(ctx, fontSize)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  const lines = wrapLines(ctx, t, maxWidth)
  const lineHeight = fontSize * 1.15
  const totalH = lines.length * lineHeight
  const blockCenterY = anchorY
  const startY = blockCenterY - totalH / 2 + lineHeight / 2

  ctx.lineWidth = strokeW * 2
  ctx.strokeStyle = strokeColor
  ctx.fillStyle = fillColor

  for (let i = 0; i < lines.length; i++) {
    const ly = startY + i * lineHeight
    ctx.strokeText(lines[i], centerX, ly, maxWidth)
    ctx.fillText(lines[i], centerX, ly, maxWidth)
  }

  ctx.restore()
}

export function drawMeme(
  ctx: CanvasRenderingContext2D,
  options: {
    image: CanvasImageSource
    topText: string
    bottomText: string
    width: number
    height: number
    topAnchor: NormalizedAnchor
    bottomAnchor: NormalizedAnchor
    topFontSize: number
    bottomFontSize: number
    topWidthFrac: number
    bottomWidthFrac: number
    topFill: string
    topStroke: string
    bottomFill: string
    bottomStroke: string
  },
): void {
  const {
    image,
    topText,
    bottomText,
    width,
    height,
    topAnchor,
    bottomAnchor,
    topFontSize,
    bottomFontSize,
    topWidthFrac,
    bottomWidthFrac,
    topFill,
    topStroke,
    bottomFill,
    bottomStroke,
  } = options

  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)

  const innerW = innerContentWidth(width)
  const topMaxW = innerW * topWidthFrac
  const bottomMaxW = innerW * bottomWidthFrac

  const topX = topAnchor.nx * width
  const topY = topAnchor.ny * height
  const bottomX = bottomAnchor.nx * width
  const bottomY = bottomAnchor.ny * height

  drawOutlinedBlock(
    ctx,
    topText,
    topX,
    topMaxW,
    topY,
    topFontSize,
    topFill,
    topStroke,
  )
  drawOutlinedBlock(
    ctx,
    bottomText,
    bottomX,
    bottomMaxW,
    bottomY,
    bottomFontSize,
    bottomFill,
    bottomStroke,
  )
}
