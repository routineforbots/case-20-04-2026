import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  computeScaledDimensions,
  DEFAULT_BOTTOM_ANCHOR,
  DEFAULT_TOP_ANCHOR,
  drawMeme,
  innerContentWidth,
  WIDTH_FRAC_MAX,
  WIDTH_FRAC_MIN,
  type NormalizedAnchor,
} from '../lib/drawMeme'

const FONT_MIN = 16
const FONT_MAX = 120
const FONT_DEFAULT = 48
const MAX_PREVIEW_W = 900
const MAX_PREVIEW_H = 700

const DEFAULT_FILL = '#ffffff'
const DEFAULT_STROKE = '#000000'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function pointerEventToNormalizedAnchor(
  canvas: HTMLCanvasElement,
  e: PointerEvent,
): { nx: number; ny: number } {
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return { nx: 0.5, ny: 0.5 }
  }
  const nx = clamp((e.clientX - rect.left) / rect.width, 0.02, 0.98)
  const ny = clamp((e.clientY - rect.top) / rect.height, 0.02, 0.98)
  return { nx, ny }
}

type Interaction =
  | null
  | { kind: 'move'; band: 'top' | 'bottom' }
  | { kind: 'resizeW'; band: 'top' | 'bottom' }
  | { kind: 'resizeFont'; band: 'top' | 'bottom' }

