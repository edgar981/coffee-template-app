"use client";
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// Props = DayPicker props + your additions
export type CalendarProps = DayPickerProps & {
  className?: string
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
  month: "space-y-4",

  caption_label: "text-sm font-medium",

  nav: "space-x-1 flex items-center",

  button_previous: cn(
    buttonVariants({ variant: "outline" }),
    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1"
  ),
  button_next: cn(
    buttonVariants({ variant: "outline" }),
    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"
  ),

  weekdays: "flex",
  weekday:
    "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",

  week: "flex w-full mt-2",

  day: cn(
    buttonVariants({ variant: "ghost" }),
    "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
  ),

  selected:
    "bg-primary text-primary-foreground hover:bg-primary",
  today: "bg-accent text-accent-foreground",

  outside:
    "text-muted-foreground opacity-50",

  disabled:
    "text-muted-foreground opacity-50",

  range_start: "bg-primary text-primary-foreground",
  range_end: "bg-primary text-primary-foreground",
  range_middle:
    "bg-accent text-accent-foreground",
    
  ...classNames,
}}
      components={{
  PreviousMonthButton: ({ className, ...props }) => (
    <button {...props} className={cn(className)}>
      <ChevronLeft className="h-4 w-4" />
    </button>
  ),
  NextMonthButton: ({ className, ...props }) => (
    <button {...props} className={cn(className)}>
      <ChevronRight className="h-4 w-4" />
    </button>
  ),
}}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }