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

export function App() {
  const screen = useApp((s) => s.screen);
  const loadAll = useApp((s) => s.loadAll);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <div className="flex h-full w-full bg-[var(--color-bg)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {screen === "workspace" && <Workspace />}
            {screen === "coding" && <Coding />}
            {screen === "dashboard" && <Dashboard />}
            {screen === "team" && <TeamComposer />}
            {screen === "agents" && <AgentStudio />}
            {screen === "skills" && <Skills />}
            {screen === "execution" && <Execution />}
            {screen === "qa" && <QAGate />}
            {screen === "logs" && <Logs />}
            {screen === "settings" && <Settings />}
            {screen === "chat" && <AgentChat />}
          </div>
          <Drawer />
        </main>
      </div>
    </div>
  );
}
