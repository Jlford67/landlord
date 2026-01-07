type LogoProps = {
  className?: string;
};

export default function ZillowLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 120 32"
      className={className}
      role="img"
      aria-label="Zillow"
    >
      <rect x="2" y="6" width="20" height="20" rx="4" fill="#006aff" />
      <path
        d="M12 9.5 6.5 14v8h4v-4h3v4h4v-8L12 9.5z"
        fill="#fff"
      />
      <text
        x="28"
        y="22"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="16"
        fill="#006aff"
      >
        Zillow
      </text>
    </svg>
  );
}
