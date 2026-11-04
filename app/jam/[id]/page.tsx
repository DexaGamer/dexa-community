"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface GameJam {
  id: string;
  title: string;
  theme: string;
  description: string;
  accent_color: string;
  banner_url?: string;
  starts_at: string;
  ends_at: string;
  reward: string;
  is_active: boolean;
}

interface ProyectoJam {
  id: string;
  title: string;
  description: string;
  cover_file_id?: string;
  icon_file_id?: string;
  file_size_mb: number;
  downloads_count: number;
  owner_id: string;
  profiles?: {
    username?: string;
    avatar_url?: string;
  };
}

function ContenidoSalaJam() {
  const params = useParams();
  const jamId = params.id as string;

  const [jam, setJam] = useState<GameJam | null>(null);
  const [proyectos, setProyectos] = useState<ProyectoJam[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tiempoRestante, setTiempoRestante] = useState("");

  useEffect(() => {
    async function cargarSala() {
      if (!jamId) return;
      setCargando(true);

      // 1. Cargar detalles de la Jam
      const { data: dataJam } = await supabase
        .from("game_jams")
        .select("*")
        .eq("id", jamId)
        .single();

      if (dataJam) setJam(dataJam);

      // 2. Cargar proyectos inscritos en esta Jam
      const { data: dataProjs } = await supabase
        .from("projects")
        .select("*")
        .eq("jam_id", jamId)
        .eq("visibility", "public")
        .order("created_at", { ascending: false });

      if (dataProjs && dataProjs.length > 0) {
        const ownerIds = Array.from(new Set(dataProjs.map((p) => p.owner_id)));
        const { data: perfiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", ownerIds);

        const perfilesMap = new Map((perfiles || []).map((prof) => [prof.id, prof]));

        const combinados = dataProjs.map((p) => ({
          ...p,
          profiles: perfilesMap.get(p.owner_id) || { username: "creador" },
        }));

        setProyectos(combinados);
      } else {
        setProyectos([]);
      }

      setCargando(false);
    }

    cargarSala();
  }, [jamId]);

  // Reloj regresivo
  useEffect(() => {
    if (!jam) return;

    const actualizarReloj = () => {
      const ahora = new Date().getTime();
      const limite = new Date(jam.ends_at).getTime();
      const diff = limite - ahora;

      if (diff <= 0) {
        setTiempoRestante("¡Tiempo terminado!");
        return;
      }

      const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
      const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((diff % (1000 * 60)) / 1000);

      setTiempoRestante(`${dias}d ${horas}h ${minutos}m ${segundos}s`);
    };

    actualizarReloj();
    const interval = setInterval(actualizarReloj, 1000);
    return () => clearInterval(interval);
  }, [jam]);

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#070709] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </main>
    );
  }

  if (!jam) {
    return (
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center p-6 text-center">
        <span className="text-5xl mb-4">🏆</span>
        <h1 className="text-2xl font-black">Jam no encontrada</h1>
        <p className="text-gray-400 text-xs mt-2">Este evento no existe o fue retirado.</p>
        <Link href="/" className="mt-6 px-5 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-xs font-bold">
          ← Volver al Catálogo
        </Link>
      </main>
    );
  }

  const color = jam.accent_color || "#8b5cf6";

  return (
    <main className="min-h-screen bg-[#070709] text-white p-6 md:p-12 relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] blur-[150px] pointer-events-none rounded-full"
        style={{ backgroundColor: `${color}25` }}
      />

      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white transition">
          ← Volver al Catálogo Principal
        </Link>

        {/* Portada Principal de la Jam */}
        <section
          className="relative min-h-[350px] rounded-3xl overflow-hidden border bg-gray-950 p-8 md:p-14 flex flex-col justify-between shadow-2xl"
          style={{
            borderColor: `${color}88`,
            boxShadow: `0 0 60px ${color}33`,
          }}
        >
          {jam.banner_url && (
            <img
              src={
                jam.banner_url.startsWith("http")
                  ? jam.banner_url
                  : `https://lh3.googleusercontent.com/d/${jam.banner_url}`
              }
              alt={jam.title}
              className="absolute inset-0 w-full h-full object-cover opacity-35"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-transparent" />

          <div className="relative z-10 space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase font-mono tracking-widest border"
              style={{
                backgroundColor: `${color}25`,
                borderColor: `${color}88`,
                color: color,
              }}
            >
              <span>🏆</span> Evento Oficial
            </div>

            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white">{jam.title}</h1>

            <p className="text-lg md:text-xl text-gray-200">
              Temática: <strong className="font-mono bg-black/60 px-3 py-1 rounded-lg border border-gray-800" style={{ color }}>"{jam.theme}"</strong>
            </p>

            {jam.description && (
              <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">{jam.description}</p>
            )}

            <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono">
              <div className="bg-gray-900/80 border border-gray-800 px-4 py-2 rounded-xl">
                <span className="text-gray-500 block text-[10px]">TIEMPO RESTANTE</span>
                <span className="font-bold text-white text-sm">{tiempoRestante}</span>
              </div>
              {jam.reward && (
                <div className="bg-gray-900/80 border border-gray-800 px-4 py-2 rounded-xl">
                  <span className="text-gray-500 block text-[10px]">PREMIO</span>
                  <span className="font-bold text-amber-300 text-sm">{jam.reward}</span>
                </div>
              )}
            </div>
          </div>

          <div className="relative z-10 pt-6 flex items-center justify-between border-t border-gray-800/80 mt-6">
            <span className="text-xs font-mono text-gray-400">
              {proyectos.length} {proyectos.length === 1 ? "juego compitiendo" : "juegos compitiendo"}
            </span>

            <Link
              href={`/subir?jam=${jam.id}`}
              className="px-6 py-3 rounded-xl font-bold text-xs text-white transition active:scale-95 shadow-xl flex items-center gap-2"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 25px ${color}66`,
              }}
            >
              <span>➕ Subir Juego a esta Jam</span>
            </Link>
          </div>
        </section>

        {/* Galería de Juegos Inscritos */}
        <section className="space-y-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <span>🎮</span> Galería de Creaciones
          </h2>

          {proyectos.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-gray-800 rounded-3xl bg-gray-950/40">
              <span className="text-5xl block mb-3">🕹️</span>
              <h3 className="text-lg font-bold text-gray-300">Aún no hay juegos en esta Jam</h3>
              <p className="text-xs text-gray-500 mt-1">Sé el primer creador en publicar un juego con esta temática.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {proyectos.map((proyecto) => (
                <article
                  key={proyecto.id}
                  className="rounded-3xl border-2 overflow-hidden flex flex-col group backdrop-blur-md transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: `${color}88`,
                    background: `linear-gradient(180deg, ${color}20 0%, rgba(10, 10, 15, 0.95) 100%)`,
                    boxShadow: `0 0 30px ${color}25`,
                  }}
                >
                  <Link href={`/proyecto/${proyecto.id}`} className="block relative aspect-video w-full bg-gray-900 overflow-hidden">
                    {proyecto.cover_file_id ? (
                      <img
                        src={`https://lh3.googleusercontent.com/d/${proyecto.cover_file_id}`}
                        alt={proyecto.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
                        <span className="text-4xl opacity-30">🎮</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent opacity-80" />
                  </Link>

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <Link href={`/proyecto/${proyecto.id}`}>
                        <h3 className="text-xl font-black text-white group-hover:text-purple-400 transition truncate">
                          {proyecto.title}
                        </h3>
                      </Link>
                      <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed">
                        {proyecto.description || "Proyecto creado especialmente para esta Jam."}
                      </p>
                    </div>

                    <div className="mt-6 pt-5 border-t border-gray-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center text-[10px]">
                          {proyecto.profiles?.avatar_url ? (
                            <img src={proyecto.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            "👾"
                          )}
                        </div>
                        <span className="text-xs font-mono text-gray-400">@{proyecto.profiles?.username}</span>
                      </div>

                      <span className="text-xs font-mono text-gray-500">📥 {proyecto.downloads_count || 0}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function SalaDeLaJam() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#070709] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        </main>
      }
    >
      <ContenidoSalaJam />
    </Suspense>
  );
}