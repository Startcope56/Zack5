import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Home, Users, MessageCircle, Bell, Menu, LogOut, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  const navItems = [
    { icon: Home, href: "/feed", label: "Home" },
    { icon: Users, href: "/friends", label: "Friends" },
    { icon: MessageCircle, href: "/chat", label: "Chat" },
    { icon: Bell, href: "/notifications", label: "Notifications" },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 w-full border-b bg-primary text-primary-foreground shadow-sm">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/feed" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <span className="text-white">BlueMedia</span>
          </Link>

          <nav className="flex items-center space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-full hover:bg-white/20 text-white ${isActive ? "bg-white/20" : ""}`}
                    title={item.label}
                  >
                    <item.icon className="h-5 w-5" />
                  </Button>
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/20 text-white">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <Link href={`/profile/${user.id}`}>
                  <DropdownMenuItem className="cursor-pointer gap-2 py-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.profilePicture || undefined} />
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">View your profile</span>
                    </div>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                {user.isAdmin && (
                  <Link href="/admin">
                    <DropdownMenuItem className="cursor-pointer gap-2">
                      <Shield className="h-4 w-4" /> Admin Panel
                    </DropdownMenuItem>
                  </Link>
                )}
                <DropdownMenuItem onClick={logout} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {children}
      </main>
    </div>
  );
}
