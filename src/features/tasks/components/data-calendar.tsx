import React, { useState, useMemo, useCallback, memo } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  format,
  getDay,
  parse,
  startOfWeek,
  addMonths,
  subMonths,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";

import { Button } from "@/components/ui/button";

import { EventCard } from "./event-card";

import { Task } from "../types";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "./data-calendar.css";

const locales = {
  "en-US": enUS
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales
});

interface DataCalendarProps {
  data: Task[];
};

interface CustomToolbarProps {
  date: Date;
  onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
};

const CustomToolbar = ({ date, onNavigate }: CustomToolbarProps) => {
  return (
    <div className="flex mb-4 gap-x-2 items-center w-full lg:w-auto justify-center lg:justify-start">
      <Button
        onClick={() => onNavigate("PREV")}
        variant="secondary"
        size="icon"
      >
        <ChevronLeftIcon className="size-4" />
      </Button>
      <div className="flex items-center border border-input rounded-md px-3 py-2 h-8 justify-center w-full lg:w-auto">
        <CalendarIcon className="size-4 mr-2" />
        <p className="text-sm">{format(date, "MMMM yyyy")}</p>
      </div>
      <Button
        onClick={() => onNavigate("NEXT")}
        variant="secondary"
        size="icon"
      >
        <ChevronRightIcon className="size-4" />
      </Button>
    </div>
  )
}

const calendarFormats = {
  weekdayFormat: (date: Date, culture?: string, loc?: typeof localizer) =>
    loc?.format(date, "EEE", culture) ?? "",
};

export const DataCalendar = memo(({
  data,
}: DataCalendarProps) => {
  const [value, setValue] = useState(
    data.length > 0 ? new Date(data[0].dueDate) : new Date()
  );

  const events = useMemo(
    () =>
      data.map((task) => ({
        start: new Date(task.dueDate),
        end: new Date(task.dueDate),
        title: task.name,
        project: task.project,
        assignee: task.assignee,
        status: task.status,
        id: task.$id,
      })),
    [data]
  );

  const maxDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }, []);

  const handleNavigate = useCallback((action: "PREV" | "NEXT" | "TODAY") => {
    if (action === "PREV") {
      setValue((v) => subMonths(v, 1));
    } else if (action === "NEXT") {
      setValue((v) => addMonths(v, 1));
    } else if (action === "TODAY") {
      setValue(new Date());
    }
  }, []);

  const components = useMemo(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventWrapper: ({ event }: any) => (
        <EventCard
          id={event.id}
          title={event.title}
          assignee={event.assignee}
          project={event.project}
          status={event.status}
        />
      ),
      toolbar: () => (
        <CustomToolbar date={value} onNavigate={handleNavigate} />
      ),
    }),
    [value, handleNavigate]
  );

  return (
    <Calendar
      localizer={localizer}
      date={value}
      events={events}
      views={["month"]}
      defaultView="month"
      toolbar
      showAllEvents
      className="h-full"
      max={maxDate}
      formats={calendarFormats}
      components={components}
    />
  );
});

DataCalendar.displayName = "DataCalendar";
