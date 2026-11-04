
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Mode = "login" | "register";

export default function Login() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const iniciarConGoogle = async () => {
    setLoading(true);
    setMensaje("Conectando con Google...");

const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Usa tu URL de Codespaces exacta en lugar de window.location.origin
        redirectTo: "https://super-duper-space-couscous-jjvx7r5p6gw5cpr5g-3000.app.github.dev/onboarding",
      },
    });

    if (error) {
      setMensaje("Error: " + error.message);
      setLoading(false);
    }
  };

  const iniciarSesion = async () => {
    if (!email.trim() || !password) {
      setMensaje("Completa el correo y la contraseña.");
      return;
    }

    setLoading(true);
    setMensaje("Iniciando sesión...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMensaje("Error: " + error.message);
      setLoading(false);
      return;
    }

    if (!data.user || !data.session) {
      setMensaje("No se pudo establecer la sesión.");
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  };

  const registrarUsuario = async () => {
    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!cleanUsername || !cleanDisplayName || !email.trim() || !password) {
      setMensaje("Completa todos los campos.");
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setMensaje(
        "El usuario debe tener entre 3 y 20 caracteres. Usa letras, números o guion bajo."
      );
      return;
    }

    if (password.length < 6) {
      setMensaje("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMensaje("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setMensaje("Comprobando nombre de usuario...");

    try {
      const { data: existingUser, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        setMensaje("Ese nombre de usuario ya está ocupado.");
        setLoading(false);
        return;
      }

      setMensaje("Creando tu cuenta...");

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: cleanDisplayName,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        setMensaje("¡Cuenta creada! Entrando a Dexa Community...");
        router.replace("/");
        router.refresh();
      } else {
        setMensaje(
          "¡Cuenta creada! Revisa tu correo para confirmar el registro."
        );
        setLoading(false);
      }
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? "Error: " + error.message
          : "No se pudo crear la cuenta."
      );
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading) return;

    if (mode === "login") {
      iniciarSesion();
    } else {
      registrarUsuario();
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900/50 border border-gray-800 p-7 sm:p-8 rounded-2xl shadow-xl">

        <h1 className="text-3xl font-bold text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
          {mode === "login" ? "Bienvenido" : "Crear cuenta"}
        </h1>

        <p className="text-gray-400 text-center text-sm mb-6">
          {mode === "login"
            ? "Ingresa a Dexa Community"
            : "Únete a la comunidad de creadores"}
        </p>

        {/* Google */}
        <button
          type="button"
          onClick={iniciarConGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-200 disabled:opacity-50 text-gray-900 font-semibold py-3 rounded-lg transition-colors"
        >
          <svg viewBox="0 0 48 48" className="w-5 h-5">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" transform="translate(0 4)" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.66 5.94c4.48-4.13 7.12-10.2 7.12-17.59z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z" transform="translate(0 4)" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.86l-7.66-5.94c-2.13 1.43-4.87 2.27-8.24 2.27-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 43.62 14.62 48 24 48z" transform="translate(0 -4)" />
          </svg>
          Continuar con Google
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-gray-700 flex-1" />
          <span className="text-xs text-gray-500">O CONTINÚA CON CORREO</span>
          <div className="h-px bg-gray-700 flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {mode === "register" && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Nombre de usuario
                </label>
                <input
                  type="text"
                  placeholder="dexita"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={20}
                  autoComplete="username"
                  className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tu identificador único. Ejemplo: @dexita
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Nombre visible
                </label>
                <input
                  type="text"
                  placeholder="Dexita"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  autoComplete="name"
                  className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {mensaje && (
            <div className="p-3 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-center text-gray-200 break-words">
              {mensaje}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading
              ? "Procesando..."
              : mode === "login"
                ? "Iniciar sesión"
                : "Crear cuenta"}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-gray-400">
          {mode === "login" ? "¿Todavía no tienes cuenta?" : "¿Ya tienes cuenta?"}

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setMensaje("");
              setPassword("");
              setConfirmPassword("");
            }}
            className="ml-2 text-blue-400 hover:text-blue-300 font-semibold"
          >
            {mode === "login" ? "Regístrate" : "Inicia sesión"}
          </button>
        </div>

      </div>
    </main>
  );
}
