"use client";

import * as React from "react";
import { format, isValid, addDays } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  value?: Date | string | null;
  onChange: (date: Date | undefined) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      className,
      placeholder = "Select date",
      disabled = false,
      id,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);

    const parsedDate = React.useMemo(() => {
      if (!value) return undefined;
      if (value instanceof Date) return isValid(value) ? value : undefined;
      const parsed = new Date(value);
      return isValid(parsed) ? parsed : undefined;
    }, [value]);

    const handleSelect = (date: Date | undefined) => {
      onChange(date);
      setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange(undefined);
    };

    const handlePreset = (daysToAdd: number) => {
      const target = addDays(new Date(), daysToAdd);
      onChange(target);
      setOpen(false);
    };

    return (
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            id={id}
            variant="outline"
            size="lg"
            type="button"
            disabled={disabled}
            className={cn(
              "w-full justify-between text-left font-normal px-3 h-10",
              !parsedDate && "text-muted-foreground",
              className
            )}
            {...props}
          >
            <div className="flex items-center min-w-0">
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {parsedDate ? format(parsedDate, "PPP") : placeholder}
              </span>
            </div>

            {parsedDate && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(undefined);
                  }
                }}
                className="p-1 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                title="Clear date"
              >
                <X className="size-3" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-3 z-[100] shadow-xl border bg-popover"
          align="start"
          side="bottom"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Quick presets for effortless date picking */}
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => handlePreset(0)}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => handlePreset(1)}
            >
              Tomorrow
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => handlePreset(3)}
            >
              +3 Days
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => handlePreset(7)}
            >
              +1 Week
            </Button>
          </div>

          <Calendar
            mode="single"
            selected={parsedDate}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  }
);

DatePicker.displayName = "DatePicker";
