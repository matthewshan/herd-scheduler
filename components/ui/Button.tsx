import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "outline";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full container width. */
  block?: boolean;
  children: ReactNode;
}

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn font-body font-semibold transition-[background,transform,box-shadow] duration-ds ease-ds disabled:cursor-not-allowed";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-sh-brand hover:bg-brand-hover active:translate-y-px active:bg-brand-hover disabled:bg-[#a9cbde] disabled:shadow-none",
  ghost: "bg-surface-2 text-fg1 hover:bg-border",
  outline:
    "bg-surface text-brand shadow-[inset_0_0_0_1.5px_var(--brand)] hover:bg-brand-tint",
};

const SIZES: Record<ButtonSize, string> = {
  md: "h-12 px-[18px] text-[15px]",
  sm: "h-10 px-[14px] text-[14px]",
};

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
