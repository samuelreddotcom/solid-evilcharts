/**
 * Button — ark.button + cva variants + optional loading state.
 *
 * Loading: `loading` disables the button and shows a spinner. Optionally
 * `loadingText` replaces the children while loading; `spinnerPlacement`
 * ("start" by default) controls which side the spinner sits on. Pass a
 * custom `spinner` to override the default <Spinner />.
 *
 * Usage:
 *   <Button>Save</Button>
 *   <Button variant="brand">Save</Button>
 *   <Button loading>Save</Button>                       // disabled, spinner replaces nothing
 *   <Button loading loadingText="Saving…">Save</Button> // spinner + "Saving…"
 *   <Button loading spinnerPlacement="end">Save</Button>
 *   <Button asChild={(p) => <a href="/foo" {...p()}>Go</a>} variant="ghost" />
 */
import { ark, type HTMLArkProps } from "@ark-ui/solid";
import { cva, type VariantProps } from "class-variance-authority";
import {
  createContext,
  type JSX,
  mergeProps,
  Show,
  splitProps,
  useContext,
} from "solid-js";

import { cn } from "../../../lib/cn";
import { Spinner } from "../spinner/spinner";

export const buttonVariants = cva(
  [
    "group/button",
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap",
    "rounded-md border border-transparent bg-clip-padding",
    "text-sm font-medium",
    "transition-all outline-none select-none",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
    "active:not-aria-[haspopup]:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:bg-foreground/90",
        outline:
          "border-border bg-background text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        brand: "bg-brand text-brand-foreground hover:bg-brand/90",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/80 focus-visible:ring-destructive/20",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface LoadingProps {
  /** If true, disable the button and show a spinner. */
  loading?: boolean;
  /** Optional text to show in place of children while loading. */
  loadingText?: JSX.Element;
  /** Override the default spinner. */
  spinner?: JSX.Element;
  /** Which side the spinner sits on. Defaults to "start". */
  spinnerPlacement?: "start" | "end";
}

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export type ButtonProps = HTMLArkProps<"button"> &
  ButtonVariantProps &
  LoadingProps;

/**
 * Context lets a parent (typically <ButtonGroup>) declare variant props once
 * and have all descendant Buttons inherit them. Explicit props on the Button
 * still win — `mergeProps(ctx, props)` puts later sources first.
 */
export const ButtonContext = createContext<ButtonVariantProps>();
export const useButtonContext = () => useContext(ButtonContext);

export function Button(rawProps: ButtonProps) {
  const ctx = useButtonContext();
  const props = mergeProps(
    { variant: ctx?.variant, size: ctx?.size },
    rawProps,
  );

  const [local, others] = splitProps(props, [
    "class",
    "variant",
    "size",
    "loading",
    "loadingText",
    "spinner",
    "spinnerPlacement",
    "disabled",
    "children",
  ]);

  const placement = () => local.spinnerPlacement ?? "start";
  const renderSpinner = () => local.spinner ?? <Spinner class="size-4" />;

  return (
    <ark.button
      data-slot="button"
      class={cn(
        buttonVariants({ variant: local.variant, size: local.size }),
        local.class,
      )}
      disabled={local.loading || local.disabled}
      {...others}
    >
      <Show when={local.loading} fallback={local.children}>
        <Show when={placement() === "start"}>{renderSpinner()}</Show>
        {local.loadingText ?? local.children}
        <Show when={placement() === "end"}>{renderSpinner()}</Show>
      </Show>
    </ark.button>
  );
}
