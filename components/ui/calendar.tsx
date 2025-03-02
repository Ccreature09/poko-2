"use client"

import * as React from "react"
import ReactCalendar from "react-calendar"
import 'react-calendar/dist/Calendar.css'
import { cn } from "@/lib/utils"

export interface CalendarProps extends React.ComponentProps<typeof ReactCalendar> {
  className?: string;
}

function Calendar({
  className,
  ...props
}: CalendarProps) {
  return (
    <ReactCalendar
      className={cn("rounded-md border", className)}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
