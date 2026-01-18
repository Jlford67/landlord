"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setTheme } from "@/app/actions/theme";

type Theme = "light" | "dark";

type ThemeToggleClientProps = {
  initialTheme: Theme;
};

export default function ThemeToggleClient({
  initialTheme,
}: ThemeToggleClientProps) {
  const router = useRouter();
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setThemeState(nextTheme);
    await setTheme(nextTheme);
    router.refresh();
  };

  return (
    <div className="ll_side_themeCard">
      <span className="ll_side_themeLabel">Dark mode</span>
      {mounted ? (
        <button
          type="button"
          className={`ll_theme_toggle${theme === "dark" ? " is-on" : ""}`}
          aria-pressed={theme === "dark"}
          aria-label="Toggle dark mode"
          onClick={handleToggle}
        >
          <span className="ll_theme_toggleKnob" />
        </button>
      ) : (
        <div className="ll_theme_toggle ll_theme_togglePlaceholder" aria-hidden />
      )}
    </div>
  );
}
