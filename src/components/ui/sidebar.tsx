
"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem" // Default width when expanded
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3.5rem" // Width when collapsed to icons only
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)

    // Get initial state from cookie or defaultOpen
     const getInitialOpenState = () => {
        if (typeof window !== 'undefined') {
            const cookieValue = document.cookie
                .split('; ')
                .find(row => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
                ?.split('=')[1];
            if (cookieValue) {
                return cookieValue === 'true';
            }
        }
        return defaultOpen;
    };


    // Internal state management
    const [_open, _setOpen] = React.useState(getInitialOpenState());
    const open = openProp ?? _open; // Use controlled prop if available

    // Callback to update state and cookie
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const newOpenState = typeof value === "function" ? value(open) : value;

        // Update cookie
         if (typeof window !== 'undefined') {
            document.cookie = `${SIDEBAR_COOKIE_NAME}=${newOpenState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
        }

        // Call external handler or update internal state
        if (setOpenProp) {
          setOpenProp(newOpenState);
        } else {
          _setOpen(newOpenState);
        }
      },
      [open, setOpenProp]
    );


    // Helper to toggle the sidebar.
    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((current) => !current) // Use functional update for mobile
        : setOpen((current) => !current); // Use functional update for desktop
    }, [isMobile, setOpen, setOpenMobile]);

    // Adds a keyboard shortcut to toggle the sidebar.
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar])

    // We add a state so that we can do data-state="expanded" or "collapsed".
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON, // Use the constant
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              "group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar",
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"

const Sidebar = React.forwardRef<
  HTMLDivElement,
  // Remove open and onOpenChange from here, they are managed by context/provider
  Omit<React.ComponentProps<"div">, 'open' | 'onOpenChange'> & {
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset"
    collapsible?: "offcanvas" | "icon" | "none"
    // Allow explicitly passing open and onOpenChange for controlled mode if needed externally
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      side = "left",
      variant = "sidebar",
      collapsible = "icon", // Default to icon collapsing
      className,
      children,
      // Capture open and onOpenChange explicitly to prevent spreading onto div
      open: _openProp,
      onOpenChange: _onOpenChangeProp,
      ...restProps // All other valid div props
    },
    ref
  ) => {
    // Get state and setters from context
    const { isMobile, state: desktopState, openMobile, setOpenMobile } = useSidebar();


    if (collapsible === "none") {
      return (
        <div
          className={cn(
            "flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground",
            className
          )}
          ref={ref}
          {...restProps} // Pass remaining valid props
        >
          {children}
        </div>
      )
    }

    // Mobile uses Sheet
    if (isMobile) {
      // Pass the _onOpenChangeProp if provided, otherwise use context's setOpenMobile
      const handleMobileOpenChange = _onOpenChangeProp || setOpenMobile;
      // Use _openProp if provided, otherwise use context's openMobile
      const currentMobileOpenState = _openProp ?? openMobile;

      return (
        <Sheet open={currentMobileOpenState} onOpenChange={handleMobileOpenChange}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            className="w-[--sidebar-width-mobile] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
             // Use mobile width variable
            style={{ '--sidebar-width-mobile': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
            side={side}
            {...restProps} // Pass valid props to SheetContent (check SheetContent's valid props)
          >
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      )
    }

     // Desktop uses div structure
     // Use _openProp if provided, otherwise use context's state
     const currentDesktopState = _openProp !== undefined ? (_openProp ? 'expanded' : 'collapsed') : desktopState;

    return (
      // The outer div acts as a container and placeholder for layout adjustments
      <div
        ref={ref}
        className={cn(
            "group peer hidden md:block text-sidebar-foreground",
            // No width setting here, width is controlled by the inner fixed element and the spacer
             className // Apply className to the outer container
        )}
        data-state={currentDesktopState}
        data-collapsible={collapsible} // Use the prop value
        data-variant={variant}
        data-side={side}
        {...restProps} // Apply other valid div props to the outer container
      >
        {/* Spacer div to push main content. Width changes based on sidebar state. */}
        <div
          className={cn(
            "duration-200 relative h-svh bg-transparent transition-[width] ease-linear",
             // When expanded, use full sidebar width
            "w-[var(--sidebar-width)]",
            // When collapsed (icon mode), use icon width
            currentDesktopState === "collapsed" && collapsible === "icon" && "w-[var(--sidebar-width-icon)]",
             // When collapsed (offcanvas mode), width is 0
            currentDesktopState === "collapsed" && collapsible === "offcanvas" && "w-0"
            // Floating/inset might need adjustments, but basics covered
          )}
        />
        {/* The actual fixed sidebar content */}
        <div
          className={cn(
            "duration-200 fixed inset-y-0 z-10 hidden h-svh transition-[left,right,width] ease-linear md:flex",
            // Width based on state and collapsible mode
            currentDesktopState === "expanded" && "w-[var(--sidebar-width)]",
            currentDesktopState === "collapsed" && collapsible === "icon" && "w-[var(--sidebar-width-icon)]",
            // Positioning based on side and state/mode
            side === "left" && currentDesktopState === "expanded" && "left-0",
            side === "left" && currentDesktopState === "collapsed" && collapsible === "icon" && "left-0",
            side === "left" && currentDesktopState === "collapsed" && collapsible === "offcanvas" && "left-[calc(var(--sidebar-width)*-1)]", // Offscreen left
            side === "right" && currentDesktopState === "expanded" && "right-0",
            side === "right" && currentDesktopState === "collapsed" && collapsible === "icon" && "right-0",
            side === "right" && currentDesktopState === "collapsed" && collapsible === "offcanvas" && "right-[calc(var(--sidebar-width)*-1)]", // Offscreen right
             // Base styling for the content container
            "border-border",
             side === 'left' ? 'border-r' : 'border-l',
             // Apply additional classes passed via props if needed (though usually applied to outer)
             // className // Apply className here if specifically needed for the fixed part

             // Adjust padding/margins for floating/inset - simplified, might need more specifics
              variant === "floating" || variant === "inset" ? "p-2" : ""

          )}
          // Removed ...props from here to avoid conflicts like className duplication
        >
          <div
            data-sidebar="sidebar"
            className={cn(
                "flex h-full w-full flex-col bg-sidebar overflow-hidden", // Added overflow-hidden
                variant === "floating" && "rounded-lg border border-sidebar-border shadow"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    )
  }
)
Sidebar.displayName = "Sidebar"

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar, isMobile } = useSidebar()

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      // Hide on desktop if sidebar is collapsed, always show on mobile
      className={cn("h-8 w-8 rounded-full hover:bg-primary/10", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft style={{ color: 'hsl(var(--primary))' }}/> {/* Use primary color */}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

// SidebarRail is potentially less useful if using 'icon' collapsible mode by default
// Keeping it for now, but its visual effect might differ.
const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      ref={ref}
      data-sidebar="rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
        "[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
         // Hide rail if collapsible mode is 'icon' as it doesn't use the rail concept
         "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarRail.displayName = "SidebarRail"

const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
   // Get sidebar state to adjust margins correctly
    const { state: sidebarState, isMobile } = useSidebar();

  return (
    <main
      ref={ref}
      className={cn(
        "relative flex min-h-svh flex-1 flex-col bg-background transition-[margin-left,margin-right] duration-200 ease-linear",
        // Apply margin based on sidebar state only on desktop
        !isMobile && sidebarState === 'expanded' && "md:ml-[var(--sidebar-width)]", // Assuming left side default
        !isMobile && sidebarState === 'collapsed' && "md:ml-[var(--sidebar-width-icon)]", // Assuming left side default
         // Handle right side if needed based on `side` prop (needs access or logic)

        // Original inset styles (may need review based on new structure)
         "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))]",
         "md:peer-data-[variant=inset]:m-2",
         // These might conflict with direct margin setting above
         // "md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2", // Review this
         // "md:peer-data-[variant=inset]:ml-0", // Review this
         "md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        className
      )}
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
         // Hide text input when collapsed in icon mode
        "group-data-[collapsible=icon][data-state=collapsed]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarInput.displayName = "SidebarInput"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn(
          "flex flex-col p-2", // Removed gap-2, rely on children spacing or add selectively
           // Center items when collapsed in icon mode
          "group-data-[collapsible=icon][data-state=collapsed]:items-center",
          className
      )}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn(
          "flex flex-col gap-2 p-2 mt-auto", // Added mt-auto to push to bottom
           // Center items when collapsed in icon mode
          "group-data-[collapsible=icon][data-state=collapsed]:items-center",
          className
      )}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn(
          "mx-2 w-auto bg-sidebar-border",
          // Hide separator when collapsed in icon mode (optional, maybe keep?)
          // "group-data-[collapsible=icon][data-state=collapsed]:hidden",
          className
      )}
      {...props}
    />
  )
})
SidebarSeparator.displayName = "SidebarSeparator"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden", // Ensure x is hidden
         // Adjust padding/overflow when collapsed?
         // "group-data-[collapsible=icon][data-state=collapsed]:overflow-hidden", // Might hide tooltips if applied here
        className
      )}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn(
          "relative flex w-full min-w-0 flex-col p-2",
           // Center items when collapsed in icon mode? Might affect layout.
          // "group-data-[collapsible=icon][data-state=collapsed]:items-center",
          className
      )}
      {...props}
    />
  )
})
SidebarGroup.displayName = "SidebarGroup"

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opacity] ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
         // Hide label completely when collapsed in icon mode
        "group-data-[collapsible=icon][data-state=collapsed]:absolute group-data-[collapsible=icon][data-state=collapsed]:-left-full group-data-[collapsible=icon][data-state=collapsed]:opacity-0", // Move off-screen and hide
        className
      )}
      {...props}
    />
  )
})
SidebarGroupLabel.displayName = "SidebarGroupLabel"

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean, showOnHover?: boolean } // Added showOnHover type
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => { // Added showOnHover prop
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
         // Hide action button when collapsed in icon mode
        "group-data-[collapsible=icon][data-state=collapsed]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className
      )}
      {...props}
    />
  )
})
SidebarGroupAction.displayName = "SidebarGroupAction"

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn(
        "w-full text-sm",
         // Potentially hide content when collapsed? Or rely on menu items hiding themselves.
        // "group-data-[collapsible=icon][data-state=collapsed]:hidden",
        className
    )}
    {...props}
  />
))
SidebarGroupContent.displayName = "SidebarGroupContent"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn(
        "flex w-full min-w-0 flex-col gap-1",
         // Center items when collapsed in icon mode
        "group-data-[collapsible=icon][data-state=collapsed]:px-0", // Remove padding
        className
    )}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn(
        "group/menu-item relative",
         // Adjust padding/margin when collapsed
        "group-data-[collapsible=icon][data-state=collapsed]:px-2", // Add padding for collapsed icons
        className
    )}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground",
   // Collapsed state: specific size and center icon
   "group-data-[collapsible=icon][data-state=collapsed]:size-8 group-data-[collapsible=icon][data-state=collapsed]:justify-center group-data-[collapsible=icon][data-state=collapsed]:p-0",
   // Hide text span when collapsed
   "[&>span:last-child]:group-data-[collapsible=icon][data-state=collapsed]:hidden",
   "[&>span:last-child]:truncate", // Keep truncate for expanded state
   "[&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm", // Adjusted lg size
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size = "default",
      tooltip,
      className,
      children, // Capture children to manage span visibility
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const { isMobile, state } = useSidebar()

    const buttonContent = (
       <>
           {/* Render children directly, assuming icon is first */}
           {children}
           {/* Text content (last span) is handled by CSS for hiding */}
       </>
     );

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      >
         {buttonContent}
      </Comp>
    )

    if (!tooltip) {
      return button
    }

    if (typeof tooltip === "string") {
      tooltip = {
        children: tooltip,
      }
    }

    return (
      <Tooltip>
        {/* Ensure TooltipTrigger works correctly with collapsed state */}
        <TooltipTrigger asChild disabled={state === 'expanded' || isMobile}>
            {button}
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
           // Control visibility based on sidebar state and mobile status
           // hidden={state === 'expanded' || isMobile} // Original logic, might need adjustment
          className={cn(
              "data-[state=closed]:hidden", // Hide if tooltip itself is closed
              (state === 'expanded' || isMobile) && "hidden" // Explicitly hide if expanded or mobile
          )}
          {...tooltip}
        />
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
         // Hide action when collapsed in icon mode
        "group-data-[collapsible=icon][data-state=collapsed]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuAction.displayName = "SidebarMenuAction"

const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="menu-badge"
    className={cn(
      "absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none pointer-events-none",
      "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
      "peer-data-[size=sm]/menu-button:top-1",
      "peer-data-[size=default]/menu-button:top-1.5",
      "peer-data-[size=lg]/menu-button:top-2.5",
      // Hide badge text when collapsed, maybe show a dot?
      "group-data-[collapsible=icon][data-state=collapsed]:hidden",
      className
    )}
    {...props}
  />
))
SidebarMenuBadge.displayName = "SidebarMenuBadge"

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn(
          "rounded-md h-8 flex gap-2 px-2 items-center",
          // Adjust skeleton for collapsed state
          "group-data-[collapsible=icon][data-state=collapsed]:justify-center group-data-[collapsible=icon][data-state=collapsed]:p-0 group-data-[collapsible=icon][data-state=collapsed]:size-8",
          className
      )}
      {...props}
    >
       {/* Icon Skeleton */}
        {(showIcon || className?.includes('group-data-[collapsible=icon][data-state=collapsed]')) && ( // Always show icon skeleton if collapsed
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      {/* Text Skeleton - Hide when collapsed */}
       <Skeleton
        className={cn(
            "h-4 flex-1 max-w-[--skeleton-width]",
            "group-data-[collapsible=icon][data-state=collapsed]:hidden" // Hide text part when collapsed
        )}
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
})
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton"

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu-sub"
    className={cn(
      "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5",
       // Hide sub-menu when collapsed
      "group-data-[collapsible=icon][data-state=collapsed]:hidden",
      className
    )}
    {...props}
  />
))
SidebarMenuSub.displayName = "SidebarMenuSub"

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>((props, ref) => (
     // Sub-items are inherently hidden when the parent menu is collapsed via SidebarMenuSub
     <li ref={ref} {...props} />
 ))
SidebarMenuSubItem.displayName = "SidebarMenuSubItem"


const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean
    size?: "sm" | "md"
    isActive?: boolean
  }
>(({ asChild = false, size = "md", isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
         // Hide sub-button when collapsed (via parent SidebarMenuSub)
         // "group-data-[collapsible=icon][data-state=collapsed]:hidden", // This might be redundant if SidebarMenuSub hides it
        className
      )}
      {...props}
    />
  )
})
SidebarMenuSubButton.displayName = "SidebarMenuSubButton"

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}


