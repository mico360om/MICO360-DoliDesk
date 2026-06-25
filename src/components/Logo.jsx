import logoUrl from '../assets/logo.png'

// The MICO360 logo. The artwork contains dark ("360") elements, so on dark
// surfaces use `panel` to sit it on a white card for contrast.
export default function Logo({ className = 'h-8', panel = false, alt = 'MICO360 DoliDesk' }) {
  const img = <img src={logoUrl} alt={alt} draggable={false} className={`w-auto ${className}`} />
  if (!panel) return img
  return (
    <span className="inline-flex items-center rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
      {img}
    </span>
  )
}
