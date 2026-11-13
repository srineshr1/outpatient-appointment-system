"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayProps, type DayButtonProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function CalendarDayCell({
  day,
  modifiers,
  className,
  children,
  ...props
}: DayProps) {
  return (
    <td
      {...props}
      className={cn("group/day relative p-0 text-center text-sm focus-within:relative focus-within:z-20", className)}
      data-day={day.date.toISOString()}
      data-range-start={modifiers.range_start ? "true" : undefined}
      data-range-end={modifiers.range_end ? "true" : undefined}
      data-range-middle={modifiers.range_middle ? "true" : undefined}
      data-selected={modifiers.selected ? "true" : undefined}
      data-today={modifiers.today ? "true" : undefined}
      data-outside={modifiers.outside ? "true" : undefined}
      data-focused={modifiers.focused ? "true" : undefined}
    >
      {children}
    </td>
  )
}

function CalendarDayButton({
  day,
  modifiers,
  className,
  ...props
}: DayButtonProps) {
  return (
    <button
      {...props}
      type="button"
      className={cn(
        "h-9 w-9 p-0 font-normal transition-colors flex items-center justify-center rounded-full hover:bg-muted/40 cursor-pointer",
        className
      )}
      data-range-start={modifiers.range_start ? "true" : undefined}
      data-range-end={modifiers.range_end ? "true" : undefined}
      data-range-middle={modifiers.range_middle ? "true" : undefined}
      data-selected={modifiers.selected ? "true" : undefined}
      data-today={modifiers.today ? "true" : undefined}
      data-outside={modifiers.outside ? "true" : undefined}
      data-focused={modifiers.focused ? "true" : undefined}
    />
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 w-fit mx-auto", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-fit",
        month: "space-y-4 w-fit",
        month_caption: "flex justify-center pt-1 relative items-center h-7",
        caption_label: "text-sm font-semibold text-ink",
        nav: "flex items-center justify-between absolute inset-x-0 top-1 h-7 w-full pointer-events-none z-10 px-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-surface hover:bg-muted/50 border border-hairline rounded-md p-0 opacity-70 hover:opacity-100 pointer-events-auto flex items-center justify-center cursor-pointer transition-opacity"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-surface hover:bg-muted/50 border border-hairline rounded-md p-0 opacity-70 hover:opacity-100 pointer-events-auto flex items-center justify-center cursor-pointer transition-opacity"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        range_start: "bg-blue-500/20 rounded-l-full",
        range_end: "bg-blue-500/20 rounded-r-full",
        range_middle: "bg-blue-500/20 rounded-none",
        selected: "text-white",
        today: "rounded-full bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-blue-500/10 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Day: CalendarDayCell,
        DayButton: CalendarDayButton,
        Chevron: ({ orientation, className: chevronClassName }) => {
          return orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", chevronClassName)} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", chevronClassName)} />
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
