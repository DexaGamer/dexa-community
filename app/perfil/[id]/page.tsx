"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Perfil {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  social_youtube?: string;
  social_discord?: string;
  social_web?: string;
  role?: string; // <-- Propiedad añadida para TypeScript
}

interface Proyecto {
  id: string;
  title: string;
  description: string;
  drive_file_id: string;
  cover_file_id?: string;
  icon_file_id?: string;
  file_size_mb: number;
  category: string;
  accent_color?: string;
  downloads_count: number;
  created_at: string;
}

function ContenidoPerfil() {
  const params = useParams();
  const perfilId = params?.id as string;

  const [montado, setMontado] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado || !perfilId) return;

    async function cargarDatosPerfil() {
      setCargando(true);

      // 1. Cargar Perfil Público solicitando también el role
      const { data: dataPerfil } = await supabase
        .from("profiles")
        .select("*, role")
        .eq("id", perfilId)
        .single();

      if (dataPerfil) {
        setPerfil(dataPerfil);
      } else {
        setPerfil({ id: perfilId, username: "creador", display_name: "Creador Desconocido" });
      }

      // 2. Cargar Colección Pública del Creador
      const { data: dataProyectos } = await supabase
        .from("projects")
        .select("*")
        .eq("owner_id", perfilId)
        .eq("visibility", "public")
        .order("created_at", { ascending: false });

      if (dataProyectos) {
        setProyectos(dataProyectos);
      }

      setCargando(false);
    }

    cargarDatosPerfil();
  }, [perfilId, montado]);

  const totalMb = proyectos.reduce((acc, p) => acc + (p.file_size_mb || 0), 0);
  const totalDescargas = proyectos.reduce((acc, p) => acc + (p.downloads_count || 0), 0);

  // Clases base consistentes
  const baseClasses = "max-w-6xl mx-auto relative z-10";

  if (!montado || cargando) {
    return (
      <div className={`${baseClasses} flex flex-col items-center justify-center py-32 text-gray-500`}>
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold uppercase tracking-wider">Cargando creador...</p>
      </div>
    );
  }

  return (
    <div className={baseClasses}>
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition bg-gray-900/60 border border-gray-800 px-4 py-2.5 rounded-xl backdrop-blur-md"
        >
          <span>←</span>
          <span>Volver al Catálogo</span>
        </Link>
      </div>

      {/* Tarjeta de Identidad del Creador */}
      <section className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 md:p-10 backdrop-blur-md relative overflow-hidden mb-10 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          
          {/* Avatar Gigante */}
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gray-950 border-4 border-gray-800 shadow-2xl overflow-hidden flex items-center justify-center text-5xl shrink-0">
            {perfil?.avatar_url ? (
              <img src={perfil.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              "👾"
            )}
          </div>

          <div className="flex-1 text-center md:text-left w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className={`text-4xl md:text-5xl font-black tracking-tight ${
                    perfil?.role === 'admin' 
                      ? 'bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                      : 'text-white'
                  }`}>
                    {perfil?.display_name || perfil?.username || "Creador"}
                  </h1>
                  
                  {/* Etiqueta exclusiva de Admin */}
                  {perfil?.role === 'admin' && (
                    <span className="bg-purple-500/20 border border-purple-500/50 text-purple-300 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-sm text-blue-400 font-mono mt-1.5 bg-blue-500/10 inline-block px-3 py-1 rounded-lg border border-blue-500/20">
                  @{perfil?.username || "usuario"}
                </p>
              </div>

              {/* Redes Sociales del Creador */}
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 mt-4 md:mt-0">
                {perfil?.social_discord && (
                  <a href={perfil.social_discord} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 rounded-xl transition text-[#5865F2]" title="Discord">
                    💬
                  </a>
                )}
                {perfil?.social_youtube && (
                  <a href={perfil.social_youtube} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition text-red-500" title="YouTube">
                    📺
                  </a>
                )}
                {perfil?.social_web && (
                  <a href={perfil.social_web} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition text-emerald-500" title="Web">
                    🌐
                  </a>
                )}
              </div>
            </div>

            {/* Estadísticas Globales */}
            <div className="grid grid-cols-3 gap-3 md:gap-4 mt-8 pt-6 border-t border-gray-800/80 max-w-xl mx-auto md:mx-0">
              <div className="bg-gray-950/50 border border-gray-800/80 rounded-2xl p-4 text-center hover:border-gray-700 transition">
                <span className="block text-2xl font-black text-white">{proyectos.length}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1 block">Proyectos</span>
              </div>
              <div className="bg-gray-950/50 border border-gray-800/80 rounded-2xl p-4 text-center hover:border-gray-700 transition">
                <span className="block text-2xl font-black text-indigo-400">{totalMb}M</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1 block">Almacenamiento</span>
              </div>
              <div className="bg-gray-950/50 border border-gray-800/80 rounded-2xl p-4 text-center hover:border-gray-700 transition">
                <span className="block text-2xl font-black text-emerald-400">{totalDescargas}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1 block">Descargas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Colección de Juegos */}
      <section>
        <h2 className="text-2xl font-black tracking-tight text-white mb-6 flex items-center gap-3">
          Colección Pública
          <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full font-mono">
            {proyectos.length}
          </span>
        </h2>

        {proyectos.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-gray-800 rounded-3xl bg-gray-950/40 backdrop-blur-md">
            <span className="text-5xl block mb-4">📦</span>
            <h3 className="text-xl font-bold text-gray-300">Colección vacía</h3>
            <p className="text-gray-500 text-sm mt-1">Este creador no ha publicado proyectos todavía.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {proyectos.map((proyecto) => {
              const colorTema = proyecto.accent_color || "#3b82f6";

              return (
                <article key={proyecto.id} className="bg-gray-950/50 border border-gray-800/80 hover:border-gray-700 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col group backdrop-blur-md">
                  <Link href={`/proyecto/${proyecto.id}`} className="block relative aspect-video w-full bg-gray-900 overflow-hidden cursor-pointer">
                    {proyecto.cover_file_id ? (
                      <img src={`https://lh3.googleusercontent.com/d/${proyecto.cover_file_id}`} alt={proyecto.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
                        <span className="text-4xl opacity-30">🎮</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent opacity-80" />
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg border text-white backdrop-blur-md shadow-lg" style={{ backgroundColor: `${colorTema}44`, borderColor: `${colorTema}88` }}>
                        {proyecto.category || "General"}
                      </span>
                    </div>
                    <div className="absolute -bottom-4 left-5 w-14 h-14 rounded-2xl border-2 overflow-hidden bg-gray-950 shadow-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ borderColor: `${colorTema}aa` }}>
                      {proyecto.icon_file_id ? (
                        <img src={`https://lh3.googleusercontent.com/d/${proyecto.icon_file_id}`} alt="Icono" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🕹️</span>
                      )}
                    </div>
                  </Link>
                  
                  <div className="p-6 pt-8 flex-1 flex flex-col justify-between">
                    <div>
                      <Link href={`/proyecto/${proyecto.id}`}>
                        <h2 className="text-xl font-black text-white group-hover:text-blue-400 transition truncate cursor-pointer">{proyecto.title}</h2>
                      </Link>
                      <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed">{proyecto.description || "Sin descripción proporcionada."}</p>
                    </div>
                    
                    <div className="mt-6 pt-5 border-t border-gray-800/60 flex items-center justify-between">
                      <div className="text-[11px] text-gray-500 font-medium">
                        {new Date(proyecto.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
                        <span className="flex items-center gap-1" title="Descargas"><span className="text-base">📥</span> {proyecto.downloads_count || 0}</span>
                        <span className="flex items-center gap-1" title="Peso en MB"><span className="text-base">📦</span> {proyecto.file_size_mb}M</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default function PerfilCreador() {
  return (
    <main className="min-h-screen bg-[#070709] text-white p-6 md:p-12 relative overflow-hidden">
      {/* Resplandor ambiental decorativo de la página */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />
      
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-32 text-gray-500 relative z-10">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        </div>
      }>
        <ContenidoPerfil />
      </Suspense>
    </main>
  );
}