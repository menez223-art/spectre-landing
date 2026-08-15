// صورة المنتج — next/image لمسارات / ، و <img> عادي لصور data:URL (المنتجات المولّدة)
import Image from "next/image";

export function ProductImage({
  src,
  alt,
  className = "",
  sizes,
  objectPosition,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  objectPosition?: string;
  priority?: boolean;
}) {
  // بلا صورة بعد — لا شيء يُعرض (يمنع الانهيار أثناء المعاينة الفارغة)
  if (!src) return null;
  if (src.startsWith("data:")) {
    return (
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
        style={objectPosition ? { objectPosition } : undefined}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className={`object-cover ${className}`}
      style={objectPosition ? { objectPosition } : undefined}
    />
  );
}
