import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicRoute } from "@/components/auth/PublicRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";

const HomePage = lazy(() => import("./pages/home/HomePage"));
const Index = lazy(() => import("./pages/Index"));
const Help = lazy(() => import("./pages/Help"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const Signup = lazy(() => import("./pages/Signup"));
const AdminShell = lazy(() => import("./components/admin/AdminShell"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminBilling = lazy(() => import("./pages/admin/Billing"));
const AdminProviders = lazy(() => import("./pages/admin/Providers"));
const AdminConversations = lazy(() => import("./pages/admin/Conversations"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
            <Routes>
              <Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
              <Route path="/help" element={<PublicRoute><Help /></PublicRoute>} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/studio" element={<Index />} />
              <Route path="/forge" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminShell /></AdminRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="billing" element={<AdminBilling />} />
                <Route path="providers" element={<AdminProviders />} />
                <Route path="conversations" element={<AdminConversations />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
