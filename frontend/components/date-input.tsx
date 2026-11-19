"use client";

import type { ComponentPropsWithoutRef } from "react";
import { formatDate } from "../lib/format";
import { parseDisplayDate } from "../lib/validation";
import { Icon } from "./icons";
import "./date-input.css";

type Props = Pick<ComponentPropsWithoutRef<"input">,
  "id" | "name" | "required" | "aria-invalid" | "aria-describedby"
> & {
  value: string;
  onValueChange: (value: string) => void;
  calendarLabel: string;
};

export default function DateInput({ value, onValueChange, calendarLabel, ...props }: Props) {
  return (
    <span className="date-input">
      <input {...props} className="date-input-text" type="text" placeholder="DD/MM/YYYY"
        autoComplete="off" spellCheck={false} value={value}
        onChange={(event) => onValueChange(event.currentTarget.value)} />
      <span className="date-input-calendar">
        <Icon name="calendar" size={16} />
        <input className="date-input-native" aria-label={calendarLabel} type="date"
          min="0001-01-01" max="9999-12-31" value={parseDisplayDate(value) ?? ""}
          onChange={(event) => onValueChange(formatDate(event.currentTarget.value))} />
      </span>
    </span>
  );
}
