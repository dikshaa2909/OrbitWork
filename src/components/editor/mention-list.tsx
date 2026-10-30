"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { MemberAvatar } from "@/features/members/components/member-avatar";

export interface MentionItem {
  id: string;
  name: string;
  email: string;
}

export interface MentionListProps {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, MentionListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command({ id: item.id, label: item.name || item.email });
      }
    };

    const upHandler = () => {
      setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
      setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
      selectItem(selectedIndex);
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          upHandler();
          return true;
        }

        if (event.key === "ArrowDown") {
          downHandler();
          return true;
        }

        if (event.key === "Enter") {
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    if (props.items.length === 0) {
      return (
        <div className="bg-popover border border-border text-muted-foreground text-xs p-2 rounded-md shadow-md">
          No members found
        </div>
      );
    }

    return (
      <div className="bg-popover border border-border text-popover-foreground rounded-lg shadow-lg p-1 min-w-[180px] max-h-[220px] overflow-y-auto z-50">
        {props.items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            onClick={() => selectItem(index)}
            className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
              index === selectedIndex
                ? "bg-accent text-accent-foreground font-medium"
                : "hover:bg-muted"
            }`}
          >
            <MemberAvatar name={item.name} className="size-5 text-[10px]" />
            <div className="truncate">
              <span className="block truncate font-medium">{item.name}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {item.email}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = "MentionList";