export function MemeEditor() {
  const templateId = useId()
  const topId = useId()
  const bottomId = useId()
  const sizeId = useId()
  const topFillId = useId()
  const topStrokeId = useId()
  const bottomFillId = useId()
  const bottomStrokeId = useId()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fontDragRef = useRef<{ startY: number; startSize: number } | null>(
    null,
  )

  const [file, setFile] = useState<File | null>(null)
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(
    null,
  )
  const [topText, setTopText] = useState('')
  const [bottomText, setBottomText] = useState('')
  const [topFontSize, setTopFontSize] = useState(FONT_DEFAULT)
  const [bottomFontSize, setBottomFontSize] = useState(FONT_DEFAULT)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const [topAnchor, setTopAnchor] = useState<NormalizedAnchor>(
    DEFAULT_TOP_ANCHOR,
  )
  const [bottomAnchor, setBottomAnchor] = useState<NormalizedAnchor>(
    DEFAULT_BOTTOM_ANCHOR,
  )
  const [topWidthFrac, setTopWidthFrac] = useState(WIDTH_FRAC_MAX)
  const [bottomWidthFrac, setBottomWidthFrac] = useState(WIDTH_FRAC_MAX)

  const [topFill, setTopFill] = useState(DEFAULT_FILL)
  const [topStroke, setTopStroke] = useState(DEFAULT_STROKE)
  const [bottomFill, setBottomFill] = useState(DEFAULT_FILL)
  const [bottomStroke, setBottomStroke] = useState(DEFAULT_STROKE)

  const [interaction, setInteraction] = useState<Interaction>(null)

  useEffect(() => {
    if (!file) {
      return
    }

    const url = URL.createObjectURL(file)
    const img = new Image()
    let cancelled = false

    img.onload = () => {
      URL.revokeObjectURL(url)
      if (cancelled) return
      const dim = computeScaledDimensions(
        img.naturalWidth,
        img.naturalHeight,
        MAX_PREVIEW_W,
        MAX_PREVIEW_H,
      )
      setSize(dim)
      setTemplateImage(img)
      setTopAnchor(DEFAULT_TOP_ANCHOR)
      setBottomAnchor(DEFAULT_BOTTOM_ANCHOR)
      setTopWidthFrac(WIDTH_FRAC_MAX)
      setBottomWidthFrac(WIDTH_FRAC_MAX)
      setTopFontSize(FONT_DEFAULT)
      setBottomFontSize(FONT_DEFAULT)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      if (!cancelled) {
        setTemplateImage(null)
        setSize({ width: 0, height: 0 })
      }
    }

    img.src = url

    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !templateImage || size.width === 0 || size.height === 0) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size.width
    canvas.height = size.height

    drawMeme(ctx, {
      image: templateImage,
      topText,
      bottomText,
      width: size.width,
      height: size.height,
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
    })
  }, [
    templateImage,
    topText,
    bottomText,
    size,
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
  ])

  useEffect(() => {
    if (!interaction) return

    const onMove = (e: PointerEvent) => {
      const cv = canvasRef.current
      if (!cv || size.width <= 0) return
      const rect = cv.getBoundingClientRect()
      const scaleX = size.width / rect.width

      if (interaction.kind === 'move') {
        const { nx, ny } = pointerEventToNormalizedAnchor(cv, e)
        if (interaction.band === 'top') {
          setTopAnchor({ nx, ny })
        } else {
          setBottomAnchor({ nx, ny })
        }
        return
      }

      if (interaction.kind === 'resizeW') {
        const innerW = innerContentWidth(size.width)
        const anchor = interaction.band === 'top' ? topAnchor : bottomAnchor
        const cx = anchor.nx * size.width
        const px = (e.clientX - rect.left) * scaleX
        const halfW = Math.abs(px - cx)
        const wf = clamp(
          (2 * halfW) / innerW,
          WIDTH_FRAC_MIN,
          WIDTH_FRAC_MAX,
        )
        if (interaction.band === 'top') {
          setTopWidthFrac(wf)
        } else {
          setBottomWidthFrac(wf)
        }
        return
      }

      if (interaction.kind === 'resizeFont') {
        const ref = fontDragRef.current
        if (!ref) return
        const delta = Math.round((ref.startY - e.clientY) * 0.35)
        const n = clamp(ref.startSize + delta, FONT_MIN, FONT_MAX)
        if (interaction.band === 'top') {
          setTopFontSize(n)
        } else {
          setBottomFontSize(n)
        }
      }
    }

    const onUp = () => {
      setInteraction(null)
      fontDragRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [interaction, size, topAnchor, bottomAnchor])

  function beginMove(e: ReactPointerEvent<HTMLButtonElement>, band: 'top' | 'bottom') {
    e.preventDefault()
    e.stopPropagation()
    setInteraction({ kind: 'move', band })
    const cv = canvasRef.current
    if (cv) {
      const { nx, ny } = pointerEventToNormalizedAnchor(cv, e.nativeEvent)
      if (band === 'top') {
        setTopAnchor({ nx, ny })
      } else {
        setBottomAnchor({ nx, ny })
      }
    }
  }

  function beginResizeW(e: ReactPointerEvent<HTMLButtonElement>, band: 'top' | 'bottom') {
    e.preventDefault()
    e.stopPropagation()
    setInteraction({ kind: 'resizeW', band })
  }

  function beginResizeFont(
    e: ReactPointerEvent<HTMLButtonElement>,
    band: 'top' | 'bottom',
  ) {
    e.preventDefault()
    e.stopPropagation()
    fontDragRef.current = {
      startY: e.clientY,
      startSize: band === 'top' ? topFontSize : bottomFontSize,
    }
    setInteraction({ kind: 'resizeFont', band })
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null
    setFile(next)
    if (!next) {
      setTemplateImage(null)
      setSize({ width: 0, height: 0 })
    }
  }

  const download = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !templateImage) return

    canvas.toBlob((blob) => {
      if (!blob) {
        const fallback = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = fallback
        a.download = 'meme.png'
        a.click()
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'meme.png'
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }, [templateImage])

  const hasImage = Boolean(templateImage && size.width > 0)

  const W = size.width
  const H = size.height
  const innerW = W > 0 ? innerContentWidth(W) : 0

  const topMaxW = innerW * topWidthFrac
  const bottomMaxW = innerW * bottomWidthFrac
  const topHalfNorm = W > 0 ? topMaxW / (2 * W) : 0
  const bottomHalfNorm = W > 0 ? bottomMaxW / (2 * W) : 0

  const topFontHandleNy =
    topAnchor.ny +
    (H > 0 ? Math.min(0.1, (topFontSize * 2.4) / H) : 0.06)
  const bottomFontHandleNy =
    bottomAnchor.ny +
    (H > 0 ? Math.min(0.1, (bottomFontSize * 2.4) / H) : 0.06)

  const avgFontSize = Math.round((topFontSize + bottomFontSize) / 2)

  const isActive = (
    kind: 'move' | 'resizeW' | 'resizeFont',
    band: 'top' | 'bottom',
  ): boolean =>
    interaction !== null &&
    interaction.band === band &&
    interaction.kind === kind

  return (
    <div className="meme-app">
      <header className="meme-header">
        <div className="meme-header-top">
          <div className="meme-header-mark" aria-hidden />
          <div className="meme-header-text">
            <p className="meme-eyebrow">Canvas</p>
            <h1>Meme studio</h1>
            <p className="meme-tagline">
              Move captions with the center handle, stretch line width with the
              sides, and drag the small bar under each line to resize type. The
              slider sets both sizes together.
            </p>
          </div>
        </div>
      </header>

      <main className="meme-layout">
        <section className="meme-panel" aria-label="Controls">
          <div className="meme-section">
            <h2 className="meme-section-title">Image</h2>
            <div className="meme-field">
              <label htmlFor={templateId}>Template</label>
              <input
                id={templateId}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="meme-section">
            <h2 className="meme-section-title">Top caption</h2>
            <div className="meme-field">
              <label htmlFor={topId}>Text</label>
              <input
                id={topId}
                type="text"
                placeholder="TOP TEXT"
                autoComplete="off"
                value={topText}
                onChange={(e) => setTopText(e.target.value)}
              />
            </div>
            <div className="meme-field meme-field-row">
              <div className="meme-color-field">
                <label htmlFor={topFillId}>Fill</label>
                <input
                  id={topFillId}
                  type="color"
                  value={topFill}
                  onChange={(e) => setTopFill(e.target.value)}
                  aria-label="Top text fill color"
                />
              </div>
              <div className="meme-color-field">
                <label htmlFor={topStrokeId}>Outline</label>
                <input
                  id={topStrokeId}
                  type="color"
                  value={topStroke}
                  onChange={(e) => setTopStroke(e.target.value)}
                  aria-label="Top text outline color"
                />
              </div>
            </div>
          </div>

          <div className="meme-section">
            <h2 className="meme-section-title">Bottom caption</h2>
            <div className="meme-field">
              <label htmlFor={bottomId}>Text</label>
              <input
                id={bottomId}
                type="text"
                placeholder="BOTTOM TEXT"
                autoComplete="off"
                value={bottomText}
                onChange={(e) => setBottomText(e.target.value)}
              />
            </div>
            <div className="meme-field meme-field-row">
              <div className="meme-color-field">
                <label htmlFor={bottomFillId}>Fill</label>
                <input
                  id={bottomFillId}
                  type="color"
                  value={bottomFill}
                  onChange={(e) => setBottomFill(e.target.value)}
                  aria-label="Bottom text fill color"
                />
              </div>
              <div className="meme-color-field">
                <label htmlFor={bottomStrokeId}>Outline</label>
                <input
                  id={bottomStrokeId}
                  type="color"
                  value={bottomStroke}
                  onChange={(e) => setBottomStroke(e.target.value)}
                  aria-label="Bottom text outline color"
                />
              </div>
            </div>
          </div>

          <div className="meme-section">
            <h2 className="meme-section-title">Type size</h2>
            <div className="meme-field">
              <label htmlFor={sizeId}>
                Both captions{' '}
                <span className="meme-size-value">{avgFontSize}</span>
                <span className="meme-unit">px</span>
              </label>
              <input
                id={sizeId}
                type="range"
                min={FONT_MIN}
                max={FONT_MAX}
                value={avgFontSize}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setTopFontSize(v)
                  setBottomFontSize(v)
                }}
              />
            </div>
          </div>

          <div className="meme-section">
            <h2 className="meme-section-title">Export</h2>
            <div className="meme-actions">
              <button
                type="button"
                className="meme-btn meme-btn-primary"
                disabled={!hasImage}
                onClick={download}
              >
                Download PNG
              </button>
            </div>
          </div>
        </section>

        <section className="meme-preview-wrap" aria-label="Preview">
          <p className="meme-preview-label">Preview</p>
          <div
            className={`meme-canvas-box${hasImage ? ' meme-canvas-box--ready' : ''}`}
          >
            <div
              className={`meme-canvas-viewport${hasImage ? '' : ' meme-canvas-viewport--empty'}`}
            >
              <canvas
                ref={canvasRef}
                className="meme-canvas"
                hidden={!hasImage}
                aria-hidden={!hasImage}
              />
              {hasImage && (
                <div
                  className="meme-handles"
                  aria-hidden
                  style={{ touchAction: interaction ? 'none' : undefined }}
                >
                  <div
                    className="meme-text-controls meme-text-controls--top"
                    style={{
                      left: `${(topAnchor.nx - topHalfNorm) * 100}%`,
                      width: `${(topMaxW / W) * 100}%`,
                      top: `${topAnchor.ny * 100}%`,
                    }}
                  >
                    <button
                      type="button"
                      className={`meme-resize-handle meme-resize-handle--w${isActive('resizeW', 'top') ? ' meme-resize-handle--active' : ''}`}
                      aria-label="Resize top text line width"
                      onPointerDown={(e) => beginResizeW(e, 'top')}
                    />
                    <div className="meme-text-controls-mid">
                      <button
                        type="button"
                        className={`meme-drag-handle meme-drag-handle--top${isActive('move', 'top') ? ' meme-drag-handle--active' : ''}`}
                        aria-label="Drag to move top text"
                        aria-pressed={isActive('move', 'top')}
                        onPointerDown={(e) => beginMove(e, 'top')}
                      />
                    </div>
                    <button
                      type="button"
                      className={`meme-resize-handle meme-resize-handle--e${isActive('resizeW', 'top') ? ' meme-resize-handle--active' : ''}`}
                      aria-label="Resize top text line width"
                      onPointerDown={(e) => beginResizeW(e, 'top')}
                    />
                  </div>
                  <button
                    type="button"
                    className={`meme-resize-handle meme-resize-handle--font meme-resize-handle--top-font${isActive('resizeFont', 'top') ? ' meme-resize-handle--active' : ''}`}
                    style={{
                      left: `${topAnchor.nx * 100}%`,
                      top: `${clamp(topFontHandleNy, 0.02, 0.98) * 100}%`,
                    }}
                    aria-label="Drag vertically to resize top text"
                    onPointerDown={(e) => beginResizeFont(e, 'top')}
                  />

                  <div
                    className="meme-text-controls meme-text-controls--bottom"
                    style={{
                      left: `${(bottomAnchor.nx - bottomHalfNorm) * 100}%`,
                      width: `${(bottomMaxW / W) * 100}%`,
                      top: `${bottomAnchor.ny * 100}%`,
                    }}
                  >
                    <button
                      type="button"
                      className={`meme-resize-handle meme-resize-handle--w${isActive('resizeW', 'bottom') ? ' meme-resize-handle--active' : ''}`}
                      aria-label="Resize bottom text line width"
                      onPointerDown={(e) => beginResizeW(e, 'bottom')}
                    />
                    <div className="meme-text-controls-mid">
                      <button
                        type="button"
                        className={`meme-drag-handle meme-drag-handle--bottom${isActive('move', 'bottom') ? ' meme-drag-handle--active' : ''}`}
                        aria-label="Drag to move bottom text"
                        aria-pressed={isActive('move', 'bottom')}
                        onPointerDown={(e) => beginMove(e, 'bottom')}
                      />
                    </div>
                    <button
                      type="button"
                      className={`meme-resize-handle meme-resize-handle--e${isActive('resizeW', 'bottom') ? ' meme-resize-handle--active' : ''}`}
                      aria-label="Resize bottom text line width"
                      onPointerDown={(e) => beginResizeW(e, 'bottom')}
                    />
                  </div>
                  <button
                    type="button"
                    className={`meme-resize-handle meme-resize-handle--font meme-resize-handle--bottom-font${isActive('resizeFont', 'bottom') ? ' meme-resize-handle--active' : ''}`}
                    style={{
                      left: `${bottomAnchor.nx * 100}%`,
                      top: `${clamp(bottomFontHandleNy, 0.02, 0.98) * 100}%`,
                    }}
                    aria-label="Drag vertically to resize bottom text"
                    onPointerDown={(e) => beginResizeFont(e, 'bottom')}
                  />
                </div>
              )}
            </div>
            {!hasImage && (
              <p className="meme-placeholder">Choose an image to start</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
