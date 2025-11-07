
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
const Auth = lazy(() => import("./pages/Auth"));
const Cases = lazy(() => import("./pages/Cases"));
const Home = lazy(() => import("./pages/home"));
const Profil = lazy(() => import("./pages/Profil"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const History = lazy(() => import("./pages/history"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Ranking = lazy(() => import("./pages/Ranking"));
import { LazySimulation } from "./pages/LazySimulation";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route 
                path="/auth" 
                element={
                  <Suspense fallback={
                    <div className="min-h-screen bg-surface-alt flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                        <p className="text-subtext">Chargement...</p>
                      </div>
                    </div>
                  }>
                    <Auth />
                  </Suspense>
                } 
              />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={
                      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                          <p className="text-subtext">Chargement de l'accueil...</p>
                        </div>
                      </div>
                    }>
                      <Home />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/cases" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={
                      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                          <p className="text-subtext">Chargement des stations...</p>
                        </div>
                      </div>
                    }>
                      <Cases />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={
                      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                          <p className="text-subtext">Chargement du profil...</p>
                        </div>
                      </div>
                    }>
                      <Profil />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={
                      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                          <p className="text-subtext">Chargement des analyses...</p>
                        </div>
                      </div>
                    }>
                      <Dashboard />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/history" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={
                      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                          <p className="text-subtext">Chargement de l'historique...</p>
                        </div>
                      </div>
                    }>
                      <History />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              {/* Backward compatible redirect from old analytics path */}
              <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
              <Route 
                path="/pricing" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={
                      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                          <p className="text-subtext">Chargement des offres...</p>
                        </div>
                      </div>
                    }>
                      <Pricing />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/ranking" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={
                      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                          <p className="text-subtext">Chargement du classement...</p>
                        </div>
                      </div>
                    }>
                      <Ranking />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/simulation" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={
                      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                          <p className="text-subtext">Chargement de la simulation...</p>
                        </div>
                      </div>
                    }>
                      <LazySimulation />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
