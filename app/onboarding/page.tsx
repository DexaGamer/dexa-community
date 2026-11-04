"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Onboarding() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    async function verificarUsuario() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      
      // Ahora pedimos el candado: onboarding_completed
      const { data: perfil } = await supabase
        .from("profiles")
        .select("username, display_name, onboarding_completed")
        .eq("id", user.id)
        .single();

      // Si el candado está en true, ¡ya pasó por aquí! Al catálogo.
      if (perfil?.onboarding_completed) {
        router.push("/");
      } else {
        // Si es false, lo atrapamos en la pantalla. Pre-llenamos el nombre visible si existe.
        if (perfil?.display_name) setDisplayName(perfil.display_name);
        
        // Si Supabase le generó un username con su correo, lo borramos de la vista para que elija uno chido
        if (perfil?.username && !perfil.username.includes("@")) {
           setUsername(perfil.username);
        }
        
        setCargando(false);
      }
    }

    verificarUsuario();
  }, [router]);

  const guardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!cleanUsername || !cleanDisplayName) {
      setMensaje("⚠️ Completa ambos campos para continuar.");
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setMensaje("⚠️ El usuario debe tener entre 3 y 20 letras, números o guiones bajos (sin espacios).");
      return;
    }

    setGuardando(true);
    setMensaje("Comprobando disponibilidad...");

    try {
      // 1. Verificar que el username no esté ocupado por OTRA persona
      const { data: existente } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .neq("id", userId)
        .maybeSingle();

      if (existente) {
        setMensaje("❌ Ese nombre de usuario ya está ocupado. ¡Elige otro!");
        setGuardando(false);
        return;
      }

      // 2. Guardar en Supabase y activar el candado
      setMensaje("Guardando tu perfil...");
      const { error } = await supabase
        .from("profiles")
        .update({
          username: cleanUsername,
          display_name: cleanDisplayName,
          onboarding_completed: true 
        })
        .eq("id", userId);

      if (error) throw error;

      // 3. ¡Éxito! Redirigir a configuración para la foto
      setMensaje("¡Listo! Entrando...");
      router.push("/cuenta");
      router.refresh();
      
    } catch (err: any) {
      setMensaje("Error al guardar: " + err.message);
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#070709] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#070709] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Luces de fondo cyberpunk */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />
      
      <div className="w-full max-w-md bg-gray-900/40 border border-gray-800 p-8 rounded-3xl shadow-2xl backdrop-blur-xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            🚀
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">¡Bienvenido a Dexa Community!</h1>
          <p className="text-gray-400 text-sm mt-2">Antes de aterrizar, configura tu identidad como creador.</p>
        </div>

        <form onSubmit={guardarPerfil} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Nombre de Usuario (Único)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-500 font-bold">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu_nombre"
                maxLength={20}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-700"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5 ml-1">Sin espacios, usa letras, números o guiones bajos.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Nombre Visible
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu Nombre Genial"
              maxLength={30}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-700"
            />
          </div>

          {mensaje && (
            <div className={`p-3 rounded-xl text-sm text-center font-medium border ${mensaje.includes('❌') || mensaje.includes('⚠️') || mensaje.includes('Error') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
              {mensaje}
            </div>
          )}

          <button
            type="submit"
            disabled={guardando}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active:scale-[0.98]"
          >
            {guardando ? "Configurando nave..." : "Terminar y Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}