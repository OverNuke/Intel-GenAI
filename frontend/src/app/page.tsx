import { ThemeSwitcher } from "@/ui/theme-switcher";
import { HealthStatus } from "./health-status";

export default function Home() {
  return (
    <main>
      <h1>Ariadna</h1>
      <HealthStatus />
      <ThemeSwitcher />
    </main>
  );
}
