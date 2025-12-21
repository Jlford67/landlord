"use client";

export default function ConfirmSubmitButton({
  className,
  children,
  message,
}: {
  className?: string;
  children: React.ReactNode;
  message: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
