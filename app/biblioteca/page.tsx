"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface PerfilAutor {
  username?: string;
  avatar_url?: string;
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
}

const CATEGORIAS = [
  "Todas",
  "Terror",
  "Plataformas",
  "Acción",
  "Aventura",
  "Minijuegos",
  "General",
];

export default function MiBiblioteca() {
  const [montado, setMontado] = useState(false);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [usuarioActivo, setUsuarioActivo] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [eliminando, setEliminando] = useState<string | null>(null);

  const baseClasses =
    "min-h-screen bg-[#070709] text-white p-6 md:p-12 relative overflow-hidden";

  // ==========================================
  // HIDRATACIÓN
  // ==========================================

  useEffect(() => {
    setMontado(true);
  }, []);

  // ==========================================
  // CARGAR BIBLIOTECA
  // ==========================================

  const cargarBiblioteca = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      // 1. Obtener usuario autenticado.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        window.location.href = "/";
        return;
      }

      setUsuarioActivo(user.id);

      // 2. Obtener favoritos ordenados por fecha.
      const { data: favs, error: favError } = await supabase
        .from("user_favorites")
        .select("project_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (favError) throw favError;

      if (!favs || favs.length === 0) {
        setProyectos([]);
        setFavoritos(new Set());
        return;
      }

      const favIds = favs.map((f) => f.project_id);

      setFavoritos(new Set(favIds));

      // 3. Consultar los proyectos.
      const { data: listaProyectos, error: proyectosError } =
        await supabase
          .from("projects")
          .select("*")
          .in("id", favIds);

      if (proyectosError) throw proyectosError;

      if (!listaProyectos || listaProyectos.length === 0) {
        setProyectos([]);
        return;
      }

      // 4. Obtener perfiles en una segunda consulta.
      const ownerIds = [
        ...new Set(
          listaProyectos
            .map((p) => p.owner_id)
            .filter(Boolean)
        ),
      ];

      const perfilesMap = new Map<string, PerfilAutor>();

      if (ownerIds.length > 0) {
        const { data: listaPerfiles, error: perfilesError } =
          await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", ownerIds);

        if (perfilesError) throw perfilesError;

        listaPerfiles?.forEach((perfil) => {
          perfilesMap.set(perfil.id, {
            username: perfil.username,
            avatar_url: perfil.avatar_url,
          });
        });
      }

      // 5. Relacionar proyectos y perfiles.
      const proyectosCombinados: Proyecto[] = listaProyectos.map(
        (p) => ({
          ...p,
          profiles: perfilesMap.get(p.owner_id) || {
            username: "usuario",
          },
        })
      );

      // 6. Restaurar el orden original de favoritos.
      const ordenFavoritos = new Map(
        favIds.map((id, index) => [id, index])
      );

      proyectosCombinados.sort(
        (a, b) =>
          (ordenFavoritos.get(a.id) ?? Infinity) -
          (ordenFavoritos.get(b.id) ?? Infinity)
      );

      setProyectos(proyectosCombinados);
    } catch (err) {
      console.error("Error cargando biblioteca:", err);
      setError("No se pudo cargar tu biblioteca. Inténtalo nuevamente.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (montado) {
      void cargarBiblioteca();
    }
  }, [montado, cargarBiblioteca]);

  // ==========================================
  // QUITAR FAVORITO
  // ==========================================

  async function quitarFavorito(projectId: string) {
    if (!usuarioActivo || eliminando) return;

    setEliminando(projectId);
    setError("");

    try {
      // Eliminación directa: no usamos un toggle.
      const { error: deleteError } = await supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", usuarioActivo)
        .eq("project_id", projectId);

      if (deleteError) throw deleteError;

      setProyectos((actuales) =>
        actuales.filter((p) => p.id !== projectId)
      );

      setFavoritos((actuales) => {
        const nuevos = new Set(actuales);
        nuevos.delete(projectId);
        return nuevos;
      });
    } catch (err) {
      console.error("Error quitando favorito:", err);
      setError(
        "No se pudo quitar el proyecto de favoritos. Comprueba tu conexión."
      );
    } finally {
      setEliminando(null);
    }
  }

  // ==========================================
  // BUSCADOR Y FILTROS
  // ==========================================

  const categoriasDisponibles = useMemo(() => {
    const categorias = new Set(
      proyectos.map((p) => p.category || "General")
    );

    return [
      "Todas",
      ...CATEGORIAS.filter(
        (c) => c !== "Todas" && categorias.has(c)
      ),
    ];
  }, [proyectos]);

  const proyectosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return proyectos.filter((p) => {
      const coincideBusqueda =
        !termino ||
        p.title.toLowerCase().includes(termino) ||
        (p.profiles?.username || "")
          .toLowerCase()
          .includes(termino);

      const coincideCategoria =
        categoriaActiva === "Todas" ||
        (p.category || "General") === categoriaActiva;

      return coincideBusqueda && coincideCategoria;
    });
  }, [proyectos, busqueda, categoriaActiva]);

  // ==========================================
  // RENDERIZADO
  // ==========================================

  if (!montado) {
    return <main className={baseClasses}></main>;
  }

  return (
    <main className={baseClasses}>

      {/* ILUMINACIÓN AMBIENTAL */}

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-red-600/10 blur-[120px] pointer-events-none rounded-full" />

      {/* ENCABEZADO */}

      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center pb-8 border-b border-gray-800/80 gap-6 relative z-10">

        <div className="text-center md:text-left">

          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-pink-500 to-purple-500">
            Mi Biblioteca
          </h1>

          <p className="text-gray-400 text-sm mt-2">
            Tus proyectos guardados de Dexa Community.
          </p>

          <div className="flex items-center gap-3 mt-3 justify-center md:justify-start">

            <span className="text-xs text-gray-500">
              💖 {proyectos.length} juegos guardados
            </span>

            {busqueda || categoriaActiva !== "Todas" ? (
              <span className="text-xs text-blue-400">
                {proyectosFiltrados.length} resultados
              </span>
            ) : null}

          </div>

        </div>

        <Link
          href="/"
          className="px-6 py-3 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 transition shadow-lg text-sm font-bold"
        >
          ← Volver al Catálogo
        </Link>

      </header>

      {/* CONTENIDO */}

      <section className="max-w-7xl mx-auto mt-10 relative z-10">

        {/* BARRA DE BÚSQUEDA */}

        {!cargando && proyectos.length > 0 && (

          <div className="flex flex-col md:flex-row gap-3 mb-8">

            <div className="relative flex-1">

              <span className="absolute left-4 top-3 text-gray-500">
                🔍
              </span>

              <input
                type="text"
                placeholder="Buscar juego o creador..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full bg-gray-900/60 border border-gray-800 rounded-xl pl-11 pr-4 py-3 text-white text-sm outline-none focus:border-purple-500 transition"
              />

            </div>

            <select
              value={categoriaActiva}
              onChange={(e) => setCategoriaActiva(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-gray-300 text-sm outline-none focus:border-purple-500"
            >
              {categoriasDisponibles.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria === "Todas"
                    ? "Todas las categorías"
                    : categoria}
                </option>
              ))}
            </select>

          </div>

        )}

        {/* ERROR */}

        {error && (

          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex flex-col sm:flex-row justify-between gap-3">

            <p className="text-sm text-red-300">
              ⚠️ {error}
            </p>

            <button
              onClick={() => cargarBiblioteca()}
              className="text-sm font-bold text-red-300 hover:text-white"
            >
              Reintentar
            </button>

          </div>

        )}

        {/* CARGANDO */}

        {cargando ? (

          <div className="flex flex-col items-center justify-center py-24 text-gray-500">

            <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin mb-4"></div>

            <p className="text-sm">
              Cargando tu biblioteca...
            </p>

          </div>

        ) : proyectos.length === 0 ? (

          /* BIBLIOTECA VACÍA */

          <div className="text-center py-24 border border-dashed border-gray-800 rounded-3xl bg-gray-950/40 backdrop-blur-md">

            <span className="text-5xl block mb-4">
              🤍
            </span>

            <h3 className="text-xl font-bold text-gray-300">
              Aún no tienes favoritos
            </h3>

            <p className="text-gray-500 text-sm mt-1">
              Explora el catálogo y dale al corazón para guardar juegos aquí.
            </p>

            <Link
              href="/"
              className="inline-block mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition"
            >
              Explorar Juegos
            </Link>

          </div>

        ) : proyectosFiltrados.length === 0 ? (

          /* SIN RESULTADOS */

          <div className="text-center py-20 border border-dashed border-gray-800 rounded-3xl bg-gray-950/40">

            <span className="text-4xl block mb-4">
              🔎
            </span>

            <h3 className="text-lg font-bold text-gray-300">
              No encontramos juegos
            </h3>

            <p className="text-gray-500 text-sm mt-2">
              Prueba con otro nombre o categoría.
            </p>

            <button
              onClick={() => {
                setBusqueda("");
                setCategoriaActiva("Todas");
              }}
              className="mt-5 text-sm text-blue-400 hover:text-blue-300 font-bold"
            >
              Limpiar filtros
            </button>

          </div>

        ) : (

          /* GRID DE PROYECTOS */

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {proyectosFiltrados.map((proyecto) => {

              const colorTema = proyecto.accent_color || "#3b82f6";
              const estaEliminando = eliminando === proyecto.id;

              return (

                <article
                  key={proyecto.id}
                  className="bg-gray-950/50 border border-gray-800/80 hover:border-gray-700 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10 flex flex-col group backdrop-blur-md relative"
                >

                  {/* PORTADA */}

                  <div className="relative aspect-video w-full bg-gray-900 overflow-hidden">

                    <Link
                      href={`/proyecto/${proyecto.id}`}
                      className="block w-full h-full"
                    >

                      {proyecto.cover_file_id ? (

                        <img
                          src={`https://lh3.googleusercontent.com/d/${proyecto.cover_file_id}`}
                          alt={proyecto.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />

                      ) : (

                        <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
                          <span className="text-4xl opacity-30">
                            🎮
                          </span>
                        </div>

                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent opacity-80 pointer-events-none" />

                    </Link>

                    {/* FAVORITO */}

                    <button
                      onClick={() => quitarFavorito(proyecto.id)}
                      disabled={Boolean(eliminando)}
                      className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full border flex items-center justify-center transition-all hover:scale-110 bg-red-500/20 border-red-500/50 text-red-500 backdrop-blur-md disabled:opacity-50"
                      title="Quitar de favoritos"
                    >
                      {estaEliminando ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        "💖"
                      )}
                    </button>

                    {/* CATEGORÍA */}

                    <div className="absolute top-4 right-4 flex items-center gap-2 z-10 pointer-events-none">

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

                    {/* ICONO */}

                    <Link
                      href={`/proyecto/${proyecto.id}`}
                      className="absolute -bottom-4 left-5 w-14 h-14 rounded-2xl border-2 overflow-hidden bg-gray-950 shadow-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{
                        borderColor: `${colorTema}aa`,
                      }}
                    >

                      {proyecto.icon_file_id ? (

                        <img
                          src={`https://lh3.googleusercontent.com/d/${proyecto.icon_file_id}`}
                          alt={`Icono de ${proyecto.title}`}
                          className="w-full h-full object-cover"
                        />

                      ) : (

                        <span className="text-xl">
                          🕹️
                        </span>

                      )}

                    </Link>

                  </div>

                  {/* INFORMACIÓN */}

                  <div className="p-6 pt-8 flex-1 flex flex-col justify-between">

                    <div>

                      <Link href={`/proyecto/${proyecto.id}`}>

                        <h2 className="text-xl font-black text-white group-hover:text-blue-400 transition truncate cursor-pointer">
                          {proyecto.title}
                        </h2>

                      </Link>

                      <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed">
                        {proyecto.description || "Sin descripción proporcionada."}
                      </p>

                    </div>

                    {/* ESTADÍSTICAS */}

                    <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-500">

                      <span>
                        📦 {proyecto.file_size_mb ?? 0} MB
                      </span>

                      <span>
                        ⬇️ {proyecto.downloads_count ?? 0} descargas
                      </span>

                    </div>

                    {/* AUTOR */}

                    <div className="mt-5 pt-5 border-t border-gray-800/60 flex items-center justify-between">

                      <Link
                        href={`/perfil/${proyecto.owner_id}`}
                        className="flex items-center gap-2.5 group/author hover:opacity-80 transition min-w-0"
                      >

                        <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden text-xs shrink-0">

                          {proyecto.profiles?.avatar_url ? (

                            <img
                              src={proyecto.profiles.avatar_url}
                              alt="Avatar del creador"
                              className="w-full h-full object-cover"
                            />

                          ) : (
                            "👾"
                          )}

                        </div>

                        <span className="text-xs font-bold text-gray-400 group-hover/author:text-white transition truncate max-w-[130px]">
                          @{proyecto.profiles?.username || "usuario"}
                        </span>

                      </Link>

                      <Link
                        href={`/proyecto/${proyecto.id}`}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300 transition shrink-0"
                      >
                        Ver juego →
                      </Link>

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