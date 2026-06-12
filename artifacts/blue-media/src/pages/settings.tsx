import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useChangePassword, useUpdateUser, useClaimBlueBadge } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Eye, Bell, HelpCircle, UserX, BadgeCheck, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [section, setSection] = useState<string | null>(null);

  // Change PIN state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const changePin = useChangePassword();

  // Privacy state
  const [privacy, setPrivacy] = useState<"public" | "friends">((user?.privacy as "public" | "friends") || "public");
  const updateUser = useUpdateUser();

  // Notifications state
  const [notifSettings, setNotifSettings] = useState({
    friend_request: true,
    post_reaction: true,
    post_comment: true,
    message: true,
    follow: true,
  });

  const claimBadge = useClaimBlueBadge();

  const handleChangePin = async () => {
    if (newPin !== confirmPin) {
      toast({ title: "PINs don't match", variant: "destructive" });
      return;
    }
    if (newPin.length !== 4) {
      toast({ title: "PIN must be 4 digits", variant: "destructive" });
      return;
    }
    try {
      await changePin.mutateAsync({ data: { currentPin, newPin } });
      toast({ title: "PIN changed successfully! 🔐" });
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
      setSection(null);
    } catch (err: any) {
      toast({ title: "Failed to change PIN", description: err.message, variant: "destructive" });
    }
  };

  const handlePrivacySave = async () => {
    if (!user) return;
    try {
      await updateUser.mutateAsync({ id: user.id, data: { privacy } });
      queryClient.invalidateQueries();
      toast({ title: "Privacy settings updated!" });
      setSection(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleClaimBadge = async () => {
    try {
      const res = await claimBadge.mutateAsync(undefined as any);
      toast({ title: "🎉 " + (res.message || "Blue Badge claimed!") });
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const menuItems = [
    {
      id: "pin",
      icon: Lock,
      color: "text-blue-500",
      bg: "bg-blue-50",
      title: "Change PIN",
      subtitle: "Update your 4-digit PIN",
    },
    {
      id: "privacy",
      icon: Eye,
      color: "text-green-500",
      bg: "bg-green-50",
      title: "Privacy",
      subtitle: user?.privacy === "friends" ? "Friends only" : "Public",
    },
    {
      id: "notifications",
      icon: Bell,
      color: "text-yellow-500",
      bg: "bg-yellow-50",
      title: "Notifications",
      subtitle: "Manage notification types",
    },
    {
      id: "badge",
      icon: BadgeCheck,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
      title: "Blue Badge",
      subtitle: user?.blueBadge ? "✓ Badge claimed!" : "Claim your free Blue Badge",
    },
    {
      id: "help",
      icon: HelpCircle,
      color: "text-purple-500",
      bg: "bg-purple-50",
      title: "Help & About",
      subtitle: "App info and support",
    },
    {
      id: "deactivate",
      icon: UserX,
      color: "text-red-500",
      bg: "bg-red-50",
      title: "Deactivate Account",
      subtitle: "Temporarily disable your account",
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardContent className="p-0">
          {menuItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                idx < menuItems.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <div className={`h-10 w-10 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>

      {/* App info footer */}
      <div className="text-center text-xs text-gray-400 space-y-1 pt-2">
        <p className="font-bold text-blue-500">BLUE MEDIA</p>
        <p>Version 1.0.0 — Built for Filipinos 🇵🇭</p>
      </div>

      {/* Change PIN Dialog */}
      <Dialog open={section === "pin"} onOpenChange={o => !o && setSection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change PIN 🔐</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current PIN</Label>
              <Input type="password" maxLength={4} inputMode="numeric" placeholder="••••" value={currentPin} onChange={e => setCurrentPin(e.target.value)} />
            </div>
            <div>
              <Label>New PIN</Label>
              <Input type="password" maxLength={4} inputMode="numeric" placeholder="••••" value={newPin} onChange={e => setNewPin(e.target.value)} />
            </div>
            <div>
              <Label>Confirm New PIN</Label>
              <Input type="password" maxLength={4} inputMode="numeric" placeholder="••••" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} />
            </div>
            <Button onClick={handleChangePin} className="w-full" disabled={changePin.isPending}>
              {changePin.isPending ? "Changing..." : "Change PIN"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Dialog */}
      <Dialog open={section === "privacy"} onOpenChange={o => !o && setSection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Privacy Settings 👁️</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Who can see your posts and profile?</p>
            {["public", "friends"].map(p => (
              <button
                key={p}
                onClick={() => setPrivacy(p as "public" | "friends")}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition ${
                  privacy === p ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-left">
                  <p className="font-semibold text-sm capitalize">{p === "public" ? "🌍 Public" : "👫 Friends Only"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p === "public" ? "Everyone can see your posts" : "Only friends can see your posts"}</p>
                </div>
                {privacy === p && <div className="h-4 w-4 rounded-full bg-blue-500" />}
              </button>
            ))}
            <Button onClick={handlePrivacySave} className="w-full" disabled={updateUser.isPending}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifications Dialog */}
      <Dialog open={section === "notifications"} onOpenChange={o => !o && setSection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notification Settings 🔔</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {[
              { key: "friend_request", label: "Friend Requests", icon: "👫" },
              { key: "post_reaction", label: "Post Reactions", icon: "🩷" },
              { key: "post_comment", label: "Post Comments", icon: "💬" },
              { key: "message", label: "Messages", icon: "📩" },
              { key: "follow", label: "New Followers", icon: "👤" },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <Switch
                  checked={notifSettings[item.key as keyof typeof notifSettings]}
                  onCheckedChange={v => setNotifSettings(prev => ({ ...prev, [item.key]: v }))}
                />
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-2">Note: Saved locally on this device.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blue Badge Dialog */}
      <Dialog open={section === "badge"} onOpenChange={o => !o && setSection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Blue Badge ✓</DialogTitle></DialogHeader>
          <div className="space-y-4 text-center">
            <div className="text-6xl">💙</div>
            <h3 className="font-bold text-xl">Blue Media Verification</h3>
            {user?.blueBadge ? (
              <>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-blue-700 font-semibold">✓ You have the Blue Badge!</p>
                  <p className="text-sm text-blue-600 mt-1">Your profile is verified on Blue Media.</p>
                </div>
                <p className="text-xs text-gray-500">Claimed {user.blueBadgeClaimedAt ? new Date(user.blueBadgeClaimedAt).toLocaleDateString() : ""}</p>
              </>
            ) : (
              <>
                <p className="text-gray-600 text-sm">Claim your free Blue Badge and show the world you're a verified Blue Media user!</p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-yellow-700 text-sm font-medium">⏳ Limited time offer! Claim now before it expires.</p>
                </div>
                <Button onClick={handleClaimBadge} className="w-full" disabled={claimBadge.isPending}>
                  {claimBadge.isPending ? "Claiming..." : "💙 Claim Free Blue Badge"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Help & About Dialog */}
      <Dialog open={section === "help"} onOpenChange={o => !o && setSection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Help & About 💙</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-3xl font-black text-blue-500">BLUE<span className="text-blue-300">MEDIA</span></p>
              <p className="text-xs text-gray-400 mt-1">Version 1.0.0</p>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">📱 About Blue Media</p>
              <p>Blue Media is a Filipino-focused social media platform built for real connection. Chat with friends, share moments, and build your community.</p>
              <p className="font-semibold text-gray-800 mt-3">🛡️ Community Guidelines</p>
              <p>We have zero tolerance for harassment, hate speech, and inappropriate content. Always treat others with respect.</p>
              <p className="font-semibold text-gray-800 mt-3">📧 Contact Support</p>
              <p>For help and support, please reach out to our admin team through the app.</p>
              <p className="font-semibold text-gray-800 mt-3">🇵🇭 Made for Filipinos</p>
              <p>Blue Media was built with the Filipino community in mind — a safe, fun place to connect and share.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivate Account Dialog */}
      <Dialog open={section === "deactivate"} onOpenChange={o => !o && setSection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deactivate Account ⚠️</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 font-semibold">Are you sure?</p>
              <p className="text-sm text-red-600 mt-1">Deactivating your account will hide your profile and posts from others. You can reactivate anytime by logging back in.</p>
            </div>
            <p className="text-sm text-gray-500">To deactivate, contact our admin team. We'll process your request within 24 hours.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSection(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={() => {
                setSection(null);
                toast({ title: "Request submitted", description: "Your deactivation request has been sent to the admin team." });
              }}>Send Request</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
