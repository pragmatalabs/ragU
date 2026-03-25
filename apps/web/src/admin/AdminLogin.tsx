import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { Lock } from "lucide-react";

export function AdminLogin() {
  const { login, error } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await login(username, password);
    setSubmitting(false);
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <form onSubmit={handleSubmit} className="w-full max-w-sm mx-4 space-y-5">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-800 mb-4">
            <Lock size={24} className="text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-white">
            rag<span className="text-blue-400">U</span> Admin
          </h1>
          <p className="text-xs text-gray-500 mt-1">Sign in to manage the playground</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !username || !password}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg py-3 text-sm font-medium text-white transition-colors"
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
