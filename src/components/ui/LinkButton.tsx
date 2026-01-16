import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { getButtonClasses, getButtonIconClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

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
  const classes = getButtonClasses({ variant, size, className });
  const iconClasses = getButtonIconClasses(size);

  return (
    <Link className={classes} {...props}>
      {leftIcon ? <span className={iconClasses}>{leftIcon}</span> : null}
      <span className="whitespace-nowrap text-inherit no-underline">{children}</span>
    </Link>
  );
}
