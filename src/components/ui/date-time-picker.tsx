"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { CalendarIcon } from "lucide-react";

const FormSchema = z.object({
  time: z.date({
    required_error: "A date and time is required.",
  }),
});

export function DateTimePickerForm({
  value,
  onChange,
  required,
}: {
  value: string | null;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const defaultDate = value ? new Date(value) : undefined;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { time: defaultDate },
  });

  function handleDateSelect(date: Date | undefined) {
    if (date) {
      form.setValue("time", date);
      onChange(date.toISOString());
    }
  }

  function handleTimeChange(type: "hour" | "minute" | "ampm", val: string) {
    const now = new Date();
    const currentDate = form.getValues("time") || new Date();
    const newDate = new Date(currentDate);

    if (type === "hour") {
      const hour = parseInt(val, 10);
      newDate.setHours(newDate.getHours() >= 12 ? hour + 12 : hour);
    } else if (type === "minute") {
      newDate.setMinutes(parseInt(val, 10));
    } else if (type === "ampm") {
      const hours = newDate.getHours();
      if (val === "AM" && hours >= 12) newDate.setHours(hours - 12);
      if (val === "PM" && hours < 12) newDate.setHours(hours + 12);
    }

    if (
      newDate.toDateString() === now.toDateString() &&
      newDate.getTime() < now.getTime()
    ) {
      return;
    }

    form.setValue("time", newDate);
    onChange(newDate.toISOString());
  }

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="time"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <Popover modal={true} >
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-13 bg-transparent text-white outline-none placeholder:text-slate-400 border border-blue-500/30 rounded-xl px-4 py-3 w-full hover:bg-transparent hover:text-white",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    {field.value
                      ? format(field.value, "MM/dd/yyyy hh:mm aa")
                      : "MM/DD/YYYY hh:mm aa"}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[9999]" side="bottom" align="start">
                <div className="sm:flex">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={handleDateSelect}
                    initialFocus
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                  <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
                    {/* Hours */}
                    <ScrollArea className="w-64 sm:w-auto">
                      <div className="flex sm:flex-col p-2">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (hour) => (
                            <Button
                              key={hour}
                              size="icon"
                              type="button"
                              variant={
                                field.value &&
                                field.value.getHours() % 12 === hour % 12
                                  ? "default"
                                  : "ghost"
                              }
                              className="sm:w-full shrink-0 aspect-square"
                              onClick={() =>
                                handleTimeChange("hour", hour.toString())
                              }
                              disabled={
                                field.value &&
                                field.value.toDateString() === new Date().toDateString() &&
                                new Date().getHours() > (hour % 12)
                              }
                            >
                              {hour}
                            </Button>
                          )
                        )}
                      </div>
                      <ScrollBar orientation="horizontal" className="sm:hidden" />
                    </ScrollArea>
                    {/* Minutes */}
                    <ScrollArea className="w-64 sm:w-auto">
                      <div className="flex sm:flex-col p-2">
                        {Array.from({ length: 12 }, (_, i) => i * 5).map(
                          (minute) => (
                            <Button
                              key={minute}
                              size="icon"
                              type="button"
                              variant={
                                field.value &&
                                field.value.getMinutes() === minute
                                  ? "default"
                                  : "ghost"
                              }
                              className="sm:w-full shrink-0 aspect-square"
                              onClick={() =>
                                handleTimeChange("minute", minute.toString())
                              }
                            >
                              {minute.toString().padStart(2, "0")}
                            </Button>
                          )
                        )}
                      </div>
                      <ScrollBar orientation="horizontal" className="sm:hidden" />
                    </ScrollArea>
                    {/* AM/PM */}
                    <ScrollArea>
                      <div className="flex sm:flex-col p-2">
                        {["AM", "PM"].map((ampm) => (
                          <Button
                            key={ampm}
                            size="icon"
                            type="button"
                            variant={
                              field.value &&
                              ((ampm === "AM" && field.value.getHours() < 12) ||
                                (ampm === "PM" && field.value.getHours() >= 12))
                                ? "default"
                                : "ghost"
                            }
                            className="sm:w-full shrink-0 aspect-square"
                            onClick={() => handleTimeChange("ampm", ampm)}
                          >
                            {ampm}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {required && !field.value && (
              <FormMessage>A date and time is required.</FormMessage>
            )}
          </FormItem>
        )}
      />
    </Form>
  );
}