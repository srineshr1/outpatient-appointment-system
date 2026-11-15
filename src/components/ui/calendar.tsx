"use client"

import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayButtonProps } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function CalendarDayButton({
  day,
  modifiers,
  className,
  ...props
}: DayButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      {...props}
      type="button"
      data-day={day.isoDate}
      data-range-start={modifiers.range_start || undefined}
      data-range-end={modifiers.range_end || undefined}
      data-range-middle={modifiers.range_middle || undefined}
      data-selected={modifiers.selected || undefined}
      data-today={modifiers.today || undefined}
      data-outside={modifiers.outside || undefined}
      data-focused={modifiers.focused || undefined}
      className={cn(
        "flex size-9 items-center justify-center rounded-full p-0 text-sm font-normal text-ink",
        "hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30",
        "data-[range-middle=true]:rounded-none! data-[range-middle=true]:bg-transparent! data-[range-middle=true]:hover:bg-blue-500/10",
        className,
      )}
    />
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  formatters,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-fit p-3", className)}
      formatters={{
        formatWeekdayName: (date) =>
          date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
        ...formatters,
      }}
      classNames={{
        months: "relative flex w-fit flex-col",
        month: "flex w-fit flex-col gap-2",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-sm font-semibold text-ink",
        nav: "absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-between",
        button_previous:
          "inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-fill hover:text-ink",
        button_next:
          "inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-fill hover:text-ink",
        chevron: "size-4",
        month_grid:
          "w-full border-separate border-spacing-0 [&_thead]:block [&_tbody]:block [&_tr]:flex [&_tr]:w-full",
        weekdays: "flex",
        weekday: "flex h-8 w-9 items-center justify-center text-[0.8rem] font-normal text-muted",
        week: "mt-1 flex w-full",
        day: cn(
          "group/day relative size-9 overflow-hidden p-0 text-center text-sm",
          "[&:first-child[data-selected=true]]:rounded-l-full",
          "[&:last-child[data-selected=true]]:rounded-r-full",
        ),
        day_button: "size-9",
        range_start: "rounded-l-full bg-blue-500/20",
        range_middle: "bg-blue-500/20",
        range_end: "rounded-r-full bg-blue-500/20",
        selected: "text-ink",
        today: "rounded-full",
        outside: "text-muted opacity-45 aria-selected:text-ink aria-selected:opacity-100",
        disabled: "text-muted opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        DayButton: CalendarDayButton,
        Chevron: ({ orientation, className: chevronClassName }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("size-4", chevronClassName)} />
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("size-4", chevronClassName)} />
          }
          return <ChevronDown className={cn("size-4", chevronClassName)} />
        },
        ...components,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
