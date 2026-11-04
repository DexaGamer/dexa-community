"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Rango {
  id: string;
  name: string;
  color: string;
  storage_limit_mb: number;
  project_limit: number;
}

interface PerfilUsuario {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  rank: string;
  rank_id: string | null;
  is_banned: boolean;
  banned_until?: string | null;
  ban_reason?: string | null;
  upload_blocked_until?: string | null;
  avatar_blocked_until?: string | null;
  strike_count?: number;
  storage_used_mb: number;
  storage_limit_mb: number;
  project_limit: number;
}

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);
  const [rangos, setRangos] = useState<Rango[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "sancionados">("todos");
  const [asignando, setAsignando] = useState<string | null>(null);

  // Estados del Modal de Sanciones Tácticas
  const [usuarioSancion, setUsuarioSancion] = useState<PerfilUsuario | null>(null);
  const [tipoSancion, setTipoSancion] = useState<"subida" | "avatar" | "ban_temp" | "ban_perm">("subida");
  const [diasSancion, setDiasSancion] = useState<number>(3);
  const [motivoSancion, setMotivoSancion] = useState("");
  const [procesandoSancion, setProcesandoSancion] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);

    const [usuariosRes, rangosRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("username", { ascending: true }),

      supabase
        .from("ranks")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

    if (usuariosRes.error) {
      alert("Error cargando usuarios: " + usuariosRes.error.message);
    } else {
      setUsuarios(usuariosRes.data || []);
    }

    if (rangosRes.error) {
      alert("Error cargando rangos: " + rangosRes.error.message);
    } else {
      setRangos(rangosRes.data || []);
    }

    setCargando(false);
  }

  // --- ASIGNACIÓN DE RANGOS ORIGINAL ---
  async function asignarRango(user: PerfilUsuario, rangoId: string) {
    if (!rangoId) return;

    const rango = rangos.find((r) => r.id === rangoId);
    if (!rango) return;

    if (
      !confirm(
        `¿Asignar ${rango.name} a @${user.username}?\n\n` +
          `Almacenamiento: ${rango.storage_limit_mb} MB\n` +
          `Proyectos: ${rango.project_limit}`
      )
    )
      return;

    setAsignando(user.id);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          rank_id: rango.id,
          storage_limit_mb: rango.storage_limit_mb,
          project_limit: rango.project_limit,
        })
        .eq("id", user.id)
        .select("id, rank_id, storage_limit_mb, project_limit")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "Supabase no modificó ninguna fila. Revisa las políticas RLS de profiles."
        );
      }

      setUsuarios((actuales) =>
        actuales.map((u) =>
          u.id === user.id
            ? {
                ...u,
                rank_id: data.rank_id,
                storage_limit_mb: data.storage_limit_mb,
                project_limit: data.project_limit,
              }
            : u
        )
      );

      alert(`¡Rango ${rango.name} asignado correctamente!`);
    } catch (error) {
      console.error("Error asignando rango:", error);
      alert(
        "No se pudo asignar el rango: " +
          (error instanceof Error ? error.message : "Error desconocido")
      );
    } finally {
      setAsignando(null);
    }
  }

  // --- CAMBIAR ROL ADMIN/USER ORIGINAL ---
  const cambiarRol = async (userId: string, nuevoRol: string) => {
    if (!confirm(`¿Cambiar el rol a ${nuevoRol.toUpperCase()}?`)) return;

    const { error } = await supabase
      .from("profiles")
      .update({ role: nuevoRol })
      .eq("id", userId);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    setUsuarios((actuales) =>
      actuales.map((u) =>
        u.id === userId ? { ...u, role: nuevoRol } : u
      )
    );
  };

  // --- QUITAR AVATAR DIRECTAMENTE ---
  const quitarAvatar = async (user: PerfilUsuario) => {
    if (!confirm(`¿Remover la foto de perfil de @${user.username}?`)) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "🚫 Foto de perfil removida",
        message: "Tu foto de perfil fue retirada por moderación debido a que no cumplía con las normas de la comunidad.",
        type: "warning",
      });

      setUsuarios((actuales) =>
        actuales.map((u) => (u.id === user.id ? { ...u, avatar_url: null } : u))
      );

      alert(`Foto de perfil de @${user.username} eliminada.`);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // --- APLICAR SANCIÓN / ADVERTENCIA FORMAL ---
  const aplicarSancion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioSancion) return;

    if (!motivoSancion.trim()) {
      alert("Debes especificar un motivo para la advertencia.");
      return;
    }

    setProcesandoSancion(true);
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + Number(diasSancion));

    const updates: any = {};
    let notifTitulo = "";
    let notifMensaje = "";

    if (tipoSancion === "subida") {
      updates.upload_blocked_until = fechaExpiracion.toISOString();
      notifTitulo = `⏳ Subida de juegos suspendida (${diasSancion} días)`;
      notifMensaje = `No podrás publicar ni actualizar proyectos hasta el ${fechaExpiracion.toLocaleDateString()}. Motivo: ${motivoSancion.trim()}`;
    } else if (tipoSancion === "avatar") {
      updates.avatar_url = null; // Quita la foto actual
      updates.avatar_blocked_until = fechaExpiracion.toISOString();
      notifTitulo = `🚫 Cambio de avatar bloqueado (${diasSancion} días)`;
      notifMensaje = `Tu avatar fue retirado y no podrás colocar uno nuevo hasta el ${fechaExpiracion.toLocaleDateString()}. Motivo: ${motivoSancion.trim()}`;
    } else if (tipoSancion === "ban_temp") {
      updates.is_banned = true;
      updates.banned_until = fechaExpiracion.toISOString();
      updates.ban_reason = motivoSancion.trim();
      notifTitulo = `🚨 Cuenta suspendida temporalmente (${diasSancion} días)`;
      notifMensaje = `Tu acceso a Dexa Community ha sido suspendido hasta el ${fechaExpiracion.toLocaleDateString()}. Causa: ${motivoSancion.trim()}`;
    } else if (tipoSancion === "ban_perm") {
      updates.is_banned = true;
      updates.banned_until = null;
      updates.ban_reason = motivoSancion.trim();
      notifTitulo = "🚨 Cuenta suspendida permanentemente";
      notifMensaje = `Tu cuenta ha sido vetada indefinidamente de la comunidad. Causa: ${motivoSancion.trim()}`;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", usuarioSancion.id);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: usuarioSancion.id,
        title: notifTitulo,
        message: notifMensaje,
        type: tipoSancion.includes("ban") ? "ban" : "warning",
      });

      setUsuarios((prev) =>
        prev.map((u) => (u.id === usuarioSancion.id ? { ...u, ...updates } : u))
      );

      alert("✅ Sanción aplicada y notificación enviada.");
      setUsuarioSancion(null);
      setMotivoSancion("");
    } catch (err: any) {
      alert("❌ Error aplicando sanción: " + err.message);
    } finally {
      setProcesandoSancion(false);
    }
  };

  // --- LEVANTAR TODAS LAS RESTRICCIONES / DESBANEAR ---
  const levantarRestricciones = async (user: PerfilUsuario) => {
    if (!confirm(`¿Levantar todas las sanciones y reactivar a @${user.username}?`)) return;

    try {
      const updates = {
        is_banned: false,
        banned_until: null,
        ban_reason: null,
        upload_blocked_until: null,
        avatar_blocked_until: null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "🕊️ Sanciones levantadas",
        message: "Tus restricciones han sido retiradas por la administración. Ya puedes usar todas las funciones con normalidad.",
        type: "info",
      });

      setUsuarios((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...updates } : u))
      );

      alert(`Restricciones retiradas para @${user.username}.`);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Helper para verificar si un usuario tiene alguna penalización activa
  const tieneSancionActiva = (u: PerfilUsuario) => {
    const ahora = new Date();
    const uploadLock = u.upload_blocked_until && new Date(u.upload_blocked_until) > ahora;
    const avatarLock = u.avatar_blocked_until && new Date(u.avatar_blocked_until) > ahora;
    const banLock = u.is_banned;
    return uploadLock || avatarLock || banLock;
  };

  const filtrados = usuarios
    .filter((u) => {
      if (filtroEstado === "sancionados") return tieneSancionActiva(u);
      return true;
    })
    .filter(
      (u) =>
        (u.username || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (u.display_name || "").toLowerCase().includes(busqueda.toLowerCase())
    );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white mb-1 tracking-tight">
            Gestión de Usuarios
          </h1>
          <p className="text-gray-400 text-sm">
            Administra usuarios, rangos, roles y aplica suspensiones o limitaciones temporales.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Pestañas de Filtrado */}
          <div className="flex items-center gap-1.5 bg-gray-950 p-1.5 rounded-xl border border-gray-800 w-full sm:w-auto">
            <button
              onClick={() => setFiltroEstado("todos")}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition w-full sm:w-auto ${
                filtroEstado === "todos"
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Todos ({usuarios.length})
            </button>
            <button
              onClick={() => setFiltroEstado("sancionados")}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition w-full sm:w-auto ${
                filtroEstado === "sancionados"
                  ? "bg-red-950/40 border border-red-500/40 text-red-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Sancionados ({usuarios.filter(tieneSancionActiva).length})
            </button>
          </div>

          <input
            type="text"
            placeholder="Buscar usuario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full sm:w-64 bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {cargando ? (
        <div className="text-center text-gray-500 py-20">
          <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs uppercase font-bold tracking-wider">Cargando usuarios...</p>
        </div>
      ) : (
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-x-auto backdrop-blur-md">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-950/80 border-b border-gray-800 text-[11px] uppercase tracking-wider text-gray-500">
                <th className="p-4">Usuario</th>
                <th className="p-4">Rango</th>
                <th className="p-4">Almacenamiento</th>
                <th className="p-4">Estado / Sanciones</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-800/60">
              {filtrados.map((user) => {
                const rangoActual = rangos.find((r) => r.id === user.rank_id);
                const ahora = new Date();
                const uploadBloqueado = user.upload_blocked_until && new Date(user.upload_blocked_until) > ahora;
                const avatarBloqueado = user.avatar_blocked_until && new Date(user.avatar_blocked_until) > ahora;
                const sancionado = tieneSancionActiva(user);

                return (
                  <tr key={user.id} className="hover:bg-gray-800/20 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gray-950 border border-gray-800 overflow-hidden flex items-center justify-center shrink-0 relative group">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-lg">👾</span>
                          )}
                          {user.avatar_url && (
                            <button
                              onClick={() => quitarAvatar(user)}
                              title="Remover foto de perfil indebida"
                              className="absolute inset-0 bg-red-950/80 text-red-300 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-bold"
                            >
                              🗑️
                            </button>
                          )}
                        </div>

                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            <span>{user.display_name || user.username}</span>
                            {user.role === "admin" && (
                              <span className="text-[9px] bg-cyan-950/60 border border-cyan-800 text-cyan-400 px-1.5 py-0.5 rounded font-mono font-bold">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            @{user.username}
                          </div>
                          {user.rank === "Creador" && (
                            <span className="text-[10px] text-purple-400 font-bold block mt-0.5">
                              CREADOR
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className="text-xs font-black"
                          style={{
                            color: rangoActual?.color || "#9ca3af",
                          }}
                        >
                          {rangoActual?.name || "Sin rango asignado"}
                        </span>

                        <select
                          value={user.rank_id || ""}
                          disabled={asignando === user.id}
                          onChange={(e) => asignarRango(user, e.target.value)}
                          className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-white max-w-44 focus:border-purple-500 outline-none"
                        >
                          <option value="" disabled>
                            Seleccionar rango
                          </option>
                          {rangos.map((rango) => (
                            <option key={rango.id} value={rango.id}>
                              {rango.name}
                            </option>
                          ))}
                        </select>

                        {asignando === user.id && (
                          <span className="text-[10px] text-purple-400 font-mono">
                            Asignando...
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="text-sm text-white font-bold font-mono">
                        {Number(user.storage_used_mb || 0).toFixed(2)} MB
                      </div>
                      <div className="text-xs text-gray-500">
                        de {user.storage_limit_mb} MB
                      </div>
                      <div className="text-xs text-gray-500">
                        {user.project_limit} proyectos permitidos
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="space-y-1">
                        {user.is_banned ? (
                          <div className="inline-block bg-red-950/50 border border-red-800/80 px-2.5 py-1 rounded-lg">
                            <span className="text-[10px] font-black text-red-400 block">
                              🚨 {user.banned_until ? `BANEADO HASTA ${new Date(user.banned_until).toLocaleDateString()}` : "BANEADO PERMANENTE"}
                            </span>
                            {user.ban_reason && (
                              <span className="text-[10px] text-red-300/80 block line-clamp-1">
                                Causa: {user.ban_reason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/30 border border-emerald-800/50 px-2 py-0.5 rounded-md">
                            ● ACTIVO
                          </span>
                        )}

                        {uploadBloqueado && (
                          <span className="block text-[10px] font-mono text-amber-400 bg-amber-950/30 border border-amber-800/40 px-2 py-0.5 rounded-md">
                            ⏳ Subidas bloqueadas
                          </span>
                        )}

                        {avatarBloqueado && (
                          <span className="block text-[10px] font-mono text-fuchsia-400 bg-fuchsia-950/30 border border-fuchsia-800/40 px-2 py-0.5 rounded-md">
                            🚫 Avatar restringido
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setUsuarioSancion(user);
                              setMotivoSancion("");
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-800/50 bg-amber-950/30 text-amber-300 hover:bg-amber-900/60 transition font-semibold"
                          >
                            ⚠️ Sancionar
                          </button>

                          {sancionado && (
                            <button
                              onClick={() => levantarRestricciones(user)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-800/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/60 transition font-semibold"
                              title="Quitar baneos y bloqueos"
                            >
                              Perdonar
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() =>
                            cambiarRol(
                              user.id,
                              user.role === "admin" ? "user" : "admin"
                            )
                          }
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                        >
                          {user.role === "admin" ? "Quitar Admin" : "Hacer Admin"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtrados.length === 0 && (
            <p className="text-center text-gray-500 py-12 text-sm font-medium">
              No se encontraron usuarios con esos filtros.
            </p>
          )}
        </div>
      )}

      {/* --- MODAL DE ADVERTENCIA / SANCIÓN TÁCTICA --- */}
      {usuarioSancion && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <h2 className="text-xl font-black text-white mb-1">
              Sancionar a @{usuarioSancion.username}
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              Selecciona el tipo de infracción y la duración del castigo.
            </p>

            <form onSubmit={aplicarSancion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Acción Disciplinaria
                </label>
                <select
                  value={tipoSancion}
                  onChange={(e) => setTipoSancion(e.target.value as any)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="subida">⏳ Bloquear subida de proyectos</option>
                  <option value="avatar">🚫 Remover foto y bloquear cambios de avatar</option>
                  <option value="ban_temp">🚨 Baneo Temporal de Cuenta</option>
                  <option value="ban_perm">⛔ Baneo Permanente</option>
                </select>
              </div>

              {tipoSancion !== "ban_perm" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Duración (Días)
                  </label>
                  <select
                    value={diasSancion}
                    onChange={(e) => setDiasSancion(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={1}>1 Día</option>
                    <option value={3}>3 Días</option>
                    <option value={7}>7 Días (1 semana)</option>
                    <option value={14}>14 Días (2 semanas)</option>
                    <option value={30}>30 Días (1 mes)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  Motivo de la Advertencia *
                </label>
                <textarea
                  placeholder="Ej: Subida repetida de archivos corruptos o spam."
                  value={motivoSancion}
                  onChange={(e) => setMotivoSancion(e.target.value)}
                  rows={3}
                  required
                  className="w-full bg-gray-900 border border-amber-500/40 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-400 placeholder:text-gray-600"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Se enviará automáticamente una notificación a la bandeja de este usuario con la causa y la fecha de expiración.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setUsuarioSancion(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoSancion}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-lg shadow-amber-600/30"
                >
                  {procesandoSancion ? "Aplicando..." : "Aplicar Sanción"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}