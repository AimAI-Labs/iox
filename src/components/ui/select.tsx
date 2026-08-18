import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => {
    return (
      <div className={cn("relative flex items-center w-full", wrapperClassName)}>
        <select
          ref={ref}
          className={cn(
            "flex h-8 w-full appearance-none rounded-lg border border-input/80 bg-background/50 px-2.5 py-1 pr-7 text-xs shadow-none transition-colors focus-visible:outline-none focus-visible:ring-1.5 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 text-foreground cursor-pointer",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={13}
          className="pointer-events-none absolute right-2 text-muted-foreground opacity-60"
        />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
