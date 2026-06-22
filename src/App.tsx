import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, type ReactNode, Component } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ContentForgeProvider } from "@/hooks/ContentForgeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicRoute } from "@/components/auth/PublicRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";

// Error boundary for debugging
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error("ErrorBoundary caught error:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary error details:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "red", fontFamily: "monospace" }}>
          <h1>⚠️ Application Error</h1>
          <p>{this.state.error?.message}</p>
          <pre style={{ backgroundColor: "#f5f5f5", padding: "10px", overflow: "auto", maxHeight: "300px" }}>
            {this.state.error?.stack}
          </pre>
          <p>Check browser console for more details</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const HomePage = lazy(() => import("./pages/home/HomePage"));
const Index = lazy(() => import("./pages/Index"));
const Help = lazy(() => import("./pages/Help"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const Signup = lazy(() => import("./pages/Signup"));
const TypeSelector = lazy(() => import("./components/TypeSelector").then(m => ({ default: m.TypeSelector })));
const VideoPreviewPage = lazy(() => import("./pages/VideoPreviewPage"));
const AdminShell = lazy(() => import("./components/admin/AdminShell"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminBilling = lazy(() => import("./pages/admin/Billing"));
const AdminProviderCosts = lazy(() => import("./pages/admin/ProviderCosts"));
const AdminCredits = lazy(() => import("./pages/admin/CreditsDashboard"));
const AdminProviders = lazy(() => import("./pages/admin/Providers"));
const AdminConversations = lazy(() => import("./pages/admin/Conversations"));
const HeyGenSettings = lazy(() => import("./pages/admin/HeyGenSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Debug = lazy(() => import("./pages/Debug"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ContentForgeProvider>
            <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
              <Routes>
                <Route path="/debug" element={<Debug />} />
                <Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
                <Route path="/help" element={<PublicRoute><Help /></PublicRoute>} />
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/new-course" element={<ProtectedRoute><TypeSelector /></ProtectedRoute>} />
                <Route path="/preview/videos" element={<ProtectedRoute><VideoPreviewPage /></ProtectedRoute>} />
                <Route path="/studio" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/forge" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminRoute><AdminShell /></AdminRoute>}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="billing" element={<AdminBilling />} />
                  <Route path="provider-costs" element={<AdminProviderCosts />} />
                  <Route path="credits" element={<AdminCredits />} />
                  <Route path="providers" element={<AdminProviders />} />
                  <Route path="conversations" element={<AdminConversations />} />
                  <Route path="settings" element={<HeyGenSettings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ContentForgeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
