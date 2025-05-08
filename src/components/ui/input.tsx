import * as React from "react"

import { cn } from "@/lib/utils"

// Explicitly define the props type
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}


const Input = React.forwardRef<HTMLInputElement, InputProps>( // Use InputProps here
  ({ className, type, disabled, ...props }, ref) => { // Destructure disabled prop
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
           disabled && "bg-muted" // Add specific styling for disabled state if needed
        )}
        ref={ref}
        disabled={disabled} // Pass disabled prop to the input element
        {...props} // Spread the rest of the props
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
