"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function Dashboard() {
  const [perfil, setPerfil] = useState<any>(null);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalProyectos, setTotalProyectos] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarMetricas() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCargando(false);
        return;
      }

      // 1. Perfil del admin
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (p) setPerfil(p);

      // 2. Conteo global de creadores
      const { count: countUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      setTotalUsuarios(countUsers || 0);

      // 3. Conteo global de juegos subidos
      const { count: countProjs } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true });
      setTotalProyectos(countProjs || 0);

      setCargando(false);
    }

    cargarMetricas();
  }, []);

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-500">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-wider">Cargando métricas del sistema...</p>
      </div>
    );
  }

  const storageUsed = Number(perfil?.storage_used_mb || 0).toFixed(2);
  const storageLimit = perfil?.is_unlimited ? "∞" : `${perfil?.storage_limit_mb || 1024} MB`;
  const storagePercent = perfil?.is_unlimited
    ? 100
    : Math.min(100, Math.round(((perfil?.storage_used_mb || 0) / (perfil?.storage_limit_mb || 1024)) * 100));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Tarjeta de Identidad Superior */}
      <div className="bg-gray-900/40 border border-gray-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="inline-block px-3.5 py-1 rounded-full bg-red-950/40 border border-red-500/40 text-[10px] font-black text-red-400 tracking-widest uppercase">
            {perfil?.custom_title || "DEXA ADMIN • SUPERADMIN"}
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1 rounded-full">
            ● Servidor Operativo
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-orange-400 to-amber-300">
          @{perfil?.display_name || perfil?.username || "Dexa"}
        </h1>

        <p className="text-gray-400 mt-2 text-sm font-medium">
          Rango Global: <span className="text-white font-bold">{perfil?.rank || "Creador"}</span>
        </p>

        {/* Barra de Almacenamiento limpia y formateada */}
        <div className="mt-8 bg-gray-950/60 p-5 rounded-2xl border border-gray-800/80">
          <div className="text-xs font-semibold text-gray-400 mb-2.5 flex justify-between">
            <span>Almacenamiento Personal</span>
            <span className="font-mono text-gray-200">
              {storageUsed} MB / {storageLimit}
            </span>
          </div>
          <div className="w-full bg-gray-900 rounded-full h-2.5 border border-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900/40 border border-gray-800 p-6 rounded-2xl backdrop-blur-md">
          <span className="text-3xl block mb-2">👥</span>
          <span className="text-3xl font-black text-white">{totalUsuarios}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mt-1">
            Usuarios Registrados
          </span>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 p-6 rounded-2xl backdrop-blur-md">
          <span className="text-3xl block mb-2">🎮</span>
          <span className="text-3xl font-black text-white">{totalProyectos}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mt-1">
            Juegos en el Catálogo
          </span>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 p-6 rounded-2xl backdrop-blur-md">
          <span className="text-3xl block mb-2">⚡</span>
          <span className="text-3xl font-black text-purple-400">Next.js 16</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mt-1">
            Motor de la Plataforma
          </span>
        </div>
      </div>

      {/* Botones de Acción Rápida (¡Ahora sí llevan a algún lado!) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/usuarios"
          className="flex items-center gap-4 bg-gray-900/40 border border-gray-800 hover:border-blue-500/50 p-6 rounded-2xl transition group backdrop-blur-md"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            🛠️
          </div>
          <div>
            <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition">
              Gestionar Usuarios
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Modifica rangos, cuotas de almacenamiento y permisos.
            </p>
          </div>
        </Link>

        <Link
          href="/admin/proyectos"
          className="flex items-center gap-4 bg-gray-900/40 border border-gray-800 hover:border-purple-500/50 p-6 rounded-2xl transition group backdrop-blur-md"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            📂
          </div>
          <div>
            <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition">
              Cámara de Proyectos
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Inspecciona, destaca o retira juegos subidos a la nube.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}