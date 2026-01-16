import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { getButtonIconClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

type LinkButtonProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
};

export default function LinkButton({
  variant = "primary",
  size = "md",
  leftIcon,
  className,
  children,
  ...props
}: LinkButtonProps) {
  const classes = [buttonVariantClasses[variant], className].filter(Boolean).join(" ");
  const iconClasses = getButtonIconClasses(size);

  return (
    <Link className={classes} {...props}>
      {leftIcon ? <span className={iconClasses}>{leftIcon}</span> : null}
      <span className="whitespace-nowrap text-inherit no-underline">{children}</span>
    </Link>
  );
}

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: "ll_btnPrimary",
  secondary: "ll_btnSecondary",
  outline: "ll_btn",
  danger: "ll_btnDanger",
  ghost: "ll_btnGhost",
  warning: "ll_btnWarning",
};
