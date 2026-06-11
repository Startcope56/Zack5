import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const handlePinChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const arr = pin.split("").concat(Array(4).fill("")).slice(0, 4);
    arr[idx] = val;
    setPin(arr.join(""));
    if (val && idx < 3) pinRefs[idx + 1].current?.focus();
    if (!val && idx > 0) pinRefs[idx - 1].current?.focus();
  };

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[idx] && idx > 0) {
      pinRefs[idx - 1].current?.focus();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.replace(/\s/g, "");
    if (cleanPin.length !== 4) {
      toast({ title: "Error", description: "Please enter your 4-digit PIN", variant: "destructive" });
      return;
    }
    try {
      const res = await loginMutation.mutateAsync({ data: { email, pin: cleanPin } });
      login(res.token, res.user.id);
      setLocation("/feed");
    } catch (err: any) {
      toast({ title: "Login failed", description: err?.data?.error || "Invalid email or PIN", variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.replace(/\s/g, "");
    if (!name.trim()) {
      toast({ title: "Error", description: "Please enter your full name", variant: "destructive" });
      return;
    }
    if (cleanPin.length !== 4) {
      toast({ title: "Error", description: "Please enter a 4-digit PIN", variant: "destructive" });
      return;
    }
    try {
      const res = await registerMutation.mutateAsync({ data: { email, name: name.trim(), pin: cleanPin } });
      login(res.token, res.user.id);
      setLocation("/feed");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err?.data?.error || "Please try again", variant: "destructive" });
    }
  };

  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setPin("");
    setEmail("");
    setName("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(160deg, #e8f0fe 0%, #dce8ff 50%, #e3f0ff 100%)" }}>

      {/* Logo */}
      <div className="text-center mb-6 select-none">
        <h1 className="text-5xl font-black tracking-widest uppercase"
          style={{ color: "#0a6bc7", textShadow: "0 2px 8px rgba(10,107,199,0.15)", letterSpacing: "0.15em" }}>
          BLUE<span style={{ color: "#1da1f2" }}>MEDIA</span>
        </h1>
        <p className="text-gray-500 mt-2 text-base max-w-xs mx-auto leading-snug">
          Connect with friends and the world around you on Blue Media.
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="p-6 space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3.5 rounded-xl border border-gray-300 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 placeholder-gray-400"
            />

            {/* PIN boxes */}
            <div className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 flex items-center gap-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition">
              <span className="text-gray-400 text-sm mr-1 shrink-0">4-digit PIN</span>
              <div className="flex gap-2 flex-1 justify-end">
                {[0,1,2,3].map(i => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={pin[i] || ""}
                    onChange={e => handlePinChange(i, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(i, e)}
                    className="w-10 h-10 text-center text-lg font-bold border-2 border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500 transition"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 rounded-xl text-white text-lg font-bold transition active:scale-95 disabled:opacity-70"
              style={{ background: isPending ? "#5b9fd6" : "linear-gradient(135deg, #1877f2, #0a6bc7)", boxShadow: "0 4px 14px rgba(24,119,242,0.4)" }}
            >
              {isPending ? "Logging in..." : "Log In"}
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-xs">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button
              type="button"
              onClick={() => switchMode("register")}
              className="w-full py-3.5 rounded-xl text-white text-base font-bold transition active:scale-95"
              style={{ background: "linear-gradient(135deg, #42b72a, #2d8c1e)", boxShadow: "0 4px 14px rgba(66,183,42,0.35)" }}
            >
              Create new account
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="p-6 space-y-3">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Create your account</h2>
              <p className="text-gray-400 text-sm mt-1">It's quick and easy.</p>
            </div>

            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-4 py-3.5 rounded-xl border border-gray-300 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 placeholder-gray-400"
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3.5 rounded-xl border border-gray-300 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition bg-gray-50 placeholder-gray-400"
            />

            <div className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 flex items-center gap-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition">
              <span className="text-gray-400 text-sm mr-1 shrink-0">Choose PIN</span>
              <div className="flex gap-2 flex-1 justify-end">
                {[0,1,2,3].map(i => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={pin[i] || ""}
                    onChange={e => handlePinChange(i, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(i, e)}
                    className="w-10 h-10 text-center text-lg font-bold border-2 border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500 transition"
                  />
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center px-2">
              By clicking Sign Up, you agree to our Terms and Privacy Policy.
            </p>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 rounded-xl text-white text-lg font-bold transition active:scale-95 disabled:opacity-70"
              style={{ background: isPending ? "#5b9fd6" : "linear-gradient(135deg, #42b72a, #2d8c1e)", boxShadow: "0 4px 14px rgba(66,183,42,0.35)" }}
            >
              {isPending ? "Signing up..." : "Sign Up"}
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-xs">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button
              type="button"
              onClick={() => switchMode("login")}
              className="w-full py-3 rounded-xl border-2 border-blue-500 text-blue-600 text-base font-bold hover:bg-blue-50 transition"
            >
              Back to Log In
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="text-gray-400 text-xs mt-6 text-center">
        Blue Media © 2026 · Made with ❤️ for Pilipinas
      </p>
    </div>
  );
}
