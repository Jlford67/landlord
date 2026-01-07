type LogoProps = {
  className?: string;
};

export default function RedfinLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 120 32"
      className={className}
      role="img"
      aria-label="Redfin"
    >
      <rect x="2" y="6" width="20" height="20" rx="4" fill="#a61c30" />
      <path
        d="M6.5 15 12 10l5.5 5v7h-4v-4h-3v4h-4v-7z"
        fill="#fff"
      />
      <text
        x="28"
        y="22"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="16"
        fill="#a61c30"
      >
        Redfin
      </text>
    </svg>
  );
}
