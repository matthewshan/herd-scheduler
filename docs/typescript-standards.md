# TypeScript standards

Conventions for TypeScript/React in this repo. These are house rules, not just
defaults — follow them in new code and when touching existing code. They reflect
the patterns already established in `components/ui/` and `lib/`.

## Component props

- **Declare props as a named `interface`, not an inline object type literal.**
  Even one-prop components get a named interface. It documents the component's
  surface, gives editors a hover target, and keeps prop docs (JSDoc) attached to
  a stable name.

  ```tsx
  // Yes
  interface SectionProps {
    title: string;
    children: React.ReactNode;
  }
  function Section({ title, children }: SectionProps) { /* ... */ }

  // No — inline literal
  function Section({ title, children }: { title: string; children: React.ReactNode }) { /* ... */ }
  ```

- **Name the interface `<Component>Props`** (PascalCase). Export it when the
  component is exported and consumers may want to type against it; keep it
  unexported (but still named) for file-private helper components.

- **When wrapping a native element, extend its attribute type** so every native
  prop (`onClick`, `aria-*`, `className`, `disabled`, …) passes through:

  ```tsx
  interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
  }
  ```

- **JSDoc non-obvious props** with a one-line `/** ... */` above the field, as in
  `MiniCalendar` / `SlotCard`. Skip it for self-evident props like `title`.

## `interface` vs `type`

- Use `interface` for object/props shapes.
- Use `type` for unions, intersections, and aliases — e.g.
  `type VoteValue = "yes" | "maybe" | "no"`, `type ButtonVariant = "primary" | "ghost" | "outline"`.

## Imports

- Use `import type { … }` for type-only imports so they're elided from the bundle
  (`import type { ReactNode } from "react"`).

## Children & nodes

- Type renderable children/slots as `ReactNode`.

## Helpers (`lib/`)

- Keep `lib/` helpers pure and give exported functions an explicit return type
  (`export function dayId(...): string`).
- Reuse shared helpers instead of re-deriving the same logic inline (e.g. month
  math lives in `addMonths`; don't recompute it in a component).

## Refs

- Form controls that need a ref use `forwardRef` with the matching element type
  (see `Input` / `Select`).
