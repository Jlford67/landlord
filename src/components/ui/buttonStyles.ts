export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost" | "warning";
export type ButtonSize = "sm" | "md";

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ring-offset-white dark:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-50";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-transparent bg-blue-600 !text-white hover:bg-blue-700 active:bg-blue-800",
  secondary:
    "border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600",
  outline:
    "border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700",
  danger: "border border-transparent bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  ghost:
    "border border-transparent bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700",
  warning:
  "border border-transparent bg-[#f6bf25] !text-slate-900 !font-bold hover:bg-[#e0ad22] active:bg-[#cc9d1f]",

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
