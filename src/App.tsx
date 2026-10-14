import { HashRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./app/AppShell";
import { AudioProvider } from "./audio/AudioProvider";
import { ContentProvider } from "./content/ContentProvider";
import { LessonPage } from "./lesson/LessonPage";
import { CoursesPage } from "./pages/CoursesPage";
import { ExamPage } from "./pages/ExamPage";
import { HomePage } from "./pages/HomePage";
import { PracticePage } from "./pages/PracticePage";
import { RecordingPage } from "./pages/RecordingPage";
import { ReviewPage, ReviewSessionPage } from "./pages/ReviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import type { AppServices } from "./services";
import { ServicesContext } from "./servicesContext";
import { SettingsProvider } from "./settings/SettingsContext";

export function App({ services }: { services: AppServices }) {
  return (
    <ServicesContext.Provider value={services}>
      <SettingsProvider store={services.settings}>
        <ContentProvider bundle={services.content} backend={services.pack} ttsUrls={services.ttsUrls}>
          <AudioProvider>
            <HashRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<HomePage />} />
                  <Route path="courses" element={<CoursesPage />} />
                  <Route path="lesson/:id" element={<LessonPage />} />
                  <Route path="review" element={<ReviewPage />} />
                  <Route path="review/lesson/:lessonId" element={<ReviewSessionPage />} />
                  <Route path="review/:source" element={<ReviewSessionPage />} />
                  <Route path="practice" element={<PracticePage />} />
                  <Route path="exam" element={<ExamPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="settings/recording" element={<RecordingPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </HashRouter>
          </AudioProvider>
        </ContentProvider>
      </SettingsProvider>
    </ServicesContext.Provider>
  );
}
