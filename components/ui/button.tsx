import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:brightness-95",
        secondary: "bg-card-2 text-fg hover:bg-border",
        outline: "border border-border bg-card text-fg hover:bg-card-2",
        ghost: "text-fg hover:bg-card-2",
        danger: "bg-danger text-white hover:brightness-95",
      },
      size: { md: "h-12", sm: "h-11 px-4 text-sm", lg: "h-14 text-base", icon: "h-11 w-11 px-0" },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
