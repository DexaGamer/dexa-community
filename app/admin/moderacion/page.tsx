"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface ProyectoModeracion {
  id: string;
  title: string;
  description: string;
  category: string;
  file_size_mb: number;
  visibility: "public" | "unlisted" | "private";
  created_at: string;
  owner_id: string;
  cover_file_id?: string | null;
  icon_file_id?: string | null;
  profiles?: {
    username?: string;
    display_name?: string;
  } | null;
}

export default function ModeracionPage() {
  const [proyectos, setProyectos] = useState<ProyectoModeracion[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "ocultos">("todos");
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Estados del modal de moderación táctica
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<ProyectoModeracion | null>(null);
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [motivoSancion, setMotivoSancion] = useState("");
  const [quitarCover, setQuitarCover] = useState(false);
  const [quitarIcono, setQuitarIcono] = useState(false);
  const [guardandoMod, setGuardandoMod] = useState(false);

  useEffect(() => {
    cargarProyectos();
  }, []);

  async function cargarProyectos() {
    setCargando(true);
    const { data: projs } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (projs && projs.length > 0) {
      const ownerIds = [...new Set(projs.map((p) => p.owner_id))];
      const { data: perfiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", ownerIds);

      const perfilMap = new Map((perfiles || []).map((p) => [p.id, p]));
      const combinados = projs.map((p) => ({
        ...p,
        profiles: perfilMap.get(p.owner_id) || null,
      }));

      setProyectos(combinados);
    } else {
      setProyectos([]);
    }
    setCargando(false);
  }

  const abrirModalModeracion = (p: ProyectoModeracion) => {
    setProyectoSeleccionado(p);
    setNuevoTitulo(p.title);
    setNuevaDescripcion(p.description || "");
    setMotivoSancion("");
    setQuitarCover(false);
    setQuitarIcono(false);
  };

  const aplicarSancionProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proyectoSeleccionado) return;

    if (!motivoSancion.trim()) {
      alert("Debes ingresar un motivo para advertir al creador.");
      return;
    }

    setGuardandoMod(true);
    try {
      const actualizaciones: any = {
        title: nuevoTitulo.trim(),
        description: nuevaDescripcion.trim(),
      };

      if (quitarCover) actualizaciones.cover_file_id = null;
      if (quitarIcono) actualizaciones.icon_file_id = null;

      // 1. Actualizar el proyecto en la base de datos
      const { error: errProj } = await supabase
        .from("projects")
        .update(actualizaciones)
        .eq("id", proyectoSeleccionado.id);

      if (errProj) throw errProj;

      // 2. Insertar notificación explicativa para el creador
      const cambiosRealizados = [];
      if (nuevoTitulo !== proyectoSeleccionado.title) cambiosRealizados.push("Nombre modificado");
      if (quitarCover) cambiosRealizados.push("Portada retirada por contenido indebido");
      if (quitarIcono) cambiosRealizados.push("Ícono retirado");

      const cuerpoMensaje = `Tu proyecto "${proyectoSeleccionado.title}" fue intervenido por moderación. Modificaciones: [${cambiosRealizados.join(", ")}]. Causa: ${motivoSancion.trim()}`;

      await supabase.from("notifications").insert({
        user_id: proyectoSeleccionado.owner_id,
        title: "⚠️ Intervención de Moderación en tu Proyecto",
        message: cuerpoMensaje,
        project_id: proyectoSeleccionado.id,
        type: "moderation_action",
      });

      alert("✅ Cambios aplicados y advertencia enviada al creador.");
      setProyectoSeleccionado(null);
      cargarProyectos();
    } catch (err: any) {
      alert("❌ Error aplicando moderación: " + err.message);
    } finally {
      setGuardandoMod(false);
    }
  };

  const cambiarVisibilidad = async (id: string, nuevaVis: "public" | "unlisted") => {
    setProcesandoId(id);
    const { error } = await supabase
      .from("projects")
      .update({ visibility: nuevaVis })
      .eq("id", id);

    if (!error) {
      setProyectos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, visibility: nuevaVis } : p))
      );
    }
    setProcesandoId(null);
  };

  const purgarProyecto = async (proyecto: ProyectoModeracion) => {
    const motivo = prompt(`¿Por qué vas a purgar "${proyecto.title}"? Escribe la causa para notificarle:`);
    if (!motivo) return;

    setProcesandoId(proyecto.id);
    try {
      // Notificar antes de borrar
      await supabase.from("notifications").insert({
        user_id: proyecto.owner_id,
        title: "🚨 Proyecto Eliminado por Infracción",
        message: `Tu proyecto "${proyecto.title}" fue retirado permanentemente de Dexa Community. Causa: ${motivo}`,
        type: "warning",
      });

      const res = await fetch("/api/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: proyecto.id }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setProyectos((prev) => prev.filter((p) => p.id !== proyecto.id));
        alert("✅ Proyecto purgado y creador notificado.");
      } else {
        throw new Error(data.error || "No se pudo eliminar.");
      }
    } catch (err: any) {
      alert("❌ Error: " + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const listaFiltrada = proyectos.filter((p) => {
    if (filtro === "ocultos") return p.visibility !== "public";
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            Escuadrón de Moderación
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Supervisa contenidos subidos, edita metadatos indebidos o purga elementos de la nube.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-950 p-1.5 rounded-xl border border-gray-800 self-start">
          <button
            onClick={() => setFiltro("todos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filtro === "todos" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Todos ({proyectos.length})
          </button>
          <button
            onClick={() => setFiltro("ocultos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filtro === "ocultos" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-gray-400 hover:text-white"
            }`}
          >
            Ocultos ({proyectos.filter((p) => p.visibility !== "public").length})
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="text-center py-20 text-gray-500">
          <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold uppercase tracking-wider">Escaneando catálogo...</p>
        </div>
      ) : listaFiltrada.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-3xl bg-gray-950/40">
          <span className="text-4xl block mb-2">🛡️</span>
          <p className="text-sm font-bold text-gray-300">No hay proyectos para revisar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listaFiltrada.map((item) => (
            <div
              key={item.id}
              className="bg-gray-900/40 border border-gray-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md hover:border-gray-700 transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gray-950 border border-gray-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.cover_file_id ? (
                    <img
                      src={`https://lh3.googleusercontent.com/d/${item.cover_file_id}`}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">🎮</span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">{item.title}</h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                        item.visibility === "public"
                          ? "bg-emerald-950/50 border-emerald-800 text-emerald-400"
                          : "bg-amber-950/50 border-amber-800 text-amber-400"
                      }`}
                    >
                      {item.visibility === "public" ? "Público" : "Oculto"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Subido por:{" "}
                    <span className="text-cyan-400 font-mono">
                      @{item.profiles?.username || "desconocido"}
                    </span>{" "}
                    • {item.file_size_mb} MB • {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                <Link
                  href={`/proyecto/${item.id}`}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 transition"
                  target="_blank"
                >
                  Ver
                </Link>

                {/* BOTÓN PARA ABRIR MODAL DE INTERVENCIÓN */}
                <button
                  onClick={() => abrirModalModeracion(item)}
                  className="px-3 py-1.5 rounded-lg bg-purple-950/50 border border-purple-800/80 text-purple-300 hover:bg-purple-900/60 text-xs font-semibold transition"
                >
                  ✏️ Moderar
                </button>

                {item.visibility === "public" ? (
                  <button
                    disabled={procesandoId === item.id}
                    onClick={() => cambiarVisibilidad(item.id, "unlisted")}
                    className="px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-300 hover:bg-amber-900/60 text-xs font-semibold transition"
                  >
                    Ocultar
                  </button>
                ) : (
                  <button
                    disabled={procesandoId === item.id}
                    onClick={() => cambiarVisibilidad(item.id, "public")}
                    className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 hover:bg-emerald-900/60 text-xs font-semibold transition"
                  >
                    Restaurar
                  </button>
                )}

                <button
                  disabled={procesandoId === item.id}
                  onClick={() => purgarProyecto(item)}
                  className="px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-800 text-red-400 hover:bg-red-900 text-xs font-semibold transition"
                >
                  Purgar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE EDICIÓN Y SANCIÓN */}
      {proyectoSeleccionado && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <h2 className="text-xl font-black text-white mb-1">Intervención Táctica</h2>
            <p className="text-xs text-gray-400 mb-6">
              Modificando proyecto de <span className="text-purple-400 font-mono">@{proyectoSeleccionado.profiles?.username}</span>
            </p>

            <form onSubmit={aplicarSancionProyecto} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Título del Proyecto
                </label>
                <input
                  type="text"
                  value={nuevoTitulo}
                  onChange={(e) => setNuevoTitulo(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Descripción
                </label>
                <textarea
                  value={nuevaDescripcion}
                  onChange={(e) => setNuevaDescripcion(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Checkboxes para purgar fotos indebidas */}
              <div className="bg-gray-900/60 border border-gray-800/80 p-4 rounded-xl space-y-2">
                <span className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Limpieza de Imágenes Inapropiadas
                </span>
                {proyectoSeleccionado.cover_file_id && (
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quitarCover}
                      onChange={(e) => setQuitarCover(e.target.checked)}
                      className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-0"
                    />
                    Remover Portada (Banner) actual
                  </label>
                )}
                {proyectoSeleccionado.icon_file_id && (
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quitarIcono}
                      onChange={(e) => setQuitarIcono(e.target.checked)}
                      className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-0"
                    />
                    Remover Ícono actual
                  </label>
                )}
              </div>

              {/* Razón de la sanción */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  Motivo de la Sanción / Advertencia *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Título con vocabulario inapropiado / Portada ofensiva"
                  value={motivoSancion}
                  onChange={(e) => setMotivoSancion(e.target.value)}
                  className="w-full bg-gray-900 border border-amber-500/40 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 placeholder:text-gray-600"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-1">Este mensaje se le enviará directamente a su bandeja de alertas.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setProyectoSeleccionado(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoMod}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-600/30"
                >
                  {guardandoMod ? "Aplicando..." : "Guardar y Notificar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}