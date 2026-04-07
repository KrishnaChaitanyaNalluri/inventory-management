import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { canAddInventoryItems } from "@/types/inventory";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { InventoryProvider } from "@/context/InventoryContext";
import { BottomNav } from "@/components/BottomNav";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import ActivityLog from "./pages/ActivityLog";
import Profile from "./pages/Profile";
import Feedback from "./pages/Feedback";
import Storage from "./pages/Storage";
import ManageUsers from "./pages/ManageUsers";
import AddInventoryItem from "./pages/AddInventoryItem";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AddInventoryItemRoute() {
  const { currentUser } = useAuth();
  if (!currentUser || !canAddInventoryItems(currentUser.role)) {
    return <Navigate to="/inventory" replace />;
  }
  return <AddInventoryItem />;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Login />;

  return (
    <InventoryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/add" element={<AddInventoryItemRoute />} />
          <Route path="/out-of-stock" element={<Navigate to="/inventory?filter=out" replace />} />
          <Route path="/activity" element={<ActivityLog />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/profile/users" element={<ManageUsers />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <BottomNav />
      </BrowserRouter>
    </InventoryProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
