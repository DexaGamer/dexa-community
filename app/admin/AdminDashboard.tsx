"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Dashboard() {
  const [perfil, setPerfil] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

useEffect(() => {
  async function cargarPerfil() {
    console.log("🔍 Buscando usuario...");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log("👤 Usuario de sesión:", user?.email, "| ID:", user?.id);
    if (authError) console.error("❌ Error de Auth:", authError);
    
    if (!user) {
      setCargando(false);
      return;
    }

    console.log("📡 Buscando perfil en la base de datos...");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    console.log("📄 Datos recibidos:", data);
    if (error) console.error("🚨 ERROR DE SUPABASE:", error);

    if (data) setPerfil(data);
    setCargando(false);
  }
  cargarPerfil();
}, []);

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-gray-500 flex justify-center items-center font-medium">
        Cargando interfaz...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6 pt-10">
        
        {/* Tarjeta de Perfil */}
        <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          
          {/* Si es superadmin, mostramos la etiqueta brillante */}
          {perfil?.is_superadmin && (
            <div className="inline-block px-4 py-1.5 mb-5 rounded-full bg-red-950/40 border border-red-500/50 text-xs font-bold text-red-400 tracking-widest uppercase">
              {perfil.custom_title || "SUPERADMIN"}
            </div>
          )}
          
          {/* Nombre con el degradado inyectado desde la base de datos */}
          <h2 className={`text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r ${perfil?.name_gradient || 'from-blue-400 to-indigo-500'}`}>
            @{perfil?.display_name || "Usuario"}
          </h2>
          
          <p className="text-gray-400 mt-2 text-lg">
            Rango Global: <span className="text-white capitalize font-medium">{perfil?.rank}</span>
          </p>
          
          {/* Barra de Almacenamiento Dinámica */}
          <div className="mt-8 bg-[#0a0a0a] p-5 rounded-xl border border-gray-800/80">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex justify-between">
              <span>Almacenamiento Personal</span>
              <span className="text-gray-300">
                {perfil?.storage_used_mb} MB / {perfil?.is_unlimited ? "∞" : `${perfil?.storage_limit_mb} MB`}
              </span>
            </h3>
            <div className="w-full bg-gray-900 rounded-full h-2.5 border border-gray-800">
              <div 
                className={`h-2.5 rounded-full ${perfil?.is_superadmin ? 'bg-gradient-to-r from-red-500 to-yellow-500' : 'bg-blue-500'}`}
                style={{ width: perfil?.is_unlimited ? '100%' : `${(perfil?.storage_used_mb / perfil?.storage_limit_mb) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Panel exclusivo para el Admin */}
        {perfil?.is_superadmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <button className="bg-gray-900 border border-gray-800 hover:bg-gray-800 transition p-4 rounded-xl text-left">
              <h4 className="text-white font-bold mb-1">🛠️ Gestionar Usuarios</h4>
              <p className="text-xs text-gray-400">Modifica rangos, cuotas y emblemas.</p>
            </button>
            <button className="bg-gray-900 border border-gray-800 hover:bg-gray-800 transition p-4 rounded-xl text-left">
              <h4 className="text-white font-bold mb-1">📂 Transferir Proyectos</h4>
              <p className="text-xs text-gray-400">Mueve archivos entre grupos y usuarios.</p>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}