"use client";

import { useEffect, useState } from "react";
import { themeStorageKey } from "../lib/theme";
import { Icon } from "./icons";

const darkPreference = "(prefers-color-scheme: dark)";

function darkModeActive() {
  const choice = document.documentElement.dataset.theme;
  return choice === "dark" || (choice !== "light" && window.matchMedia(darkPreference).matches);
}

export default function ThemeSwitch() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const system = window.matchMedia(darkPreference);
    const update = () => setDark(darkModeActive());
    function sync(event: StorageEvent) {
      if (event.key !== themeStorageKey && event.key !== null) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        document.documentElement.dataset.theme = event.newValue;
      } else {
        delete document.documentElement.dataset.theme;
      }
      update();
    }
    update();
    system.addEventListener("change", update);
    window.addEventListener("storage", sync);
    return () => {
      system.removeEventListener("change", update);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function toggle() {
    const theme = darkModeActive() ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    setDark(theme === "dark");
    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // The current tab can still switch appearance when storage is unavailable.
    }
  }

  return (
    <button type="button" className="theme-switch" role="switch" aria-label="Dark theme"
      aria-checked={dark} title={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggle}>
      <span className="theme-sun"><Icon name="sun" size={16} /></span>
      <span className="theme-moon"><Icon name="moon" size={15} /></span>
    </button>
  );
}
