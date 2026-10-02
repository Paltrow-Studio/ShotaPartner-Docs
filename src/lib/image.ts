import { LIMITS, imageMaxEdge, imageTypes } from '../data/feedback'

/**
 * 提交前的图片处理。
 *
 * 玩家多半是直接截屏后拖进来，原始 PNG 往往好几 MB；国内上传带宽有限，
 * 所以先在浏览器里用 canvas 缩到长边 imageMaxEdge、转成 webp，再交给服务端。
 * 这样一次提交通常只有几百 KB，也顺手绕开了服务端的单张上限。
 *
 * GIF 不做压缩（canvas 会把动图压成一张静态图），只在超限时报错。
 */

export type PreparedImage = {
  name: string
  type: string
  dataUrl: string
  /** 编码后的字节数（估算，用于在页面上提示体积） */
  bytes: number
  width: number
  height: number
  originalBytes: number
  /** 是否做过缩放 / 转码 */
  compressed: boolean
}

export type PrepareResult = { ok: true; image: PreparedImage } | { ok: false; error: string }

/** 允许上传的输入类型，比允许提交的类型宽：手机截图可能是 avif / bmp，转码后即可 */
const ACCEPTED = /^image\/(png|jpe?g|webp|gif|bmp|avif|tiff)$/i
/** 解码前的原始大小上限：再大就不是截图了，直接拦住比让浏览器卡死好 */
const SOURCE_MAX = 20 * 1024 * 1024

const ATTEMPTS = [
  { edge: imageMaxEdge, quality: 0.82 },
  { edge: 1280, quality: 0.75 },
  { edge: 1024, quality: 0.7 },
]

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(blob)
  })
}

/** data URL 的字节数：base64 长度 × 3/4 */
function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor((base64.length * 3) / 4)
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* 退回 <img> 解码 */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('decode'))
      image.src = url
    })
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function sizeOf(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if ('naturalWidth' in source) return { width: source.naturalWidth, height: source.naturalHeight }
  return { width: source.width, height: source.height }
}

/** 浏览器是否支持 webp 编码（Safari 14 之前不支持） */
let webpSupport: boolean | null = null
function supportsWebp(): boolean {
  if (webpSupport !== null) return webpSupport
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  return webpSupport
}

function encode(source: ImageBitmap | HTMLImageElement, edge: number, quality: number): { dataUrl: string; width: number; height: number } {
  const { width, height } = sizeOf(source)
  const scale = Math.min(1, edge / Math.max(width, height))
  const target = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器不支持 canvas')
  context.drawImage(source as CanvasImageSource, 0, 0, target.width, target.height)
  const type = supportsWebp() ? 'image/webp' : 'image/jpeg'
  return { dataUrl: canvas.toDataURL(type, quality), ...target }
}

export async function prepareImage(file: File): Promise<PrepareResult> {
  if (!ACCEPTED.test(file.type)) {
    return { ok: false, error: `${file.name}：只支持图片（png / jpg / webp / gif）` }
  }
  if (file.size > SOURCE_MAX) {
    return { ok: false, error: `${file.name}：原图超过 ${Math.round(SOURCE_MAX / 1024 / 1024)} MB，请先裁剪` }
  }

  // GIF 保持原样：动图是有效证据，转码会丢掉它
  if (file.type === 'image/gif') {
    const dataUrl = await readAsDataUrl(file)
    const bytes = dataUrlBytes(dataUrl)
    if (bytes > LIMITS.imageBytesMax) {
      return { ok: false, error: `${file.name}：动图超过 ${Math.round(LIMITS.imageBytesMax / 1024 / 1024)} MB` }
    }
    return {
      ok: true,
      image: {
        name: file.name,
        type: 'image/gif',
        dataUrl,
        bytes,
        width: 0,
        height: 0,
        originalBytes: file.size,
        compressed: false,
      },
    }
  }

  let source: ImageBitmap | HTMLImageElement
  try {
    source = await decode(file)
  } catch {
    return { ok: false, error: `${file.name}：浏览器无法读取这张图，请改用 PNG / JPG / WebP 格式` }
  }

  try {
    for (const attempt of ATTEMPTS) {
      const encoded = encode(source, attempt.edge, attempt.quality)
      const bytes = dataUrlBytes(encoded.dataUrl)
      if (bytes <= LIMITS.imageBytesMax) {
        return {
          ok: true,
          image: {
            name: file.name.replace(/\.[^.]+$/, '') + (encoded.dataUrl.startsWith('data:image/webp') ? '.webp' : '.jpg'),
            type: encoded.dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
            dataUrl: encoded.dataUrl,
            bytes,
            width: encoded.width,
            height: encoded.height,
            originalBytes: file.size,
            compressed: true,
          },
        }
      }
    }
  } finally {
    if ('close' in source) source.close()
  }

  return {
    ok: false,
    error: `${file.name}：压缩后仍超过 ${Math.round(LIMITS.imageBytesMax / 1024 / 1024)} MB，请裁剪后再试`,
  }
}

/** 批量处理，保持选择顺序；单张失败不影响其它张 */
export async function prepareImages(files: File[]): Promise<{ images: PreparedImage[]; errors: string[] }> {
  const images: PreparedImage[] = []
  const errors: string[] = []
  for (const file of files.slice(0, LIMITS.imagesMax)) {
    const result = await prepareImage(file)
    if (result.ok) images.push(result.image)
    else errors.push(result.error)
  }
  return { images, errors }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export { imageTypes }