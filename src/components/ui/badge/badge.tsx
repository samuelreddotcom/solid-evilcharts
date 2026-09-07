import { cva, type VariantProps } from "class-variance-authority";
import {
  createContext,
  type ComponentProps,
  splitProps,
  useContext,
} from "solid-js";

import { cn } from "../../../lib/cn";
import { Spinner } from "../spinner/spinner";

export const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 rounded-full",
    "px-2 py-0.5 text-xs font-medium whitespace-nowrap select-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  ],
  {
    variants: {
      variant: {
        default: "bg-foreground text-background",
        brand: "bg-brand text-brand-foreground",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        destructive: "bg-destructive/15 text-destructive",
        secondary: "bg-foreground/8 text-foreground",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;
export type BadgeVariant = NonNullable<BadgeVariantProps["variant"]>;

const BadgeContext = createContext<BadgeVariant>("default");
const useBadgeVariant = () => useContext(BadgeContext);

export type BadgeProps = ComponentProps<"span"> & BadgeVariantProps;

export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  const variant = () => local.variant ?? "default";
  return (
    <BadgeContext.Provider value={variant()}>
      <span
        data-slot="badge"
        class={cn(badgeVariants({ variant: local.variant }), local.class)}
        {...rest}
      />
    </BadgeContext.Provider>
  );
}

const DOT_CLASSES: Partial<Record<BadgeVariant, string>> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

export type BadgeDotProps = ComponentProps<"span"> & {
  variant?: BadgeVariant;
};

export function BadgeDot(props: BadgeDotProps) {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  const ctxVariant = useBadgeVariant();
  const variant = () => local.variant ?? ctxVariant;
  const dotClass = () => DOT_CLASSES[variant()] ?? "bg-current";
  return (
    <span
      data-slot="badge-dot"
      class={cn("size-1.5 shrink-0 rounded-full", dotClass(), local.class)}
      {...rest}
    />
  );
}

export type BadgeSpinnerProps = ComponentProps<typeof Spinner>;

export function BadgeSpinner(props: BadgeSpinnerProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return <Spinner class={cn("size-3", local.class)} {...rest} />;
}

export { BadgeContext };
