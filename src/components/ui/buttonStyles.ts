export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost" | "warning";
export type ButtonSize = "sm" | "md";

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ring-offset-white disabled:pointer-events-none disabled:opacity-50";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-transparent bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
  secondary: "border border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:bg-slate-100",
  danger: "border border-transparent bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  ghost: "border border-transparent bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200",
  warning: "border border-transparent bg-amber-400 text-slate-900 hover:bg-amber-500 active:bg-amber-600",
};

export function getButtonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return [baseClasses, sizeClasses[size], variantClasses[variant], className].filter(Boolean).join(" ");
}

export function getButtonIconClasses(size: ButtonSize) {
  return size === "sm" ? "h-4 w-4" : "h-5 w-5";
}
