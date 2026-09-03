import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "border-2 border-destructive text-destructive hover:bg-destructive/90 hover:text-white/90",
        // `hover:bg-white/30` used to sit on buttonOutline. On a light page
        // that reads as a faint lift, but over a dark surface a 30% white
        // wash turns flat grey — and with hover:text-primary on top it came
        // out grey-with-blue. Now that this app has a dark theme, that hits
        // the dashboard sidebar, which uses this variant. kioscart-v1 fixed
        // the same line for the same reason; a primary tint works in both.
        //
        // outline/outline1 hovered to `bg-seconday/80` — "secondary"
        // misspelled, so Tailwind emitted nothing and those buttons had no
        // hover at all. Spelling it correctly would give a loud cyan wash
        // (--secondary is 199 89% 48%), so they follow the same tint.
        buttonOutline:
          "border border-input bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/40",
        outline:
          "border border-input bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/40",
        outline1: "bg-background hover:bg-primary/10 hover:text-primary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-primary/10 hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "gradient-primary text-primary-foreground shadow-glow hover:shadow-hover hover:scale-105 transform",
        heroOutline:
          "border-2 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground hover:text-primary backdrop-blur-sm",
        eventOutline:
          "border-2 border-event-foreground/30 bg-event-foreground/10 text-white hover:bg-accent-foreground hover:text-accent backdrop-blur-sm",
        event:
          "gradient-event text-primary-foreground shadow-card hover:shadow-hover hover:scale-105 transform",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-16 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
