import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { fieldClass } from "./Input";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

// Native select with the shared field chrome and a custom chevron. Keeping the
// native control preserves mobile pickers + accessibility for free.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ error, className = "", children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={`h-12 cursor-pointer appearance-none pl-[14px] pr-10 font-medium ${fieldClass(error)} ${className}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-fg2"
        />
      </div>
    );
  },
);
