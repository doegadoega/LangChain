import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { Drawer } from "./components/Drawer";
import { useApp } from "./state/store";
import { Dashboard } from "./screens/Dashboard";
import { Workspace } from "./screens/Workspace";
import { Coding } from "./screens/Coding";
import { TeamComposer } from "./screens/TeamComposer";
import { AgentStudio } from "./screens/AgentStudio";
import { Execution } from "./screens/Execution";
import { QAGate } from "./screens/QAGate";
import { Logs } from "./screens/Logs";
import { Settings } from "./screens/Settings";
import { AgentChat } from "./screens/AgentChat";
import { Skills } from "./screens/Skills";
import { Knowledge } from "./screens/Knowledge";
import { PrecheckBlockedDialog } from "./components/PrecheckBlockedDialog";
import type { ScreenId } from "./types";

// Screens migrated to the STRAND design system render their own chrome
// (TopBar + SideBar) full-bleed. Unmigrated screens keep the legacy shell
// (old Sidebar + Header) during the progressive migration.
// All screens are migrated to the STRAND design system; each renders its own
// chrome (TopBar + SideBar). The legacy shell below is kept only as a fallback.
const STRAND_SCREENS = new Set<ScreenId>([
  "dashboard", "settings", "qa", "team", "agents", "logs", "coding",
  "workspace", "knowledge", "skills", "execution", "chat",
]);

export function App() {
  const screen = useApp((s) => s.screen);
  const loadAll = useApp((s) => s.loadAll);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const content = (
    <>
      {screen === "workspace" && <Workspace />}
      {screen === "coding" && <Coding />}
      {screen === "dashboard" && <Dashboard />}
      {screen === "team" && <TeamComposer />}
      {screen === "agents" && <AgentStudio />}
      {screen === "skills" && <Skills />}
      {screen === "knowledge" && <Knowledge />}
      {screen === "execution" && <Execution />}
      {screen === "qa" && <QAGate />}
      {screen === "logs" && <Logs />}
      {screen === "settings" && <Settings />}
      {screen === "chat" && <AgentChat />}
    </>
  );

  if (STRAND_SCREENS.has(screen)) {
    return (
      <div className="h-full w-full">
        {content}
        <PrecheckBlockedDialog />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[var(--color-bg)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">{content}</div>
          <Drawer />
        </main>
      </div>
      <PrecheckBlockedDialog />
    </div>
  );
}
