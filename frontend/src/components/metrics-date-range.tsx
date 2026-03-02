"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { DateRangeValue, TimeRange } from "@/types/metrics"

const PRESETS: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1H" },
  { value: "6h", label: "6H" },
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
]

interface MetricsDateRangeProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
}

export function MetricsDateRange({ value, onChange }: MetricsDateRangeProps) {
  const [open, setOpen] = useState(false)
  const [pickerFrom, setPickerFrom] = useState<Date | undefined>(
    value.type === "custom" ? value.from : undefined
  )
  const [pickerTo, setPickerTo] = useState<Date | undefined>(
    value.type === "custom" ? value.to : undefined
  )

  const activePreset = value.type === "preset" ? value.preset : null

  function handlePreset(preset: TimeRange) {
    onChange({ type: "preset", preset })
  }

  function handleApplyCustom() {
    if (pickerFrom && pickerTo && pickerFrom < pickerTo) {
      onChange({ type: "custom", from: pickerFrom, to: pickerTo })
      setOpen(false)
    }
  }

  const customLabel =
    value.type === "custom"
      ? `${format(value.from, "MMM d HH:mm")} – ${format(value.to, "MMM d HH:mm")}`
      : null

  return (
    <div className="flex items-center gap-1">
      {/* Preset chips */}
      <div className="flex items-center rounded-md border bg-background">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
              activePreset === p.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={value.type === "custom" ? "default" : "outline"}
            size="sm"
            className="h-[30px] gap-1.5 text-xs"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {customLabel || "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-3">
            <div className="flex gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">From</p>
                <Calendar
                  mode="single"
                  selected={pickerFrom}
                  onSelect={(d) => {
                    if (d) {
                      // Keep existing time or set to start of day
                      const from = new Date(d)
                      if (pickerFrom) {
                        from.setHours(pickerFrom.getHours(), pickerFrom.getMinutes())
                      } else {
                        from.setHours(0, 0, 0, 0)
                      }
                      setPickerFrom(from)
                    }
                  }}
                  disabled={(d) => d > new Date()}
                />
                <div className="flex items-center gap-1 px-1">
                  <input
                    type="time"
                    className="flex h-7 w-full rounded-md border bg-background px-2 text-xs"
                    value={pickerFrom ? format(pickerFrom, "HH:mm") : ""}
                    onChange={(e) => {
                      if (pickerFrom && e.target.value) {
                        const [h, m] = e.target.value.split(":").map(Number)
                        const d = new Date(pickerFrom)
                        d.setHours(h, m, 0, 0)
                        setPickerFrom(d)
                      }
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">To</p>
                <Calendar
                  mode="single"
                  selected={pickerTo}
                  onSelect={(d) => {
                    if (d) {
                      const to = new Date(d)
                      if (pickerTo) {
                        to.setHours(pickerTo.getHours(), pickerTo.getMinutes())
                      } else {
                        to.setHours(23, 59, 59, 0)
                      }
                      setPickerTo(to)
                    }
                  }}
                  disabled={(d) => d > new Date()}
                />
                <div className="flex items-center gap-1 px-1">
                  <input
                    type="time"
                    className="flex h-7 w-full rounded-md border bg-background px-2 text-xs"
                    value={pickerTo ? format(pickerTo, "HH:mm") : ""}
                    onChange={(e) => {
                      if (pickerTo && e.target.value) {
                        const [h, m] = e.target.value.split(":").map(Number)
                        const d = new Date(pickerTo)
                        d.setHours(h, m, 0, 0)
                        setPickerTo(d)
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <p className="text-xs text-muted-foreground">
                {pickerFrom && pickerTo
                  ? `${format(pickerFrom, "MMM d HH:mm")} – ${format(pickerTo, "MMM d HH:mm")}`
                  : "Select start and end dates"}
              </p>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!pickerFrom || !pickerTo || pickerFrom >= pickerTo}
                onClick={handleApplyCustom}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
