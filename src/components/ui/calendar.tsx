"use client"

import * as React from "react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = DayPickerProps

/** Resolve a Date to seed the visible month from DayPicker selection props. */
export const resolveCalendarSelectedMonth = (
  selected: DayPickerProps["selected"],
): Date | undefined => {
  if (selected instanceof Date) {
    return selected
  }
  if (Array.isArray(selected)) {
    const first = selected.find((value): value is Date => value instanceof Date)
    return first
  }
  if (selected && typeof selected === "object" && "from" in selected) {
    const from = (selected as { from?: Date }).from
    return from instanceof Date ? from : undefined
  }
  return undefined
}

export const calendarClassNames = (
  mode: DayPickerProps["mode"],
  overrides?: DayPickerProps["classNames"],
) => ({
  months: "flex flex-col gap-4 sm:flex-row sm:gap-4",
  month: "space-y-4",
  month_caption: "flex justify-center pt-1 relative items-center",
  caption_label: "text-sm font-medium",
  nav: "space-x-1 flex items-center",
  button_previous: cn(
    buttonVariants({ variant: "outline" }),
    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1",
  ),
  button_next: cn(
    buttonVariants({ variant: "outline" }),
    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1",
  ),
  month_grid: "w-full border-collapse space-y-1",
  weekdays: "flex",
  weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
  week: "flex w-full mt-2",
  day: cn(
    "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
    mode === "range"
      ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
      : "[&:has([aria-selected])]:rounded-md",
  ),
  day_button: cn(
    buttonVariants({ variant: "ghost" }),
    "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
  ),
  range_start: "day-range-start rounded-l-md",
  range_end: "day-range-end rounded-r-md",
  selected:
    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
  today: "bg-accent text-accent-foreground rounded-md",
  outside:
    "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
  disabled: "text-muted-foreground opacity-50",
  range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
  hidden: "invisible",
  ...overrides,
})

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  defaultMonth,
  month,
  selected,
  mode,
  ...props
}: CalendarProps) {
  const selectedMonth = resolveCalendarSelectedMonth(selected)
  const resolvedDefaultMonth = defaultMonth ?? month ?? selectedMonth

  return (
    <DayPicker
      locale={es}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      mode={mode}
      selected={selected}
      month={month}
      defaultMonth={resolvedDefaultMonth}
      classNames={calendarClassNames(mode, classNames)}
      components={{
        Chevron: ({ className, orientation, ...chevronProps }) => {
          const shared = { className: cn("h-4 w-4", className), ...chevronProps }
          switch (orientation) {
            case "left":
              return <ChevronLeft {...shared} />
            case "right":
              return <ChevronRight {...shared} />
            case "up":
              return <ChevronUp {...shared} />
            case "down":
              return <ChevronDown {...shared} />
            default:
              return <ChevronLeft {...shared} />
          }
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
