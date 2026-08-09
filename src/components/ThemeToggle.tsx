import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_KEY = "clubbase.theme";
let transitionTimer: number | undefined;

function applyTheme(dark: boolean) {
  const root = document.documentElement;
  if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
  root.classList.add("theme-changing");
  // Commit the current palette before swapping variables so the browser can
  // interpolate instead of painting both themes in one frame.
  void root.offsetWidth;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  transitionTimer = window.setTimeout(() => {
    root.classList.remove("theme-changing");
    transitionTimer = undefined;
  }, 350);
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    setDark(next);
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="group fixed right-3 top-3 z-[100] h-10 w-20 rounded-full border border-border/70 bg-card/90 p-1 text-card-foreground shadow-lg shadow-foreground/10 backdrop-blur-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span
        className="absolute left-1 top-1 z-10 grid size-8 place-items-center"
        aria-hidden="true"
      >
        <Sun
          className={`size-4 transition-colors duration-300 ${dark ? "text-muted-foreground" : "text-primary-foreground"}`}
        />
      </span>
      <span
        className="absolute right-1 top-1 z-10 grid size-8 place-items-center"
        aria-hidden="true"
      >
        <Moon
          className={`size-4 transition-colors duration-300 ${dark ? "text-primary-foreground" : "text-muted-foreground"}`}
        />
      </span>
      <span
        aria-hidden="true"
        className={`absolute left-1 top-1 block size-8 rounded-full bg-primary shadow-md ring-1 ring-primary-foreground/10 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          dark ? "translate-x-10" : "translate-x-0"
        } ${ready ? "opacity-100" : "opacity-0"}`}
      />
    </button>
  );
}
