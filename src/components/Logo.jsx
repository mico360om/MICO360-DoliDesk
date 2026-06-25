import logoUrl from '../assets/logo.png'

// The MICO360 logo, or a custom `src` (e.g. the active company's logo). The
// artwork may contain dark elements, so on dark surfaces use `panel` to sit it
// on a white card for contrast.
export default function Logo({ src, className = 'h-8', panel = false, alt = 'MICO360 DoliDesk' }) {
  const img = <img src={src || logoUrl} alt={alt} draggable={false} className={`w-auto object-contain ${className}`} />
  if (!panel) return img
  return (
    <span className="inline-flex items-center rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
      {img}
    </span>
  )
}
