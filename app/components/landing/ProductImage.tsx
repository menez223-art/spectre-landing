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
  // صور data:URL (المنتجات المولّدة) — <img> عادي لأنها محلية غير قابلة للتحسين
  if (src.startsWith("data:")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
        style={objectPosition ? { objectPosition } : undefined}
        // priority تُترجَم إلى fetchpriority عالي (الصورة الرئيسية فوق الطيّة)،
        // وبقية الصور تُحمَّل كسولةً (lazy) — تتطابق مع نظيرتها في generateHtml.ts.
        {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
        decoding="async"
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
