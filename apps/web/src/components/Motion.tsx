"use client";

import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";

/**
 * Shared motion primitives so animation feel stays consistent across pages.
 * Spring presets tuned for "alive but not bouncy" — civic-product polish.
 */

const ENTRY_SPRING = { type: "spring", stiffness: 220, damping: 28, mass: 0.8 } as const;

export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: ENTRY_SPRING,
};

export function MotionDiv(props: ComponentProps<typeof motion.div>) {
  return <motion.div {...props} />;
}

/** Container that staggers its motion-child reveals. */
export function Stagger({
  children,
  delay = 0,
  step = 0.06,
  className,
}: {
  children: ReactNode;
  delay?: number;
  step?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: step, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { ...ENTRY_SPRING, delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Counter that springs from 0 → target the first time it scrolls into view. */
export function Counter({
  to,
  duration = 1.2,
  suffix = "",
  prefix = "",
  className,
  format = (n) => n.toLocaleString("en-IN"),
}: {
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, duration: duration * 1000 });
  const rounded = useTransform(spring, (latest) => format(Math.round(latest)));

  useEffect(() => {
    if (inView) mv.set(to);
  }, [inView, to, mv]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}

/** Smooth height + opacity transition on mount/unmount. */
export function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={false}
      animate={open ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{ overflow: "hidden" }}
    >
      {children}
    </motion.div>
  );
}
