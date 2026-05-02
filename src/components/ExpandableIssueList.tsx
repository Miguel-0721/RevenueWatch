"use client";

import { useRef, useState } from "react";

type ExpandableIssueListProps = {
  totalCount: number;
  toggleClassName: string;
  moreListClassName: string;
  moreListExpandedClassName: string;
  children: React.ReactNode;
  hiddenChildren: React.ReactNode;
};

export default function ExpandableIssueList({
  totalCount,
  toggleClassName,
  moreListClassName,
  moreListExpandedClassName,
  children,
  hiddenChildren,
}: ExpandableIssueListProps) {
  const [expanded, setExpanded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function handleToggle() {
    const previousTop = buttonRef.current?.getBoundingClientRect().top ?? 0;

    setExpanded((current) => !current);

    requestAnimationFrame(() => {
      const nextTop = buttonRef.current?.getBoundingClientRect().top ?? previousTop;
      const topDelta = nextTop - previousTop;

      if (topDelta !== 0) {
        window.scrollTo({
          top: window.scrollY + topDelta,
        });
      }
    });
  }

  return (
    <>
      {children}
      <div
        className={`${moreListClassName}${expanded ? ` ${moreListExpandedClassName}` : ""}`}
      >
        {hiddenChildren}
      </div>
      <button
        ref={buttonRef}
        type="button"
        className={toggleClassName}
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        {expanded ? "Show fewer" : `Show all ${totalCount} active alerts`}
      </button>
    </>
  );
}
