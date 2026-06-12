import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/layout";

import AuthPage from "@/pages/auth";
import FeedPage from "@/pages/feed";
import ProfilePage from "@/pages/profile";
import FriendsPage from "@/pages/friends";
import ChatListPage from "@/pages/chat-list";
import ChatRoomPage from "@/pages/chat-room";
import NotificationsPage from "@/pages/notifications";
import AdminPage from "@/pages/admin";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType<any>, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  if (adminOnly && !user.isAdmin) {
    return <Redirect to="/feed" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to="/feed" /> : <AuthPage />}
      </Route>
      <Route path="/feed">
        <Layout><ProtectedRoute component={FeedPage} /></Layout>
      </Route>
      <Route path="/profile/:id">
        <Layout><ProtectedRoute component={ProfilePage} /></Layout>
      </Route>
      <Route path="/friends">
        <Layout><ProtectedRoute component={FriendsPage} /></Layout>
      </Route>
      <Route path="/chat">
        <Layout><ProtectedRoute component={ChatListPage} /></Layout>
      </Route>
      <Route path="/chat/:id">
        <Layout><ProtectedRoute component={ChatRoomPage} /></Layout>
      </Route>
      <Route path="/notifications">
        <Layout><ProtectedRoute component={NotificationsPage} /></Layout>
      </Route>
      <Route path="/admin">
        <Layout><ProtectedRoute component={AdminPage} adminOnly={true} /></Layout>
      </Route>
      <Route path="/settings">
        <Layout><ProtectedRoute component={SettingsPage} /></Layout>
      </Route>
      <Route>
        <Layout><NotFound /></Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
