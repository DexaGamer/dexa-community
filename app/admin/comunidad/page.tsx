"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface AnuncioGlobal {
  id: string;
  message: string;
  badge_text: string;
  link_url: string;
  style_type: "info" | "launch" | "warning";
  is_active: boolean;
}

interface GameJam {
  id: string;
  title: string;
  theme: string;
  description: string;
  banner_url?: string | null;
  accent_color: string;
  starts_at: string;
  ends_at: string;
  reward: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminComunidad() {
  const [cargando, setCargando] = useState(true);

  // Estados del Anuncio Global
  const [anuncio, setAnuncio] = useState<AnuncioGlobal | null>(null);
  const [guardandoAnuncio, setGuardandoAnuncio] = useState(false);
  const [mensajeAnuncioOk, setMensajeAnuncioOk] = useState(false);

  // Estados de Game Jams
  const [jams, setJams] = useState<GameJam[]>([]);
  const [creandoJam, setCreandoJam] = useState(false);
  const [guardandoJam, setGuardandoJam] = useState(false);

  // Formulario de nueva Jam
  const [jamTitulo, setJamTitulo] = useState("");
  const [jamTematica, setJamTematica] = useState("");
  const [jamBannerUrl, setJamBannerUrl] = useState("");
  const [jamDescripcion, setJamDescripcion] = useState("");
  const [jamColor, setJamColor] = useState("#8b5cf6");
  const [jamFechaInicio, setJamFechaInicio] = useState("");
  const [jamFechaFin, setJamFechaFin] = useState("");
  const [jamPremio, setJamPremio] = useState("Insignia de Campeón + Rango Desarrollador");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);

    // 1. Cargar Anuncio Global
    const { data: dataAnuncio } = await supabase
      .from("global_announcements")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (dataAnuncio) {
      setAnuncio(dataAnuncio);
    } else {
      // Estado por defecto si la tabla no tenía registros
      setAnuncio({
        id: "",
        message: "¡Bienvenidos al catálogo de Dexa Community!",
        badge_text: "AVISO",
        link_url: "",
        style_type: "info",
        is_active: false,
      });
    }

    // 2. Cargar Lista de Jams
    const { data: dataJams } = await supabase
      .from("game_jams")
      .select("*")
      .order("created_at", { ascending: false });

    if (dataJams) setJams(dataJams);

