"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";

interface PerfilAdmin {
  username?: string;
  avatar_url?: string;
}

interface ProyectoAdmin {
  id: string;
  owner_id: string;
  title: string;
  visibility: string;
  category: string;
  file_size_mb: number;
  drive_file_id: string;
  cover_file_id?: string;
  icon_file_id?: string;
  created_at: string;
  is_featured: boolean;
  profiles?: PerfilAdmin;
}

const CATEGORIAS = [
  "Terror",
  "Plataformas",
  "Acción",
  "Aventura",
  "Minijuegos",
  "General",
];

export default function GestionProyectos() {
  const [proyectos, setProyectos] = useState<ProyectoAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [montado, setMontado] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [procesando, setProcesando] = useState<string | null>(null);

  // ==========================================
  // CARGA DE PROYECTOS SIN JOIN
  // ==========================================

  const cargarProyectos = useCallback(async () => {
    setCargando(true);

    try {
      // PASO 1: Obtener todos los proyectos.
      const { data: proyectosData, error: proyectosError } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (proyectosError) throw proyectosError;

      if (!proyectosData || proyectosData.length === 0) {
        setProyectos([]);
        return;
      }

      // PASO 2: Obtener los IDs únicos de los propietarios.
      const ownerIds = [
        ...new Set(
          proyectosData
            .map((p) => p.owner_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      // PASO 3: Consultar los perfiles independientemente.
      const perfilesMap = new Map<string, PerfilAdmin>();

      if (ownerIds.length > 0) {
        const { data: perfilesData, error: perfilesError } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", ownerIds);

        if (perfilesError) throw perfilesError;

        // PASO 4: Crear el Map para relacionar los datos.
        perfilesData?.forEach((perfil) => {
          perfilesMap.set(perfil.id, {
            username: perfil.username,
            avatar_url: perfil.avatar_url,
          });
        });
      }

      // PASO 5: Unir los datos en JavaScript.
      const proyectosCompletos: ProyectoAdmin[] = proyectosData.map(
        (p) => ({
          ...p,
          profiles: perfilesMap.get(p.owner_id) ?? {
            username: "desconocido",
          },
          is_featured: p.is_featured ?? false,
        })
      );

      setProyectos(proyectosCompletos);
    } catch (error) {
      console.error("Error cargando proyectos:", error);
      alert("No se pudieron cargar los proyectos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    setMontado(true);
    void cargarProyectos();
  }, [cargarProyectos]);

  // ==========================================
  // ACTUALIZAR PROYECTOS
  // ==========================================

  async function actualizarProyecto(
    id: string,
    cambios: Partial<
      Pick<
        ProyectoAdmin,
        "is_featured" | "visibility" | "category"
      >
    >
  ) {
    if (procesando) return;

    setProcesando(id);

    try {
      const { error } = await supabase
        .from("projects")
        .update(cambios)
        .eq("id", id)
        .select("id")
        .single();

      if (error) throw error;

      setProyectos((actuales) =>
        actuales.map((p) =>
          p.id === id ? { ...p, ...cambios } : p
        )
      );
    } catch (error) {
      console.error("Error actualizando proyecto:", error);
      alert(
        "No se pudo actualizar el proyecto. Comprueba los permisos RLS."
      );
    } finally {
      setProcesando(null);
    }
  }

  // ==========================================
  // DESTACAR / QUITAR DESTACADO
  // ==========================================

  async function alternarDestacado(proyecto: ProyectoAdmin) {
    const nuevoEstado = !proyecto.is_featured;

    await actualizarProyecto(proyecto.id, {
      is_featured: nuevoEstado,
    });
  }

  // ==========================================
  // ELIMINAR PROYECTO
  // ==========================================


async function eliminarProyecto(proyecto: ProyectoAdmin) {
  if (procesando) return;

  const confirmado = confirm(
    `🚨 ¿ELIMINAR DEFINITIVAMENTE "${proyecto.title}"?\n\n` +
    "Se eliminará el proyecto y sus archivos de Google Drive. Esta acción no se puede deshacer."
  );

  if (!confirmado) return;

  setProcesando(proyecto.id);

  try {
    const respuesta = await fetch("/api/delete-project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: proyecto.id,
      }),
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        resultado.error || "No se pudo eliminar el proyecto."
      );
    }

    setProyectos((actuales) =>
      actuales.filter((p) => p.id !== proyecto.id)
    );

    alert("🗑️ Proyecto eliminado correctamente.");

  } catch (error) {
    console.error("Error eliminando proyecto:", error);

    alert(
      error instanceof Error
        ? error.message
        : "Error inesperado eliminando el proyecto."
    );
  } finally {
    setProcesando(null);
  }
}

  // ==========================================
  // BUSCADOR
  // ==========================================

  const filtrados = proyectos.filter((p) => {
    const termino = busqueda.toLowerCase();

    return (
      p.title?.toLowerCase().includes(termino) ||
      (p.profiles?.username || "")
        .toLowerCase()
        .includes(termino)
    );
  });

  // Evitar problemas de hidratación.
  if (!montado) {
    return <main className="max-w-6xl mx-auto"></main>;
  }

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <main className="max-w-6xl mx-auto">

      {/* ENCABEZADO */}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">

        <div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
            Cámara de Proyectos
          </h1>

          <p className="text-gray-400 text-sm">
            Inspecciona y modera todos los proyectos subidos a la nube.
          </p>

          <p className="text-xs text-gray-500 mt-2">
            {proyectos.length} proyectos registrados
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <span className="absolute left-3 top-2.5 text-gray-500">
            🔍
          </span>

          <input
            type="text"
            placeholder="Buscar juego o creador..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-gray-900/60 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:border-blue-500 outline-none transition"
          />
        </div>

      </div>

      {/* CARGANDO */}

      {cargando ? (

        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>

      ) : filtrados.length === 0 ? (

        <div className="text-center py-20 bg-gray-900/30 border border-gray-800 rounded-2xl">
          <div className="text-4xl mb-3">🕹️</div>

          <h3 className="text-white font-bold">
            No se encontraron proyectos
          </h3>

          <p className="text-gray-500 text-sm mt-1">
            Intenta cambiar tu búsqueda.
          </p>
        </div>

      ) : (

        /* LISTADO */

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {filtrados.map((p) => {

            const ocupado = procesando === p.id;

            return (

              <div
                key={p.id}
                className={`bg-gray-900/50 border rounded-2xl p-4 flex gap-4 backdrop-blur-md items-center group transition ${
                  p.is_featured
                    ? "border-purple-500/50"
                    : "border-gray-800 hover:border-gray-600"
                }`}
              >

                {/* ICONO */}

                <div className="w-16 h-16 bg-gray-950 rounded-xl border border-gray-700 flex items-center justify-center shrink-0 overflow-hidden">

                  {p.icon_file_id ? (

                    <img
                      src={`https://lh3.googleusercontent.com/d/${p.icon_file_id}`}
                      alt={`Icono de ${p.title}`}
                      className="w-full h-full object-cover"
                    />

                  ) : (
                    "🕹️"
                  )}

                </div>

                {/* INFORMACIÓN */}

                <div className="flex-1 min-w-0">

                  <div className="flex items-center gap-2 flex-wrap">

                    <h3 className="font-bold text-white truncate">
                      {p.title}
                    </h3>

                    {p.is_featured && (
                      <span className="text-[9px] uppercase font-black tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md">
                        ★ Destacado
                      </span>
                    )}

                  </div>

                  <div className="text-xs text-gray-500 font-mono mt-1 flex items-center gap-2 flex-wrap">

                    <span>
                      @{p.profiles?.username || "desconocido"}
                    </span>

                    <span>•</span>

                    <span className={
                      p.visibility === "public"
                        ? "text-emerald-400"
                        : p.visibility === "unlisted"
                        ? "text-amber-400"
                        : "text-red-400"
                    }>
                      {p.visibility === "public"
                        ? "Público"
                        : p.visibility === "unlisted"
                        ? "No listado"
                        : "Privado"}
                    </span>

                    <span>•</span>

                    <span>
                      {p.file_size_mb ?? 0} MB
                    </span>

                  </div>

                  {/* CATEGORÍA */}

                  <div className="mt-2">
                    <select
                      value={p.category || "General"}
                      disabled={ocupado}
                      onChange={(e) =>
                        actualizarProyecto(p.id, {
                          category: e.target.value,
                        })
                      }
                      className="bg-gray-950 border border-gray-800 rounded-lg px-2 py-1 text-[10px] text-gray-300 outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                      {CATEGORIAS.map((categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>

                {/* ACCIONES */}

                <div className="flex flex-col gap-2 shrink-0">

                  <Link
                    href={`/proyecto/${p.id}`}
                    target="_blank"
                    className="text-[10px] uppercase font-bold text-center bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition"
                  >
                    Ver info
                  </Link>

                  {/* DESTACAR */}

                  <button
                    disabled={ocupado}
                    onClick={() => alternarDestacado(p)}
                    className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${
                      p.is_featured
                        ? "bg-purple-900/40 border-purple-700/50 text-purple-300 hover:bg-purple-700 hover:text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-purple-900/40 hover:text-purple-300 hover:border-purple-700"
                    }`}
                  >
                    {ocupado
                      ? "Guardando..."
                      : p.is_featured
                      ? "★ Quitar"
                      : "☆ Destacar"}
                  </button>

                  {/* VISIBILIDAD */}

                  <select
                    value={p.visibility}
                    disabled={ocupado}
                    onChange={(e) =>
                      actualizarProyecto(p.id, {
                        visibility: e.target.value,
                      })
                    }
                    className="bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-[10px] text-gray-300 outline-none focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value="public">Público</option>
                    <option value="unlisted">No listado</option>
                    <option value="private">Privado</option>
                  </select>

                  {/* ELIMINAR */}

                  <button
                    disabled={ocupado}
                    onClick={() => eliminarProyecto(p)}
                    className="text-[10px] uppercase font-bold bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white border border-red-800/50 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                  >
                    {ocupado ? "Procesando..." : "Borrar"}
                  </button>

                </div>

              </div>

            );
          })}

        </div>

      )}

    </main>
  );
}