"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

interface PerfilAutor {
  username?: string;
  avatar_url?: string;
}

interface DatosJamProyecto {
  id: string;
  title: string;
  accent_color: string;
}

interface Proyecto {
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
  downloads_count?: number;
  created_at: string;
  profiles?: PerfilAutor;
  is_featured?: boolean;
  jam_id?: string | null;
  jam_data?: DatosJamProyecto | null;
}

interface AnuncioGlobal {
  id: string;
  message: string;
  badge_text: string;
  link_url?: string;
  style_type: "info" | "launch" | "warning";
  is_active: boolean;
}

interface GameJamActiva {
  id: string;
  title: string;
  theme: string;
  description?: string;
  accent_color: string;
  starts_at: string;
  ends_at: string;
  reward?: string;
  banner_url?: string;
  is_active: boolean;
}

const CATEGORIAS = ["Todas", "Terror", "Plataformas", "Acción", "Aventura", "Minijuegos", "General"];

export default function CatalogoComunidad() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [usuarioActivo, setUsuarioActivo] = useState<string | null>(null);

  // Estados de Comunidad y Eventos
  const [anuncio, setAnuncio] = useState<AnuncioGlobal | null>(null);
  const [jamActiva, setJamActiva] = useState<GameJamActiva | null>(null);

  // Estados para proyectos destacados
  const [destacados, setDestacados] = useState<Proyecto[]>([]);
  const [indiceDestacado, setIndiceDestacado] = useState(0);

  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todas");
  const [orden, setOrden] = useState<"nuevos" | "descargas">("nuevos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    async function cargarCatalogoCompleto() {
      setCargando(true);

      // 1. Cargar usuario y favoritos
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsuarioActivo(user.id);
        const { data: favs } = await supabase
          .from("user_favorites")
          .select("project_id")
          .eq("user_id", user.id);

        if (favs) {
          setFavoritos(new Set(favs.map((f) => f.project_id)));
        }
      }

      // 2. Cargar Anuncio Global y Jam Activa
      const [anuncioRes, jamRes] = await Promise.all([
        supabase
          .from("global_announcements")
          .select("*")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("game_jams")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (anuncioRes.data) setAnuncio(anuncioRes.data);
      if (jamRes.data) setJamActiva(jamRes.data);

      // 3. Cargar Proyectos
      let query = supabase
        .from("projects")
        .select("*")
        .eq("visibility", "public");

      if (orden === "nuevos") {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order("downloads_count", { ascending: false });
      }

      const { data: listaProyectos, error: errProyectos } = await query;

      if (errProyectos || !listaProyectos) {
        console.error("Error cargando proyectos:", errProyectos);
        setProyectos([]);
        setCargando(false);
        return;
      }

      // 4. Mapear creadores (Profiles)
      const ownerIds = Array.from(new Set(listaProyectos.map((p) => p.owner_id).filter(Boolean)));
      let perfilesMap = new Map<string, PerfilAutor>();

      if (ownerIds.length > 0) {
        const { data: listaPerfiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", ownerIds);

        if (listaPerfiles) {
          listaPerfiles.forEach((prof) => {
            perfilesMap.set(prof.id, {
              username: prof.username,
              avatar_url: prof.avatar_url,
            });
          });
        }
      }

      // 5. Mapear datos de Game Jams para los proyectos participantes
      const jamIds = Array.from(new Set(listaProyectos.map((p) => p.jam_id).filter(Boolean)));
      let jamsMap = new Map<string, DatosJamProyecto>();

      if (jamIds.length > 0) {
        const { data: listaJams } = await supabase
          .from("game_jams")
          .select("id, title, accent_color")
          .in("id", jamIds);

        if (listaJams) {
          listaJams.forEach((j) => {
            jamsMap.set(j.id, j);
          });
        }
      }

      // 6. Combinar proyectos con perfiles y datos de Jam
      const proyectosCombinados: Proyecto[] = listaProyectos.map((p) => ({
        ...p,
        profiles: perfilesMap.get(p.owner_id) || { username: "dexa" },
        jam_data: p.jam_id ? jamsMap.get(p.jam_id) || null : null,
      }));

      setProyectos(proyectosCombinados);

      // Proyectos destacados para el carrusel
      setDestacados(
        proyectosCombinados.filter((proyecto) => proyecto.is_featured === true)
      );

      setIndiceDestacado(0);
      setCargando(false);
    }

    cargarCatalogoCompleto();
  }, [orden]);

  // Rotación automática del carrusel de destacados
  useEffect(() => {
    if (destacados.length <= 1) return;

    const intervalo = setInterval(() => {
      setIndiceDestacado((actual) => (actual + 1) % destacados.length);
    }, 6000);

    return () => clearInterval(intervalo);
  }, [destacados]);

  const toggleFavorito = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!usuarioActivo) {
      alert("Debes iniciar sesión para guardar favoritos.");
      return;
    }

    const nuevosFavs = new Set(favoritos);
    if (nuevosFavs.has(projectId)) {
      nuevosFavs.delete(projectId);
    } else {
      nuevosFavs.add(projectId);
    }
    setFavoritos(nuevosFavs);

    try {
      await fetch("/api/favorites", {
        method: "POST",
        body: JSON.stringify({ project_id: projectId }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error al guardar favorito", error);
    }
  };

  const proyectosFiltrados = proyectos.filter((p) => {
    const pasaCategoria =
      categoriaSeleccionada === "Todas" ||
      (p.category || "General").toLowerCase() === categoriaSeleccionada.toLowerCase();
    const queryLimpiado = busqueda.toLowerCase().trim();
    const pasaBusqueda =
      queryLimpiado === "" ||
      p.title.toLowerCase().includes(queryLimpiado) ||
      (p.profiles?.username || "").toLowerCase().includes(queryLimpiado);

    return pasaCategoria && pasaBusqueda;
  });

  return (
    <main className="min-h-screen bg-[#070709] text-white p-6 md:p-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />

      {/* 1. MARQUESINA / ANUNCIO GLOBAL SUPERIOR */}
      {anuncio && anuncio.is_active && anuncio.message && (
        <div className="max-w-7xl mx-auto mb-6 relative z-20">
          <div
            className={`p-3.5 px-5 rounded-2xl border flex items-center justify-between gap-4 text-xs backdrop-blur-md shadow-xl transition-all ${
              anuncio.style_type === "launch"
                ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-200 shadow-emerald-500/10"
                : anuncio.style_type === "warning"
                ? "bg-amber-950/70 border-amber-500/50 text-amber-200 shadow-amber-500/10"
                : "bg-blue-950/70 border-blue-500/50 text-blue-200 shadow-blue-500/10"
            }`}
          >
            <div className="flex items-center gap-3 truncate">
              <span className="font-mono text-[10px] uppercase font-black px-2.5 py-0.5 rounded-md bg-black/50 border border-current shrink-0">
                {anuncio.badge_text || "AVISO"}
              </span>
              <span className="truncate font-medium">{anuncio.message}</span>
            </div>
            {anuncio.link_url && (
              <a
                href={anuncio.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold underline shrink-0 hover:opacity-80 transition"
              >
                Ver más →
              </a>
            )}
          </div>
        </div>
      )}

      {/* CABECERA PRINCIPAL */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center pb-8 border-b border-gray-800/80 gap-6 relative z-10">
        <div className="text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-500">
            Dexa Community
          </h1>
          <p className="text-gray-400 text-sm mt-2">Descubre, descarga y comparte proyectos para Pocket Code.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/cuenta"
            className="p-3 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 transition shadow-lg"
            title="Mi Cuenta"
          >
            ⚙️
          </Link>
          <Link
            href="/subir"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-bold transition shadow-lg shadow-blue-600/20 active:scale-95 text-sm"
          >
            <span>➕</span>
            <span>Publicar Proyecto</span>
          </Link>
        </div>
      </header>

      {/* 2. BANNER DE GAME JAM ACTIVA CON IMAGEN Y NEÓN */}
      {jamActiva && (
        <section className="max-w-7xl mx-auto mt-8 relative z-10">
          <div
            className="relative min-h-[260px] md:min-h-[320px] rounded-3xl overflow-hidden border bg-gray-950 flex flex-col justify-center p-7 md:p-12 shadow-2xl transition-all"
            style={{
              borderColor: `${jamActiva.accent_color}88`,
              boxShadow: `0 0 50px ${jamActiva.accent_color}33, inset 0 0 25px ${jamActiva.accent_color}15`,
            }}
          >
            {/* Imagen de fondo de la Jam si existe */}
            {jamActiva.banner_url && (
              <img
                src={
                  jamActiva.banner_url.startsWith("http")
                    ? jamActiva.banner_url
                    : `https://lh3.googleusercontent.com/d/${jamActiva.banner_url}`
                }
                alt={jamActiva.title}
                className="absolute inset-0 w-full h-full object-cover opacity-35"
              />
            )}

            {/* Degradado oscuro envolvente */}
            <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/85 to-transparent" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 max-w-4xl">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  <span
                    className="text-[10px] font-mono font-black uppercase tracking-widest px-3 py-1 rounded-md border shadow-lg"
                    style={{
                      backgroundColor: `${jamActiva.accent_color}33`,
                      borderColor: `${jamActiva.accent_color}aa`,
                      color: jamActiva.accent_color,
                    }}
                  >
                    DEXA GAME JAM EN CURSO
                  </span>
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                  {jamActiva.title}
                </h2>
                <p className="text-xs md:text-sm text-gray-300">
                  Temática Oficial:{" "}
                  <strong className="text-white font-mono bg-black/60 px-2.5 py-1 rounded-lg border border-gray-800">
                    "{jamActiva.theme}"
                  </strong>
                </p>
                {jamActiva.reward && (
                  <p className="text-xs text-amber-300 font-mono flex items-center gap-1.5">
                    <span>🎁</span> Premio: <strong>{jamActiva.reward}</strong>
                  </p>
                )}
              </div>

              <div className="shrink-0">
                <Link
                  href={`/jam/${jamActiva.id}`}
                  className="px-6 py-3.5 rounded-2xl font-black text-xs text-white transition active:scale-95 shadow-2xl flex items-center gap-2"
                  style={{
                    backgroundColor: jamActiva.accent_color,
                    boxShadow: `0 0 30px ${jamActiva.accent_color}66`,
                  }}
                >
                  <span>Entrar a la Sala de la Jam</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. CARRUSEL DE DESTACADOS */}
      {destacados.length > 0 && (
        <section className="max-w-7xl mx-auto mt-10 relative z-10">
          {(() => {
            const proyecto = destacados[indiceDestacado];
            if (!proyecto) return null;
            const color = proyecto.accent_color || "#6366f1";

            return (
              <div
                className="relative min-h-[320px] md:min-h-[390px] rounded-3xl overflow-hidden border border-gray-800 bg-gray-950 shadow-2xl"
                style={{ boxShadow: `0 15px 60px ${color}20` }}
              >
                {proyecto.cover_file_id && (
                  <img
                    src={`https://lh3.googleusercontent.com/d/${proyecto.cover_file_id}`}
                    alt={proyecto.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/85 to-transparent" />

                <div className="relative z-10 min-h-[320px] md:min-h-[390px] flex flex-col justify-center p-7 md:p-12 max-w-3xl">
                  <span className="text-xs font-black tracking-[0.25em] uppercase text-purple-300 mb-5">
                    ★ Proyecto destacado
                  </span>

                  <div className="flex items-center gap-4 mb-5">
                    <div
                      className="w-16 h-16 rounded-2xl overflow-hidden border-2 bg-gray-900 shrink-0"
                      style={{ borderColor: color }}
                    >
                      {proyecto.icon_file_id ? (
                        <img
                          src={`https://lh3.googleusercontent.com/d/${proyecto.icon_file_id}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">
                          🎮
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">
                        Creado por @{proyecto.profiles?.username || "usuario"}
                      </p>
                      <p className="text-xs text-purple-300 mt-1">
                        {proyecto.category || "General"}
                      </p>
                    </div>
                  </div>

                  <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                    {proyecto.title}
                  </h2>

                  <p className="text-gray-300 mt-4 text-sm md:text-base line-clamp-3">
                    {proyecto.description || "Descubre este proyecto de la comunidad."}
                  </p>

                  <Link
                    href={`/proyecto/${proyecto.id}`}
                    className="mt-7 inline-flex w-fit items-center gap-2 bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-bold text-sm transition"
                  >
                    Explorar proyecto <span>→</span>
                  </Link>

                  {destacados.length > 1 && (
                    <div className="flex items-center gap-3 mt-8">
                      <button
                        onClick={() =>
                          setIndiceDestacado(
                            (actual) => (actual - 1 + destacados.length) % destacados.length
                          )
                        }
                        className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700"
                        aria-label="Anterior"
                      >
                        ←
                      </button>

                      {destacados.map((item, index) => (
                        <button
                          key={item.id}
                          onClick={() => setIndiceDestacado(index)}
                          aria-label={`Ver destacado ${index + 1}`}
                          className={`h-2 rounded-full transition-all ${
                            index === indiceDestacado ? "w-8 bg-purple-400" : "w-2 bg-gray-600"
                          }`}
                        />
                      ))}

                      <button
                        onClick={() =>
                          setIndiceDestacado((actual) => (actual + 1) % destacados.length)
                        }
                        className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700"
                        aria-label="Siguiente"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* BUSCADOR */}
      <section className="max-w-3xl mx-auto mt-8 relative z-10">
        <div className="relative group">
          <span className="absolute left-4 top-3.5 text-gray-500 text-lg group-focus-within:text-blue-500 transition">
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar juegos o @creadores..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-gray-900/60 border-2 border-gray-800/80 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-gray-900 shadow-xl backdrop-blur-md transition-all"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute right-4 top-4 text-gray-500 hover:text-white"
            >
              ✖️
            </button>
          )}
        </div>
      </section>

      {/* BARRA DE CATEGORÍAS Y ORDEN */}
      <section className="max-w-7xl mx-auto mt-8 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center relative z-10">
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaSeleccionada(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                categoriaSeleccionada === cat
                  ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20"
                  : "bg-gray-900/60 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 backdrop-blur-md"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-gray-900/80 border border-gray-800 rounded-xl p-1.5 text-xs backdrop-blur-md">
          <button
            onClick={() => setOrden("nuevos")}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              orden === "nuevos"
                ? "bg-gray-800 text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            ✨ Novedades
          </button>
          <button
            onClick={() => setOrden("descargas")}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              orden === "descargas"
                ? "bg-gray-800 text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            🔥 Top Descargas
          </button>
        </div>
      </section>

      {/* CATÁLOGO DE PROYECTOS */}
      <section className="max-w-7xl mx-auto mt-10 relative z-10">
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-semibold tracking-wider uppercase">Cargando creaciones...</p>
          </div>
        ) : proyectosFiltrados.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-gray-800 rounded-3xl bg-gray-950/40 backdrop-blur-md">
            <span className="text-5xl block mb-4">👻</span>
            <h3 className="text-xl font-bold text-gray-300">Catálogo vacío</h3>
            <p className="text-gray-500 text-sm mt-1">
              Sube tu primer juego para estrenar el catálogo con tu perfil oficial.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {proyectosFiltrados.map((proyecto) => {
              const colorTema = proyecto.accent_color || "#3b82f6";
              const esFavorito = favoritos.has(proyecto.id);
              const esDeJam = Boolean(proyecto.jam_data);
              const colorJam = proyecto.jam_data?.accent_color || colorTema;

              return (
                <article
                  key={proyecto.id}
                  className={`rounded-3xl overflow-visible transition-all duration-300 hover:shadow-2xl flex flex-col group backdrop-blur-md relative ${
                    esDeJam
                      ? "border-2 hover:scale-[1.01]"
                      : "bg-gray-950/50 border border-gray-800/80 hover:border-gray-700 hover:shadow-blue-500/10"
                  }`}
                  style={
                    esDeJam
                      ? {
                          borderColor: colorJam,
                          background: `linear-gradient(180deg, ${colorJam}22 0%, rgba(10, 10, 15, 0.95) 100%)`,
                          boxShadow: `0 0 35px ${colorJam}44, inset 0 0 15px ${colorJam}15`,
                        }
                      : undefined
                  }
                >
                  {/* Contenedor relativo de la Portada */}
                  <div className="relative aspect-video w-full rounded-t-3xl overflow-hidden bg-gray-900">
                    <Link href={`/proyecto/${proyecto.id}`} className="block w-full h-full cursor-pointer">
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

                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent opacity-80" />
                    </Link>

                    {/* Botón Corazón */}
                    <button
                      onClick={(e) => toggleFavorito(e, proyecto.id)}
                      className={`absolute top-4 left-4 z-20 w-9 h-9 rounded-full border flex items-center justify-center transition-all hover:scale-110 ${
                        esFavorito
                          ? "bg-red-500/20 border-red-500/50 text-red-500"
                          : "bg-gray-900/60 border-gray-600 text-gray-300 hover:bg-gray-800"
                      } backdrop-blur-md`}
                      title={esFavorito ? "Quitar de favoritos" : "Guardar en favoritos"}
                    >
                      {esFavorito ? "💖" : "🤍"}
                    </button>

                    {/* Etiquetas Superiores */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
                      {esDeJam && (
                        <span
                          className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border text-white backdrop-blur-md shadow-lg flex items-center gap-1 font-mono"
                          style={{
                            backgroundColor: `${colorJam}88`,
                            borderColor: colorJam,
                            boxShadow: `0 0 15px ${colorJam}`,
                          }}
                        >
                          <span>🏆</span> JAM
                        </span>
                      )}

                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg border text-white backdrop-blur-md shadow-lg"
                        style={{
                          backgroundColor: `${colorTema}44`,
                          borderColor: `${colorTema}88`,
                        }}
                      >
                        {proyecto.category || "General"}
                      </span>
                    </div>
                  </div>

                  {/* ÍCONO FLOTANTE: Ahora está FUERA del overflow-hidden para que NUNCA se corte */}
                  <div
                    className="absolute top-[calc(56.25%-26px)] left-5 w-14 h-14 rounded-2xl border-2 overflow-hidden bg-gray-950 shadow-2xl flex items-center justify-center z-20 transition-transform group-hover:scale-110"
                    style={{ borderColor: `${colorTema}ee` }}
                  >
                    {proyecto.icon_file_id ? (
                      <img
                        src={`https://lh3.googleusercontent.com/d/${proyecto.icon_file_id}`}
                        alt="Icono"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl">🕹️</span>
                    )}
                  </div>

                  {/* Cuerpo de la tarjeta */}
                  <div className="p-6 pt-9 flex-1 flex flex-col justify-between rounded-b-3xl">
                    <div>
                      {esDeJam && (
                        <span
                          className="text-[10px] font-mono font-bold uppercase tracking-wider block mb-1 truncate"
                          style={{ color: colorJam }}
                        >
                          ★ {proyecto.jam_data?.title}
                        </span>
                      )}

                      <Link href={`/proyecto/${proyecto.id}`}>
                        <h2 className="text-xl font-black text-white group-hover:text-blue-400 transition truncate cursor-pointer">
                          {proyecto.title}
                        </h2>
                      </Link>
                      <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed">
                        {proyecto.description || "Sin descripción proporcionada."}
                      </p>
                    </div>

                    <div className="mt-6 pt-5 border-t border-gray-800/60 flex items-center justify-between">
                      <Link
                        href={`/perfil/${proyecto.owner_id}`}
                        className="flex items-center gap-2.5 group/author hover:opacity-80 transition"
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden text-xs">
                          {proyecto.profiles?.avatar_url ? (
                            <img
                              src={proyecto.profiles.avatar_url}
                              alt="Avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            "👾"
                          )}
                        </div>
                        <span className="text-xs font-bold text-gray-400 group-hover/author:text-white transition truncate max-w-[100px]">
                          @{proyecto.profiles?.username || "usuario"}
                        </span>
                      </Link>

                      <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
                        <span className="flex items-center gap-1" title="Descargas">
                          <span className="text-base">📥</span> {proyecto.downloads_count || 0}
                        </span>
                        <span className="flex items-center gap-1" title="Peso en MB">
                          <span className="text-base">📦</span> {proyecto.file_size_mb}M
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}