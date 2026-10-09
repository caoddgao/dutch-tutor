import { HashRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./app/AppShell";
import { CoursesPage } from "./pages/CoursesPage";
import { ExamPage } from "./pages/ExamPage";
import { HomePage } from "./pages/HomePage";
import { PracticePage } from "./pages/PracticePage";
import { ReviewPage } from "./pages/ReviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SettingsProvider } from "./settings/SettingsContext";
import type { SettingsStore } from "./storage/settingsStore";

export function App({ store }: { store: SettingsStore }) {
  return (
    <SettingsProvider store={store}>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="exam" element={<ExamPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </SettingsProvider>
  );
}
