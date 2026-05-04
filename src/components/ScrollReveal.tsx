"use client";

import {
  type CSSProperties,
  type ElementType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./ScrollReveal.module.css";

type ScrollRevealProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  delayMs?: number;
  style?: CSSProperties;
};

export default function ScrollReveal({
  as: Component = "div",
  children,
  className,
  delayMs = 0,
  style,
}: ScrollRevealProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <Component
      ref={ref}
      className={`${styles.reveal}${visible ? ` ${styles.visible}` : ""}${className ? ` ${className}` : ""}`}
      style={
        {
          ...style,
          ["--reveal-delay" as string]: `${delayMs}ms`,
        } as CSSProperties
      }
    >
      {children}
    </Component>
  );
}
