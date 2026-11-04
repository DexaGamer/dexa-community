"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface PerfilAutor {
  username?: string;
  avatar_url?: string;
  display_name?: string;
}

interface ProyectoDetalle {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  drive_file_id: string;
  cover_file_id?: string;
  icon_file_id?: string;
  file_size_mb: number;
  category?: string;
  accent_color?: string;
  downloads_count: number;
  created_at: string;
  social_discord?: string;
  social_youtube?: string;
  social_web?: string;
}

function ContenidoProyecto() {
  const params = useParams();
  const proyectoId = params?.id as string;

  const [montado, setMontado] = useState(false);
  const [proyecto, setProyecto] = useState<ProyectoDetalle | null>(null);
  const [autor, setAutor] = useState<PerfilAutor | null>(null);
  const [cargando, setCargando] = useState(true);
  
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [esFavorito, setEsFavorito] = useState(false);
  const [descargando, setDescargando] = useState(false);

  // Estados de Estrellas
  const [miVoto, setMiVoto] = useState<number>(0);
  const [hoverVoto, setHoverVoto] = useState<number>(0);
  const [promedioEstrellas, setPromedioEstrellas] = useState<number>(0);
  const [totalVotos, setTotalVotos] = useState<number>(0);
  const [votando, setVotando] = useState<boolean>(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado || !proyectoId) return;

    async function cargarDetalles() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUsuarioId(user.id);

      const { data: proj } = await supabase
        .from("projects")
        .select("*")
        .eq("id", proyectoId)
        .single();

      if (!proj) {
        setCargando(false);
        return;
      }
      setProyecto(proj);

      if (proj.owner_id) {
        const { data: perf } = await supabase
          .from("profiles")
          .select("username, display_name, avatar_url")
          .eq("id", proj.owner_id)
          .single();
        if (perf) setAutor(perf);
      }

      if (user) {
        const { data: fav } = await supabase
          .from("user_favorites")
          .select("id")
          .eq("user_id", user.id)
          .eq("project_id", proyectoId)
          .single();
        if (fav) setEsFavorito(true);
      }

      // Cargar Calificaciones (Estrellas)
      const { data: ratingsData } = await supabase
        .from("project_ratings")
        .select("user_id, stars")
        .eq("project_id", proyectoId);

      if (ratingsData && ratingsData.length > 0) {
        setTotalVotos(ratingsData.length);
        const suma = ratingsData.reduce((acc, r) => acc + r.stars, 0);
        setPromedioEstrellas(parseFloat((suma / ratingsData.length).toFixed(1)));

        if (user) {
          const votoUsuario = ratingsData.find((r) => r.user_id === user.id);
          if (votoUsuario) setMiVoto(votoUsuario.stars);
        }
      }

      setCargando(false);
    }

    cargarDetalles();
  }, [proyectoId, montado]);

  // Función para calificar
  const manejarCalificacion = async (estrellas: number) => {
    if (!usuarioId) {
      alert("Debes iniciar sesión para calificar este proyecto.");
      return;
    }
    setVotando(true);
    setMiVoto(estrellas);

    const { error } = await supabase
      .from("project_ratings")
      .upsert(
        { project_id: proyectoId, user_id: usuarioId, stars: estrellas },
        { onConflict: "project_id,user_id" }
      );

    if (!error) {
      const { data: ratingsActualizados } = await supabase
        .from("project_ratings")
        .select("stars")
        .eq("project_id", proyectoId);

      if (ratingsActualizados) {
        setTotalVotos(ratingsActualizados.length);
        const suma = ratingsActualizados.reduce((acc, r) => acc + r.stars, 0);
        setPromedioEstrellas(parseFloat((suma / ratingsActualizados.length).toFixed(1)));
      }
    }
    setVotando(false);
  };

  const toggleFavorito = async () => {
    if (!usuarioId) {
      alert("Inicia sesión para guardar este proyecto.");
      return;
    }
    setEsFavorito(!esFavorito);
    try {
      await fetch("/api/favorites", {
        method: "POST",
        body: JSON.stringify({ project_id: proyectoId }),
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error al actualizar favorito", error);
    }
  };

  const manejarDescarga = async () => {
    if (!proyecto) return;
    setDescargando(true);
    await supabase.rpc('increment_download', { row_id: proyecto.id });
    setProyecto({ ...proyecto, downloads_count: proyecto.downloads_count + 1 });
    window.location.href = `https://drive.google.com/uc?export=download&id=${proyecto.drive_file_id}`;
    setTimeout(() => setDescargando(false), 2000);
  };

  const baseClasses = "max-w-5xl mx-auto relative z-10";

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
      </div>
    );
  }

  if (!proyecto) return null;

  const colorTema = proyecto.accent_color || "#3b82f6";
  const esDuenio = usuarioId === proyecto.owner_id;

  return (
    <div className={baseClasses}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] blur-[150px] pointer-events-none rounded-full opacity-20" style={{ backgroundColor: colorTema }} />

      <div className="mb-6 flex justify-between items-center relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition bg-gray-900/60 border border-gray-800 px-4 py-2.5 rounded-xl backdrop-blur-md">
          <span>←</span> Volver al Catálogo
        </Link>
        {esDuenio && (
          <Link href={`/subir?id=${proyecto.id}`} className="text-xs bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500 text-indigo-300 hover:text-white px-4 py-2.5 rounded-xl transition shadow-lg font-bold">
            ✏️ Gestionar Build
          </Link>
        )}
      </div>

      {/* Banner Superior */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl mb-8 relative z-10">
        <div className="w-full aspect-[21/9] md:aspect-[3/1] bg-gray-950 relative">
          {proyecto.cover_file_id ? (
            <img src={`https://lh3.googleusercontent.com/d/${proyecto.cover_file_id}`} alt="Banner" className="w-full h-full object-cover opacity-80" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
              <span className="text-6xl opacity-30">🎮</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070709] via-transparent to-transparent opacity-90" />
        </div>

        <div className="px-6 md:px-10 pb-8 flex flex-col md:flex-row gap-6 items-start md:items-end -mt-16 md:-mt-24 relative z-10">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl border-4 border-[#070709] bg-gray-950 shadow-2xl flex items-center justify-center overflow-hidden shrink-0" style={{ borderColor: `${colorTema}aa` }}>
            {proyecto.icon_file_id ? (
              <img src={`https://lh3.googleusercontent.com/d/${proyecto.icon_file_id}`} alt="Icono" className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl">🕹️</span>
            )}
          </div>

          <div className="flex-1 w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="inline-block px-3 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase mb-2 border backdrop-blur-md" style={{ backgroundColor: `${colorTema}33`, borderColor: `${colorTema}88`, color: colorTema }}>
                {proyecto.category || "General"}
              </span>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2">{proyecto.title}</h1>
              <Link href={`/perfil/${proyecto.owner_id}`} className="flex items-center gap-2 group hover:opacity-80 transition w-fit">
                <div className="w-6 h-6 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center text-[10px]">
                  {autor?.avatar_url ? <img src={autor.avatar_url} alt="Autor" className="w-full h-full object-cover" /> : "👾"}
                </div>
                <span className="text-sm font-bold text-gray-400 group-hover:text-white">
                  {autor?.display_name || autor?.username || "Creador"} <span className="font-normal text-gray-500">(@{autor?.username})</span>
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={toggleFavorito}
                className={`h-14 px-6 rounded-2xl border-2 flex items-center justify-center transition-all ${
                  esFavorito ? "bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                }`}
                title="Añadir a Favoritos"
              >
                <span className="text-2xl">{esFavorito ? "💖" : "🤍"}</span>
              </button>

              <button
                onClick={manejarDescarga}
                disabled={descargando}
                className="h-14 flex-1 md:w-56 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95 text-white"
                style={{ backgroundColor: colorTema, boxShadow: `0 4px 20px ${colorTema}44` }}
              >
                {descargando ? <span className="animate-pulse">Preparando...</span> : <><span className="text-xl">⬇️</span> Descargar .catrobat</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detalles e Información (2 Columnas) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Columna Izquierda: Descripción y Redes */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-gray-900/40 border border-gray-800 rounded-3xl p-8 backdrop-blur-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span style={{ color: colorTema }}>📝</span> Descripción
            </h2>
            <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
              {proyecto.description || "El creador no ha proporcionado una descripción."}
            </div>

            {/* Enlaces Sociales integrados */}
            {(proyecto.social_discord || proyecto.social_youtube || proyecto.social_web) && (
              <div className="mt-8 pt-6 border-t border-gray-800/60 flex flex-wrap gap-3">
                {proyecto.social_discord && (
                  <a href={proyecto.social_discord} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#5865F2] px-4 py-2.5 rounded-xl text-xs font-bold transition">
                    <span className="text-base">💬</span> Discord
                  </a>
                )}
                {proyecto.social_youtube && (
                  <a href={proyecto.social_youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-xl text-xs font-bold transition">
                    <span className="text-base">📺</span> YouTube
                  </a>
                )}
                {proyecto.social_web && (
                  <a href={proyecto.social_web} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-bold transition">
                    <span className="text-base">🌐</span> Web
                  </a>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Columna Derecha: Valoración y Estadísticas */}
        <div className="space-y-6">
          
          {/* Tarjeta de Estrellas */}
          <section className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 backdrop-blur-md">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Valoración</h3>
            <div className="bg-gray-950/50 rounded-2xl border border-gray-800 p-5 flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-amber-400 mb-2 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                {promedioEstrellas > 0 ? promedioEstrellas : "—"}
              </span>
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    disabled={votando}
                    onClick={() => manejarCalificacion(star)}
                    onMouseEnter={() => setHoverVoto(star)}
                    onMouseLeave={() => setHoverVoto(0)}
                    className="text-2xl transition-transform hover:scale-125 focus:outline-none"
                  >
                    <span className={(hoverVoto || miVoto) >= star ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "text-gray-800"}>
                      ★
                    </span>
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                {totalVotos} {totalVotos === 1 ? 'voto' : 'votos'} {miVoto > 0 && <span className="text-blue-400 block mt-1 text-center">(Tu voto: {miVoto}★)</span>}
              </span>
            </div>
          </section>

          {/* Tarjeta de Estadísticas */}
          <section className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 backdrop-blur-md">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Estadísticas</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-gray-950/50 p-3.5 rounded-xl border border-gray-800">
                <span className="text-gray-400 text-xs font-bold uppercase">Descargas</span>
                <span className="font-mono text-lg font-black text-white">{proyecto.downloads_count}</span>
              </div>
              <div className="flex justify-between items-center bg-gray-950/50 p-3.5 rounded-xl border border-gray-800">
                <span className="text-gray-400 text-xs font-bold uppercase">Tamaño</span>
                <span className="font-mono text-lg font-black text-white">{proyecto.file_size_mb} MB</span>
              </div>
              <div className="flex justify-between items-center bg-gray-950/50 p-3.5 rounded-xl border border-gray-800">
                <span className="text-gray-400 text-xs font-bold uppercase">Publicado</span>
                <span className="font-mono text-sm font-bold text-gray-300">
                  {new Date(proyecto.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

export default function PaginaProyecto() {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  
  const baseClasses = "min-h-screen bg-[#070709] text-white p-6 md:p-12 relative overflow-hidden";
  if (!montado) return <main className={baseClasses}></main>;

  return (
    <main className={baseClasses}>
      <Suspense fallback={<div className="text-center py-24 text-gray-500 text-sm">Cargando proyecto...</div>}>
        <ContenidoProyecto />
      </Suspense>
    </main>
  );
}