    setCargando(false);
  }

  // --- GUARDAR ANUNCIO GLOBAL ---
  const guardarAnuncioGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anuncio) return;
    setGuardandoAnuncio(true);

    const datosGuardar = {
      message: anuncio.message,
      badge_text: anuncio.badge_text,
      link_url: anuncio.link_url,
      style_type: anuncio.style_type,
      is_active: anuncio.is_active,
      updated_at: new Date().toISOString(),
    };

    let error;

    if (anuncio.id) {
      const res = await supabase
        .from("global_announcements")
        .update(datosGuardar)
        .eq("id", anuncio.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("global_announcements")
        .insert(datosGuardar)
        .select()
        .single();
      if (res.data) setAnuncio(res.data);
      error = res.error;
    }

    if (error) {
      alert("Error al actualizar anuncio: " + error.message);
    } else {
      setMensajeAnuncioOk(true);
      setTimeout(() => setMensajeAnuncioOk(false), 3000);
    }
    setGuardandoAnuncio(false);
  };

  // --- CREAR NUEVA GAME JAM ---
  const crearNuevaJam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jamTitulo.trim() || !jamTematica.trim() || !jamFechaInicio || !jamFechaFin) {
      alert("Por favor completa los campos principales de la Jam (Título, Temática y Fechas).");
      return;
    }

    setGuardandoJam(true);

    try {
      const nueva = {
        title: jamTitulo.trim(),
        theme: jamTematica.trim(),
        description: jamDescripcion.trim(),
        banner_url: jamBannerUrl.trim() || null,
        accent_color: jamColor,
        starts_at: new Date(jamFechaInicio).toISOString(),
        ends_at: new Date(jamFechaFin).toISOString(),
        reward: jamPremio.trim(),
        is_active: true,
      };

      const { data, error } = await supabase
        .from("game_jams")
        .insert(nueva)
        .select()
        .single();

      if (error) throw error;

      setJams((prev) => [data, ...prev]);
      setCreandoJam(false);
      setJamTitulo("");
      setJamTematica("");
      setJamBannerUrl("");
      setJamDescripcion("");
      alert("🎉 ¡Game Jam creada y publicada en la comunidad!");
    } catch (err: any) {
      alert("Error al crear Jam: " + err.message);
    } finally {
      setGuardandoJam(false);
    }
  };

  // --- ACTIVAR / PAUSAR JAM ---
  const alternarEstadoJam = async (jam: GameJam) => {
    const nuevoEstado = !jam.is_active;

    const { error } = await supabase
      .from("game_jams")
      .update({ is_active: nuevoEstado })
      .eq("id", jam.id);

    if (!error) {
      setJams((prev) =>
        prev.map((j) => (j.id === jam.id ? { ...j, is_active: nuevoEstado } : j))
      );
    } else {
      alert("Error: " + error.message);
    }
  };

  // --- ELIMINAR JAM ---
  const eliminarJam = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar la Jam "${titulo}"? Los proyectos que participaron no se borrarán.`)) return;

    const { error } = await supabase.from("game_jams").delete().eq("id", id);
    if (!error) {
      setJams((prev) => prev.filter((j) => j.id !== id));
    } else {
      alert("Error: " + error.message);
    }
  };

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-500">
        <div className="w-10 h-10 border-4 border-fuchsia-500/20 border-t-fuchsia-500 rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold uppercase tracking-wider">Cargando Centro de Comunidad...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 via-pink-400 to-amber-300">
          Comunidad & Eventos
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Lanza comunicados globales en la cabecera y coordina las Dexa Jams oficiales.
        </p>
      </div>

      {/* ========================================================= */}
      {/* SECCIÓN 1: MARQUESINA / ANUNCIO GLOBAL                    */}
      {/* ========================================================= */}
      <section className="bg-gray-900/40 border border-gray-800 p-6 md:p-8 rounded-3xl backdrop-blur-md shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📢</span>
            <div>
              <h2 className="text-lg font-black text-white">Anuncio Global Superior</h2>
              <p className="text-xs text-gray-400">Banner visible arriba de toda la web para todos los usuarios.</p>
            </div>
          </div>

          {anuncio && (
            <label className="flex items-center gap-3 cursor-pointer self-start sm:self-center">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                {anuncio.is_active ? "🟢 Activo en Web" : "⚪ Desactivado"}
              </span>
              <input
                type="checkbox"
                checked={anuncio.is_active}
                onChange={(e) => setAnuncio({ ...anuncio, is_active: e.target.checked })}
                className="w-5 h-5 rounded bg-gray-950 border-gray-700 text-fuchsia-600 focus:ring-0 cursor-pointer"
              />
            </label>
          )}
        </div>

        {anuncio && (
          <form onSubmit={guardarAnuncioGlobal} className="space-y-4">
            {/* Vista Previa en Vivo */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                Vista Previa en Vivo:
              </span>
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition ${
                  anuncio.style_type === "launch"
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                    : anuncio.style_type === "warning"
                    ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
                    : "bg-blue-950/40 border-blue-500/40 text-blue-200"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="font-mono text-[10px] uppercase font-black px-2 py-0.5 rounded bg-black/40 border border-current">
                    {anuncio.badge_text || "AVISO"}
                  </span>
                  <span className="truncate">{anuncio.message || "Escribe un mensaje..."}</span>
                </div>
                {anuncio.link_url && (
                  <span className="text-[11px] underline font-bold shrink-0">Ver más →</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Mensaje del Anuncio
                </label>
                <input
                  type="text"
                  value={anuncio.message}
                  onChange={(e) => setAnuncio({ ...anuncio, message: e.target.value })}
                  placeholder="Ej: ¡Dexa Pocket v1.2 disponible ahora! Con 57 bloques nuevos."
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Etiqueta (Badge)
                </label>
                <input
                  type="text"
                  value={anuncio.badge_text}
                  onChange={(e) => setAnuncio({ ...anuncio, badge_text: e.target.value })}
                  placeholder="Ej: UPDATE, EVENTO, ALERTA"
                  maxLength={12}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Enlace de Destino (Opcional)
                </label>
                <input
                  type="url"
                  value={anuncio.link_url}
                  onChange={(e) => setAnuncio({ ...anuncio, link_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Estilo Visual
                </label>
                <select
                  value={anuncio.style_type}
                  onChange={(e) => setAnuncio({ ...anuncio, style_type: e.target.value as any })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                >
                  <option value="info">🔵 Azul Informativo</option>
                  <option value="launch">🟢 Verde Lanzamiento / Novedad</option>
                  <option value="warning">🟠 Ámbar Alerta / Mantenimiento</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3">
              {mensajeAnuncioOk ? (
                <span className="text-xs text-emerald-400 font-bold">✅ ¡Anuncio actualizado!</span>
              ) : <span />}

              <button
                type="submit"
                disabled={guardandoAnuncio}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-lg shadow-fuchsia-600/20 active:scale-95"
              >
                {guardandoAnuncio ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ========================================================= */}
      {/* SECCIÓN 2: GESTOR DE DEXA JAMS                            */}
      {/* ========================================================= */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <h2 className="text-xl font-black text-white">Dexa Game Jams</h2>
              <p className="text-xs text-gray-400">Desafíos con tiempo límite para la comunidad de desarrolladores.</p>
            </div>
          </div>

          <button
            onClick={() => setCreandoJam(!creandoJam)}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-lg shadow-purple-600/20 self-start sm:self-auto"
          >
            {creandoJam ? "✕ Cancelar" : "+ Crear Nueva Jam"}
          </button>
        </div>

        {/* Modal / Formulario Desplegable para Crear Jam */}
        {creandoJam && (
          <form
            onSubmit={crearNuevaJam}
            className="bg-gray-950 border border-purple-500/40 p-6 md:p-8 rounded-3xl shadow-2xl space-y-5 animate-fadeIn"
          >
            <h3 className="text-lg font-black text-white">Configurar Nueva Game Jam</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Nombre del Evento *
                </label>
                <input
                  type="text"
                  value={jamTitulo}
                  onChange={(e) => setJamTitulo(e.target.value)}
                  placeholder="Ej: Dexa Jam #1"
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1.5">
                  Temática Oficial (Regla del juego) *
                </label>
                <input
                  type="text"
                  value={jamTematica}
                  onChange={(e) => setJamTematica(e.target.value)}
                  placeholder="Ej: Solo 1 Mecánica / Terror en un cuarto"
                  className="w-full bg-gray-900 border border-purple-500/40 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-400 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Descripción / Reglas Detalladas
              </label>
              <textarea
                value={jamDescripcion}
                onChange={(e) => setJamDescripcion(e.target.value)}
                rows={3}
                placeholder="Explica qué tipo de proyectos califican, si se permiten assets externos, etc..."
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Fecha y Hora de Inicio *
                </label>
                <input
                  type="datetime-local"
                  value={jamFechaInicio}
                  onChange={(e) => setJamFechaInicio(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Fecha y Hora de Cierre *
                </label>
                <input
                  type="datetime-local"
                  value={jamFechaFin}
                  onChange={(e) => setJamFechaFin(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Color de Acento
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={jamColor}
                    onChange={(e) => setJamColor(e.target.value)}
                    className="w-10 h-9 bg-transparent cursor-pointer rounded-lg border border-gray-800"
                  />
                  <input
                    type="text"
                    value={jamColor}
                    onChange={(e) => setJamColor(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                Recompensa / Premio Prometido
              </label>
              <input
                type="text"
                value={jamPremio}
                onChange={(e) => setJamPremio(e.target.value)}
                placeholder="Ej: Emblema en su perfil + Rango Desarrollador + Reseña en directo"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
              />
            </div>

            {/* Banner Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Póster / Banner de la Jam (ID de Google Drive o URL pública)
              </label>
              <input
                type="text"
                value={jamBannerUrl}
                onChange={(e) => setJamBannerUrl(e.target.value)}
                placeholder="Ej: 1A2B3C... (ID de Drive) o https://i.imgur.com/..."
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none font-mono"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setCreandoJam(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoJam}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-lg shadow-purple-600/30"
              >
                {guardandoJam ? "Creando..." : "Publicar Jam"}
              </button>
            </div>
          </form>
        )}

        {/* Lista de Jams Registradas */}
        {jams.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-800 rounded-3xl bg-gray-950/40">
            <span className="text-4xl block mb-2">🕹️</span>
            <p className="text-sm font-bold text-gray-300">No hay Game Jams creadas todavía</p>
            <p className="text-xs text-gray-500 mt-1">Crea la primera para motivar a la comunidad a crear con Dexa Pocket.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jams.map((jam) => {
              const ahora = new Date();
              const enCurso = new Date(jam.starts_at) <= ahora && ahora <= new Date(jam.ends_at);
              const finalizada = ahora > new Date(jam.ends_at);

              return (
                <div
                  key={jam.id}
                  className="bg-gray-900/40 border border-gray-800 p-6 rounded-3xl backdrop-blur-md flex flex-col justify-between hover:border-gray-700 transition"
                  style={{ borderLeftColor: jam.accent_color, borderLeftWidth: "4px" }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-lg font-black text-white">{jam.title}</h3>
                      <span
                        className={`text-[10px] font-mono px-2.5 py-0.5 rounded-md border font-bold uppercase ${
                          !jam.is_active
                            ? "bg-gray-900 border-gray-700 text-gray-500"
                            : enCurso
                            ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-400 animate-pulse"
                            : finalizada
                            ? "bg-red-950/40 border-red-800 text-red-400"
                            : "bg-blue-950/40 border-blue-800 text-blue-300"
                        }`}
                      >
                        {!jam.is_active
                          ? "Pausada"
                          : enCurso
                          ? "● En Curso"
                          : finalizada
                          ? "Finalizada"
                          : "Próximamente"}
                      </span>
                    </div>

                    <p className="text-xs text-purple-300 font-medium mb-3">
                      Temática: <span className="font-bold text-white font-mono">"{jam.theme}"</span>
                    </p>

                    {jam.description && (
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-4">
                        {jam.description}
                      </p>
                    )}

                    <div className="space-y-1.5 text-[11px] text-gray-400 font-mono bg-gray-950/60 p-3 rounded-xl border border-gray-800/80 mb-4">
                      <div className="flex justify-between">
                        <span>Inicio:</span>
                        <span className="text-gray-200">{new Date(jam.starts_at).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cierre:</span>
                        <span className="text-gray-200">{new Date(jam.ends_at).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-amber-300 pt-1 border-t border-gray-800">
                        <span>Premio:</span>
                        <span className="truncate max-w-[200px]">{jam.reward}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-800/60">
                    <button
                      onClick={() => alternarEstadoJam(jam)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${
                        jam.is_active
                          ? "bg-amber-950/30 border-amber-800/60 text-amber-300 hover:bg-amber-900/60"
                          : "bg-emerald-950/30 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60"
                      }`}
                    >
                      {jam.is_active ? "Pausar" : "Reactivar"}
                    </button>

                    <button
                      onClick={() => eliminarJam(jam.id, jam.title)}
                      className="text-xs text-red-400 hover:text-red-300 transition px-2 py-1"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}