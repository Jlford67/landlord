type Props = {
  propertyId: string | null;
  alt?: string;
  className?: string;
};

export default function PropertyPhoto({ propertyId, alt, className }: Props) {
  if (!propertyId) return null;

  // no extension here on purpose
  return (
    <img
      src={`/property-photo/${propertyId}`}
      alt={alt ?? "Property photo"}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
