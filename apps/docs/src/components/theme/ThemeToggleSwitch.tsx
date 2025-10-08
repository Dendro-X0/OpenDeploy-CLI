"use client";

import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type React from "react";

/**
 * ThemeToggleSwitch
 * Defers theme-dependent rendering until after client mount to avoid hydration mismatches.
 */
export function ThemeToggleSwitch(): React.ReactElement {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect((): void => {
    setMounted(true);
  }, []);
  const toggleTheme = (): void => {
    const next = resolvedTheme === "light" ? "dark" : "light";
    setTheme(next);
  };
  if (!mounted) {
    return (
      <button type="button" className="relative inline-flex h-8 w-14 items-center rounded-full bg-muted transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 flex-shrink-0">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-background shadow-lg" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative inline-flex h-8 w-14 items-center rounded-full bg-muted transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 flex-shrink-0"
      role="switch"
      aria-checked={resolvedTheme === "dark"}
      aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
    >
      <motion.div
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-background shadow-lg"
        animate={{ x: resolvedTheme === "dark" ? 28 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <motion.div
          animate={{
            rotate: resolvedTheme === "dark" ? 0 : 180,
            scale: resolvedTheme === "dark" ? 1 : 0.8,
          }}
          transition={{ duration: 0.2 }}
        >
          {resolvedTheme === "dark" ? (
            <Moon className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Sun className="h-3 w-3 text-yellow-500" />
          )}
        </motion.div>
      </motion.div>
    </button>
  );
}