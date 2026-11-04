"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface ProyectoPropio {
  id: string;
  title: string;
  drive_file_id: string;
  cover_file_id?: string;
  icon_file_id?: string;
  file_size_mb: number;
  visibility: "public" | "unlisted" | "private";
  created_at: string;
}

interface NotificacionSancion {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  is_read: boolean;
}

interface PerfilCompleto {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  is_banned: boolean;
  banned_until: string | null;
  ban_reason: string | null;
  upload_blocked_until: string | null;
  avatar_blocked_until: string | null;
}

export default function PanelCuenta() {
  const [montado, setMontado] = useState(false);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarActual, setAvatarActual] = useState<string | null>(null);

  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [nuevaPassword, setNuevaPassword] = useState("");
  const [misProyectos, setMisProyectos] = useState<ProyectoPropio[]>([]);
  const [notificaciones, setNotificaciones] = useState<NotificacionSancion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado) return;

    async function cargarDatos() {
      setCargando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUsuarioId(null);
        setCargando(false);
        return;
      }

      setUsuarioId(user.id);

      // 1. CARGAMOS TODO EL PERFIL (Incluyendo candados y sanciones)
      const { data: dataPerfil } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (dataPerfil) {
        setPerfil(dataPerfil);
        setDisplayName(dataPerfil.display_name || "");
        setUsername(dataPerfil.username || "");
        setAvatarActual(dataPerfil.avatar_url || null);
      }

      // 2. CARGAMOS ALERTAS / NOTIFICACIONES DE MODERACIÓN
      const { data: dataNotifs } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (dataNotifs) {
        setNotificaciones(dataNotifs);
      }

      // 3. CARGAMOS PROYECTOS DEL USUARIO
      const { data: proyectos } = await supabase
        .from("projects")
        .select("id, title, drive_file_id, cover_file_id, icon_file_id, file_size_mb, visibility, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (proyectos) {
        setMisProyectos(proyectos as ProyectoPropio[]);
      }

      setCargando(false);
    }

    cargarDatos();
  }, [montado]);

  // Recorte WebP con Canvas
  const procesarCanvasAvatar = (rawFile: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const size = 256;
        canvas.width = size;
        canvas.height = size;

        const scale = Math.max(size / img.width, size / img.height);
        const offsetX = (size - img.width * scale) / 2;
        const offsetY = (size - img.height * scale) / 2;

        ctx?.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);

        canvas.toBlob((blob) => {
          if (blob) {
            setAvatarBlob(blob);
            setAvatarPreview(URL.createObjectURL(blob));
          }
        }, "image/webp", 0.85);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(rawFile);
  };

  const extraerIdDrive = (url: string | null) => {
    if (!url) return null;
    const match = url.match(/\/d\/([^/]+)/);
    return match ? match[1] : null;
  };

  const guardarIdentidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioId) return;
    setGuardandoPerfil(true);
    setMensaje(null);

    // Validación de sanción en el cliente antes de enviar
    const avatarBloqueado = perfil?.avatar_blocked_until && new Date(perfil.avatar_blocked_until) > new Date();
    if (avatarBlob && avatarBloqueado) {
      setMensaje("❌ Tu cuenta tiene restringida la modificación de avatar actualmente.");
      setGuardandoPerfil(false);
      return;
    }

    try {
      let nuevaAvatarUrl = avatarActual;

      if (avatarBlob) {
        setSubiendoAvatar(true);
        const formData = new FormData();
        formData.append("avatar", avatarBlob, `avatar_${username || "user"}.webp`);
        formData.append("userId", usuarioId);

        const oldAvatarId = extraerIdDrive(avatarActual);
        if (oldAvatarId) formData.append("oldAvatarId", oldAvatarId);

        const res = await fetch("/api/upload-avatar", { method: "POST", body: formData });
        const dataUpload = await res.json();

        if (dataUpload.success && dataUpload.avatar_url) {
          nuevaAvatarUrl = dataUpload.avatar_url;
          setAvatarActual(nuevaAvatarUrl);
          setAvatarBlob(null);
          setAvatarPreview(null);
        } else {
          throw new Error(dataUpload.error || "No se pudo subir el avatar a Drive");
        }
        setSubiendoAvatar(false);
      }

      const usernameLimpio = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      // 👇 AGREGA ESTO AQUÍ 👇
      if (usernameLimpio.length < 3 || usernameLimpio.length > 20) {
        setMensaje("❌ El nombre de usuario debe tener entre 3 y 20 caracteres.");
        setGuardandoPerfil(false);
        return;
      }
      // 👆 FIN DEL BLOQUE 👆

      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: usuarioId,
            display_name: displayName.trim(),
            username: usernameLimpio,
            avatar_url: nuevaAvatarUrl,
          },
          { onConflict: "id" }
        );

      if (error) {
        if (error.code === "23505") {
          setMensaje("❌ Ese nombre de usuario (@" + usernameLimpio + ") ya está ocupado.");
        } else {
          setMensaje("❌ Error al guardar datos: " + error.message);
        }
      } else {
        setUsername(usernameLimpio);
        setMensaje("✅ ¡Perfil actualizado correctamente!");
      }
    } catch (err: any) {
      setMensaje("❌ Error: " + err.message);
    } finally {
      setGuardandoPerfil(false);
      setSubiendoAvatar(false);
    }
  };

  const cambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nuevaPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
    if (error) {
      alert("Error al cambiar contraseña: " + error.message);
    } else {
      setNuevaPassword("");
      alert("✅ Contraseña cambiada con éxito.");
    }
  };

  const alternarVisibilidad = async (proyectoId: string, nuevaVisibilidad: "public" | "unlisted") => {
    const { error } = await supabase
      .from("projects")
      .update({ visibility: nuevaVisibilidad })
      .eq("id", proyectoId);

    if (!error) {
      setMisProyectos((prev) =>
        prev.map((p) => (p.id === proyectoId ? { ...p, visibility: nuevaVisibilidad } : p))
      );
    }
  };

  const eliminarProyecto = async (proyecto: ProyectoPropio) => {
    const confirmacion = confirm(
      `¿Seguro que deseas eliminar "${proyecto.title}"? Esta acción borrará sus archivos de Drive permanentemente.`
    );
    if (!confirmacion) return;

    try {
      const res = await fetch("/api/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: proyecto.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar el proyecto.");
      }

      setMisProyectos((prev) => prev.filter((p) => p.id !== proyecto.id));
      alert("🗑️ Proyecto eliminado correctamente.");
    } catch (err: any) {
      alert(`❌ ${err.message || "Error desconocido"}`);
    }
  };

  const copiarEnlace = (id: string) => {
    const url = `${window.location.origin}/proyecto/${id}`;
    navigator.clipboard.writeText(url);
    alert("🔗 Enlace copiado al portapapeles: " + url);
  };

  const baseClasses = "min-h-screen bg-[#070709] text-white p-6 md:p-12 relative overflow-hidden";

  if (!montado) return <main className={baseClasses}></main>;

  if (!usuarioId) {
    return (
      <main className={`${baseClasses} flex items-center justify-center`}>
        <div className="max-w-md w-full text-center bg-gray-900/60 border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <div className="text-6xl mb-5">👾</div>
          <h1 className="text-3xl font-black text-white mb-3">¡Hola, visitante!</h1>
          <p className="text-gray-400 text-sm mb-8">
            Necesitas iniciar sesión para administrar tus proyectos y perfil.
          </p>
          <Link
            href="/login"
            className="w-full block bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 rounded-xl transition"
          >
            Iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  // Comprobaciones de Sanciones Activas
  const ahora = new Date();
  const subidaBloqueada = perfil?.upload_blocked_until && new Date(perfil.upload_blocked_until) > ahora;
  const avatarBloqueado = perfil?.avatar_blocked_until && new Date(perfil.avatar_blocked_until) > ahora;

  return (
    <main className={baseClasses}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
              Ajustes de Cuenta
            </h1>
            <p className="text-gray-400 text-sm mt-1">Administra tu perfil, privacidad y biblioteca personal.</p>
          </div>
          <Link
            href="/"
            className="text-xs bg-gray-900 border border-gray-800 hover:border-gray-700 px-4 py-2 rounded-xl text-gray-300 hover:text-white transition backdrop-blur-md"
          >
            ← Volver al Catálogo
          </Link>
        </div>

        {/* --- BANNERS DE RESTRICCIONES ACTIVAS --- */}
        {avatarBloqueado && (
          <div className="bg-red-950/40 border border-red-500/60 p-5 rounded-2xl flex items-start gap-4 backdrop-blur-md shadow-[0_0_25px_rgba(239,68,68,0.15)] animate-pulse">
            <span className="text-3xl">🚫</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-red-400 uppercase tracking-wider">
                  Cambio de Avatar Bloqueado
                </h3>
                <span className="text-[10px] font-mono text-red-300 bg-red-900/60 border border-red-700/60 px-2 py-0.5 rounded-md">
                  Infracción Activa
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                Tu foto de perfil fue retirada o suspendida por el equipo de moderación. No puedes subir imágenes de perfil durante este período.
              </p>
              <div className="mt-3 flex items-center gap-2 font-mono text-xs text-red-300">
                <span>⏳ Se restablece:</span>
                <span className="font-bold underline">
                  {new Date(perfil!.avatar_blocked_until!).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {subidaBloqueada && (
          <div className="bg-amber-950/40 border border-amber-500/60 p-5 rounded-2xl flex items-start gap-4 backdrop-blur-md shadow-[0_0_25px_rgba(245,158,11,0.15)]">
            <span className="text-3xl">⏳</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">
                  Publicación de Juegos Suspendida
                </h3>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-900/60 border border-amber-700/60 px-2 py-0.5 rounded-md">
                  Sanción Temporal
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                No tienes autorización para subir nuevos proyectos ni actualizar archivos debido a una sanción disciplinaria.
              </p>
              <div className="mt-3 flex items-center gap-2 font-mono text-xs text-amber-300">
                <span>🕒 Acceso disponible a partir de:</span>
                <span className="font-bold underline">
                  {new Date(perfil!.upload_blocked_until!).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* --- CENTRO DE NOTIFICACIONES Y ADVERTENCIAS --- */}
        {notificaciones.length > 0 && (
          <section className="bg-gray-900/30 border border-gray-800 p-6 rounded-3xl backdrop-blur-md">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <span>🔔</span> Avisos y Notificaciones del Sistema
            </h2>
            <div className="space-y-3">
              {notificaciones.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                    n.type === "ban"
                      ? "bg-red-950/30 border-red-800/60 text-red-300"
                      : n.type === "warning"
                      ? "bg-amber-950/30 border-amber-800/60 text-amber-200"
                      : "bg-blue-950/30 border-blue-800/60 text-blue-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">{n.title}</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-300">{n.message}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {mensaje && (
          <div className="bg-blue-950/40 border border-blue-800 text-blue-300 text-xs p-3.5 rounded-xl backdrop-blur-md">
            {mensaje}
          </div>
        )}

        {/* Sección: Identidad y Avatar */}
        <section className="bg-gray-900/40 border border-gray-800 p-6 md:p-8 rounded-3xl backdrop-blur-md shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-6">Tu Perfil Público</h2>

          <form onSubmit={guardarIdentidad} className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex flex-col items-center gap-3 shrink-0">
              <div
                className={`relative w-28 h-28 rounded-3xl border-2 overflow-hidden bg-gray-950 shadow-xl transition-colors ${
                  avatarBloqueado
                    ? "border-red-600/60 cursor-not-allowed opacity-75"
                    : "border-gray-700 hover:border-blue-500 group cursor-pointer"
                }`}
              >
                {avatarPreview || avatarActual ? (
                  <img
                    src={avatarPreview || avatarActual!}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">👾</div>
                )}

                {/* Si está bloqueado, mostramos candado rojo permanente */}
                {avatarBloqueado ? (
                  <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center text-center p-2">
                    <span className="text-2xl mb-1">🔒</span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-300">
                      Bloqueado
                    </span>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {subiendoAvatar ? "Subiendo..." : "Subir Foto"}
                    </span>
                  </div>
                )}

                {!avatarBloqueado && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) procesarCanvasAvatar(f);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Cambiar foto de perfil"
                  />
                )}
              </div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                Avatar 1:1
              </span>
            </div>

            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Nombre de Visualización
                </label>
                <input
                  type="text"
                  placeholder="Ej: Dexa"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Nombre de Usuario (@)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-500 text-sm font-mono">@</span>
                  <input
                    type="text"
                    placeholder="dexa"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-8 pr-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={guardandoPerfil}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-bold text-xs px-6 py-3 rounded-xl transition shadow-lg shadow-blue-600/20 active:scale-95"
                >
                  {guardandoPerfil ? "⏳ Guardando..." : "Guardar Perfil"}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Sección: Proyectos y Visibilidad */}
        <section className="bg-gray-900/40 border border-gray-800 p-6 md:p-8 rounded-3xl backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Tus Proyectos y Visibilidad</h2>
              <p className="text-xs text-gray-400">
                Los proyectos ocultos no salen en la tienda, pero funcionan con enlace directo.
              </p>
            </div>

            {/* Si tiene subida bloqueada, deshabilitamos el botón + Nuevo */}
            {subidaBloqueada ? (
              <button
                disabled
                className="text-xs bg-gray-800 text-gray-500 font-bold px-4 py-2 rounded-xl cursor-not-allowed flex items-center gap-1.5"
                title="Subida restringida por moderación"
              >
                <span>🚫</span> + Nuevo (Bloqueado)
              </button>
            ) : (
              <Link
                href="/subir"
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl transition active:scale-95 shadow-lg shadow-indigo-600/20"
              >
                + Nuevo
              </Link>
            )}
          </div>

          {misProyectos.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-gray-800 rounded-2xl bg-gray-950/40">
              <span className="text-3xl block mb-2">📁</span>
              <p className="text-xs text-gray-500">No tienes juegos subidos todavía.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/80">
              {misProyectos.map((proyecto) => (
                <div
                  key={proyecto.id}
                  className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2 group-hover:text-blue-400 transition">
                      <Link href={`/proyecto/${proyecto.id}`}>{proyecto.title}</Link>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                          proyecto.visibility === "public"
                            ? "bg-emerald-950/60 border border-emerald-800 text-emerald-400"
                            : "bg-amber-950/60 border border-amber-800 text-amber-400"
                        }`}
                      >
                        {proyecto.visibility === "public" ? "🌐 Público" : "🔗 Oculto"}
                      </span>
                    </h3>
                    <span className="text-[11px] text-gray-500 font-mono mt-1 block">
                      {proyecto.file_size_mb} MB en Google Drive
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/subir?id=${proyecto.id}`}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition"
                      title="Editar proyecto"
                    >
                      ✏️ Editar
                    </Link>

                    <button
                      onClick={() => copiarEnlace(proyecto.id)}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition"
                      title="Copiar enlace directo"
                    >
                      🔗
                    </button>

                    {proyecto.visibility === "public" ? (
                      <button
                        onClick={() => alternarVisibilidad(proyecto.id, "unlisted")}
                        className="bg-gray-800 hover:bg-amber-900/40 text-amber-300 text-xs px-3 py-1.5 rounded-lg border border-gray-700 transition"
                      >
                        Ocultar
                      </button>
                    ) : (
                      <button
                        onClick={() => alternarVisibilidad(proyecto.id, "public")}
                        className="bg-gray-800 hover:bg-emerald-900/40 text-emerald-300 text-xs px-3 py-1.5 rounded-lg border border-gray-700 transition"
                      >
                        Hacer Público
                      </button>
                    )}

                    <button
                      onClick={() => eliminarProyecto(proyecto)}
                      className="bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-red-800/40 transition ml-2"
                      title="Eliminar de Supabase y Drive"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sección: Seguridad */}
        <section className="bg-gray-900/40 border border-gray-800 p-6 md:p-8 rounded-3xl backdrop-blur-md">
          <h2 className="text-lg font-bold text-white mb-1">Seguridad</h2>
          <p className="text-xs text-gray-400 mb-6">Actualiza tu contraseña de acceso.</p>

          <form onSubmit={cambiarPassword} className="flex flex-col sm:flex-row gap-3 max-w-md">
            <input
              type="password"
              placeholder="Nueva contraseña (mínimo 6 caracteres)"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition"
            >
              Actualizar
            </button>
          </form>
        </section>

        {/* Sesión */}
        <section className="border border-red-950/50 bg-red-950/10 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
          <div>
            <h3 className="text-sm font-bold text-red-400">Sesión Activa</h3>
            <p className="text-xs text-gray-500">Cierra tu sesión en este dispositivo.</p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="bg-red-900/30 hover:bg-red-900 text-red-300 hover:text-white text-xs font-bold px-5 py-2.5 rounded-xl transition border border-red-800/40"
          >
            Cerrar Sesión
          </button>
        </section>
      </div>
    </main>
  );
}