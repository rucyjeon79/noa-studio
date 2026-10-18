import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-[15px] font-semibold tracking-tight transition-[opacity,transform,background-color,color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985] active:opacity-90",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg",
        mark: "bg-mark text-mark-fg",
        secondary: "bg-surface-2 text-fg",
        ghost: "text-fg-muted hover:text-fg hover:bg-surface",
        outline: "bg-surface-2 text-fg",
        lock: "bg-transparent text-[#34c759] hover:bg-[#34c759]/10",
        unlock: "bg-transparent text-[#8e8e93] hover:bg-white/10",
      },
      size: {
        default: "h-11 min-h-11 rounded-[12px] px-4",
        sm: "h-9 min-h-9 rounded-[10px] px-3 text-[13px]",
        lg: "h-[50px] min-h-[50px] rounded-[14px] px-5 text-[17px]",
        icon: "size-11 min-h-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
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
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
