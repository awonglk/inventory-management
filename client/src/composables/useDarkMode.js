import { ref, watch } from "vue";

// Shared dark mode state (singleton pattern)
const isDarkMode = ref(false);

// Initialize dark mode from localStorage or system preference
const initializeDarkMode = () => {
  const stored = localStorage.getItem("dark-mode-preference");

  if (stored !== null) {
    // Use stored preference
    isDarkMode.value = stored === "true";
  } else {
    // Fallback to system preference
    isDarkMode.value = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
  }

  // Apply initial state
  applyDarkMode(isDarkMode.value);
};

// Apply or remove dark class from document
const applyDarkMode = (dark) => {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

export function useDarkMode() {
  // Toggle dark mode
  const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value;
    applyDarkMode(isDarkMode.value);
    localStorage.setItem("dark-mode-preference", isDarkMode.value.toString());
  };

  return {
    isDarkMode,
    toggleDarkMode,
    initializeDarkMode,
  };
}
