import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="fixed bottom-4 left-4 z-[70] rounded-full border bg-background/95 p-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant={theme === "light" ? "default" : "ghost"}
          className="h-8 w-8"
          onClick={() => setTheme("light")}
          aria-label="Switch to light theme"
        >
          <Sun className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={theme === "dark" ? "default" : "ghost"}
          className="h-8 w-8"
          onClick={() => setTheme("dark")}
          aria-label="Switch to dark theme"
        >
          <Moon className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={theme === "system" ? "default" : "ghost"}
          className="h-8 w-8"
          onClick={() => setTheme("system")}
          aria-label="Use system theme"
        >
          <Monitor className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
