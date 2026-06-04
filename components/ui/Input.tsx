import { forwardRef } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { CircleAlert } from "lucide-react";

// Shared field chrome: input/select/textarea all share this look so the focus
// ring + error state are consistent. `err` swaps the border + ring to red.
const fieldClass = (err?: boolean) =>
  [
    "w-full rounded-input border bg-input-bg font-body text-[15px] text-fg1",
    "transition-[border-color,box-shadow] duration-ds ease-ds",
    "placeholder:text-fg3 focus:outline-none",
    err
      ? "border-no shadow-[0_0_0_3px_rgba(220,38,38,0.14)]"
      : "border-border-strong focus:border-brand focus:shadow-[0_0_0_3px_rgba(0,119,182,0.18)]",
  ].join(" ");

export function Label({
  htmlFor,
  optional,
  children,
}: {
  htmlFor?: string;
  /** Appends a muted "(optional)" hint. */
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block font-body text-[13px] font-medium text-fg2"
    >
      {children}
      {optional && <span className="font-normal text-fg3"> (optional)</span>}
    </label>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-[5px] font-body text-[12.5px] text-no">
      <CircleAlert size={14} />
      {children}
    </p>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, className = "", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`h-12 px-[14px] ${fieldClass(error)} ${className}`}
      {...rest}
    />
  );
});

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ error, className = "", rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`resize-none px-[14px] py-3 leading-[22px] ${fieldClass(error)} ${className}`}
        {...rest}
      />
    );
  },
);

// Convenience wrapper: label + control + optional error in one field group.
export function Field({
  label,
  htmlFor,
  optional,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <Label htmlFor={htmlFor} optional={optional}>
        {label}
      </Label>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

export { fieldClass };
