type BrandLogoProps = { className?: string }

/** The college's supplied elephant mark, cropped and background-free. */
export default function BrandLogo({ className = '' }: BrandLogoProps) {
  return <img className={`tusva-logo ${className}`} src="/tusva-elephant.png" alt="TUSVA College" draggable={false} />
}
