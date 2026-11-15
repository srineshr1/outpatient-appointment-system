"use client";

import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar-range-select-utils/calendar";

const rangeClassNames = {
  range_start: "bg-blue-500/20 rounded-l-full",
  range_end: "bg-blue-500/20 rounded-r-full",
  range_middle: "bg-blue-500/20",
  day_button:
    "data-[range-end=true]:rounded-full! data-[range-start=true]:rounded-full! data-[range-start=true]:bg-blue-500! data-[range-start=true]:text-white! data-[range-start=true]:group-data-[focused=true]/day:ring-blue-500/20 data-[range-end=true]:bg-blue-500! data-[range-end=true]:text-white! data-[range-end=true]:group-data-[focused=true]/day:ring-blue-500/20 data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-transparent hover:rounded-full",
  today:
    "rounded-full bg-fill data-[selected=true]:bg-transparent! data-[selected=true]:rounded-none! [&_button[data-range-middle=true]]:bg-transparent!",
};

export interface CalendarRangeSelectProps {
  dateRange?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
  className?: string;
  defaultMonth?: Date;
}

export function CalendarRangeSelect({
  dateRange,
  onSelect,
  className = "rounded-md border",
  defaultMonth,
}: CalendarRangeSelectProps) {
  return (
    <Calendar
      mode="range"
      defaultMonth={defaultMonth ?? dateRange?.from}
      selected={dateRange}
      onSelect={onSelect}
      className={className}
      classNames={rangeClassNames}
    />
  );
}

const CustomRangeSelectDemo = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2026, 5, 4),
    to: new Date(2026, 5, 17),
  });

  return (
    <>
      <Calendar
        mode="range"
        defaultMonth={dateRange?.from}
        selected={dateRange}
        onSelect={setDateRange}
        className="rounded-md border"
        classNames={rangeClassNames}
      />
    </>
  );
};

export default CustomRangeSelectDemo;
