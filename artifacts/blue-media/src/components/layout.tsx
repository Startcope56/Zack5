import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Home, Users, MessageCircle, Bell, LogOut, Shield, ChevronDown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useGetUnreadCount, getGetUnreadCountQueryKey } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: unread } = useGetUnreadCount({ query: { queryKey: getGetUnreadCountQueryKey(), refetchInterval: 30000 } });

  if (!user) return <>{children}</>;

  const navItems = [
    { icon: Home, href: "/feed", label: "Home" },
    { icon: Users, href: "/friends", label: "Friends" },
    { icon: MessageCircle, href: "/chat", label: "Messages" },
  ];

  const unreadCount = unread?.count ?? 0;

  return (
    <div className="min-h-screen" style={{ background: "#f0f2f5" }}>
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full shadow-md"
        style={{ background: "linear-gradient(135deg, #1877f2 0%, #0a6bc7 100%)" }}>
        <div className="max-w-5xl mx-auto flex h-14 items-center justify-between px-3 gap-2">

          {/* Logo */}
          <Link href="/feed">
            <span className="text-white font-black text-xl tracking-wider select-none cursor-pointer"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
              BLUE<span style={{ color: "#90d0ff" }}>MEDIA</span>
            </span>
          </Link>

          {/* Nav Icons */}
          <nav className="flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    title={item.label}
                    className={`relative flex items-center justify-center w-12 h-10 rounded-lg transition-all ${
                      isActive
                        ? "bg-white/25 shadow-inner"
                        : "hover:bg-white/15"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-white/80"}`} />
                    {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-white rounded-full" />}
                  </button>
                </Link>
              );
            })}

            {/* Notifications */}
            <Link href="/notifications">
              <button
                title="Notifications"
                className={`relative flex items-center justify-center w-12 h-10 rounded-lg transition-all ${
                  location === "/notifications" ? "bg-white/25 shadow-inner" : "hover:bg-white/15"
                }`}
              >
                <Bell className={`h-5 w-5 ${location === "/notifications" ? "text-white" : "text-white/80"}`} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-md border border-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
                {location === "/notifications" && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-white rounded-full" />}
              </button>
            </Link>
          </nav>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-full pl-1 pr-2 py-1 transition">
                <Avatar className="h-7 w-7 border-2 border-white/40">
                  <AvatarImage src={user.profilePicture || undefined} />
                  <AvatarFallback className="text-xs font-bold" style={{ background: "#0a6bc7", color: "white" }}>
                    {user.name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white text-sm font-medium max-w-[80px] truncate hidden sm:block">{user.name.split(" ")[0]}</span>
                <ChevronDown className="h-3.5 w-3.5 text-white/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl shadow-xl p-1.5 border-0" style={{ background: "white" }}>
              <Link href={`/profile/${user.id}`}>
                <DropdownMenuItem className="cursor-pointer gap-3 py-3 px-3 rounded-lg hover:bg-blue-50">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.profilePicture || undefined} />
                    <AvatarFallback className="font-bold text-sm" style={{ background: "#1877f2", color: "white" }}>
                      {user.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-800">{user.name}</span>
                    <span className="text-xs text-blue-500">View your profile →</span>
                  </div>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator className="my-1" />
              {user.isAdmin && (
                <Link href="/admin">
                  <DropdownMenuItem className="cursor-pointer gap-2 px-3 py-2.5 rounded-lg hover:bg-yellow-50 text-yellow-700">
                    <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-yellow-600" />
                    </div>
                    <span className="font-medium">Admin Panel</span>
                  </DropdownMenuItem>
                </Link>
              )}
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer gap-2 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600"
              >
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                  <LogOut className="h-4 w-4 text-red-500" />
                </div>
                <span className="font-medium">Log Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4">
        {children}
      </main>
    </div>
  );
}
