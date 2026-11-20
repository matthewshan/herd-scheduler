import { cloneElement, forwardRef, isValidElement } from "react";
import type {
  AriaAttributes,
  InputHTMLAttributes,
  ReactElement,
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

/**
 * The red required marker. `aria-hidden` because required fields carry the
 * semantics via `aria-required`/`required` on the control itself — the asterisk
 * is a visual cue only. Shared so labels and section headings stay identical.
 * The gap from the preceding text is a `ml-0.5` margin, not a literal space.
 */
export function RequiredMark() {
  return (
    <span className="ml-0.5 text-no" aria-hidden="true">
      *
    </span>
  );
}

export interface LabelProps {
  htmlFor?: string;
  /** Appends a muted "(optional)" hint. */
  optional?: boolean;
  /** Appends a required asterisk so required fields read unambiguously. */
  required?: boolean;
  children: ReactNode;
}

export function Label({ htmlFor, optional, required, children }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block font-body text-[13px] font-medium text-fg2"
    >
      {children}
      {required && <RequiredMark />}
      {optional && <span className="font-normal text-fg3"> (optional)</span>}
    </label>
  );
}

export interface FieldErrorProps {
  /** Lets the invalid control point at this message via `aria-describedby`. */
  id?: string;
  children: ReactNode;
}

export function FieldError({ id, children }: FieldErrorProps) {
  return (
    <p
      id={id}
      className="mt-1.5 flex items-center gap-[5px] font-body text-[12.5px] text-no"
    >
      <CircleAlert size={14} aria-hidden="true" />
      {children}
    </p>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Red error chrome; also sets `aria-invalid` so screen readers announce it. */
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, className = "", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={error || undefined}
      className={`h-12 px-[14px] ${fieldClass(error)} ${className}`}
      {...rest}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Red error chrome; also sets `aria-invalid` so screen readers announce it. */
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ error, className = "", rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={error || undefined}
        className={`resize-none px-[14px] py-3 leading-[22px] ${fieldClass(error)} ${className}`}
        {...rest}
      />
    );
  },
);

// The props Field reads/sets on its child control to link an error message.
interface DescribableProps extends Pick<
  AriaAttributes,
  "aria-describedby" | "aria-invalid"
> {
  id?: string;
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

// Convenience wrapper: label + control + optional error in one field group.
// When `error` is set, the (single) child control is marked `aria-invalid` and
// pointed at the message via `aria-describedby`, so assistive tech announces
// the error — the id derives from `htmlFor` (or the child's own `id`), which
// keeps this hook-free and usable from server components.
export function Field({
  label,
  htmlFor,
  optional,
  required,
  error,
  children,
}: FieldProps) {
  let control = children;
  let errorId: string | undefined;
  if (error && isValidElement<DescribableProps>(children)) {
    const child: ReactElement<DescribableProps> = children;
    const controlId = htmlFor ?? child.props.id;
    if (controlId) {
      errorId = `${controlId}-error`;
      const describedBy = [child.props["aria-describedby"], errorId]
        .filter(Boolean)
        .join(" ");
      control = cloneElement(child, {
        "aria-describedby": describedBy,
        "aria-invalid": child.props["aria-invalid"] ?? true,
      });
    }
  }
  return (
    <div className="mb-4">
      <Label htmlFor={htmlFor} optional={optional} required={required}>
        {label}
      </Label>
      {control}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export { fieldClass };
