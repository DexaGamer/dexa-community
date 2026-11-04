"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

interface ProyectoExistente {
  id: string;
  title: string;
  description: string;
  category?: string;
  accent_color?: string;
  drive_file_id: string;
  cover_file_id?: string;
  icon_file_id?: string;
  file_size_mb?: number;
  social_discord?: string;
  social_youtube?: string;
  social_web?: string;
}

function FormularioSubir() {
  const searchParams = useSearchParams();
  const idUrl = searchParams.get("id");
  const jamUrl = searchParams.get("jam");
  const [jamIdSeleccionada, setJamIdSeleccionada] = useState<string | null>(null);
  const router = useRouter();

  const [modo, setModo] = useState<"nuevo" | "actualizar">("nuevo");
  const [misProyectos, setMisProyectos] = useState<ProyectoExistente[]>([]);
  const [proyectoIdSeleccionado, setProyectoIdSeleccionado] = useState<string>("");
  const [porcentajeSubida, setPorcentajeSubida] = useState<number>(0);

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("General");
  const [accentColor, setAccentColor] = useState("#3b82f6");

  const [discordLink, setDiscordLink] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [webLink, setWebLink] = useState("");

  const [archivo, setArchivo] = useState<File | null>(null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [iconBlob, setIconBlob] = useState<Blob | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  const [estado, setEstado] = useState("esperando");
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [bloqueoFecha, setBloqueoFecha] = useState<string | null>(null);

  // 1. Estado de almacenamiento
  const [almacenamiento, setAlmacenamiento] = useState({
    usado: 0,
    limite: 0,
    proyectos: 0,
    limiteProyectos: 0,
    ilimitado: false,
    cargado: false,
  });

  // 2. Inicializar
  useEffect(() => {
    async function inicializar() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAlmacenamiento(prev => ({ ...prev, cargado: true }));
        return;
      }

      setUsuarioId(user.id);

      const [{ data: perfil, error: perfilError }, { data: proyectos, error: proyectosError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("storage_used_mb, storage_limit_mb, project_limit, is_unlimited, upload_blocked_until, is_banned")
            .eq("id", user.id)
            .single(),

          supabase
            .from("projects")
            .select("*")
            .eq("owner_id", user.id),
        ]);

      if (perfilError || proyectosError) {
        console.error("Error cargando almacenamiento:", perfilError || proyectosError);
        setAlmacenamiento(prev => ({ ...prev, cargado: true }));
        return;
      }

      // 👇 REVISAR SI EL CREADOR ESTÁ SANCIONADO 👇
      const ahora = new Date();
      if (perfil.is_banned) {
        setBloqueoFecha("permanente");
      } else if (perfil.upload_blocked_until && new Date(perfil.upload_blocked_until) > ahora) {
        setBloqueoFecha(perfil.upload_blocked_until);
      }
      // 👆 FIN DE LA COMPROBACIÓN 👆

      const lista = proyectos || [];
      setMisProyectos(lista);

      setAlmacenamiento({
        usado: Number(perfil.storage_used_mb || 0),
        limite: Number(perfil.storage_limit_mb || 0),
        proyectos: lista.length,
        limiteProyectos: Number(perfil.project_limit || 0),
        ilimitado: Boolean(perfil.is_unlimited),
        cargado: true,
      });

      const proyectoObjetivo = idUrl
        ? lista.find(p => p.id === idUrl)
        : null;

      if (proyectoObjetivo) {
        setModo("actualizar");
        cargarDatosEnFormulario(proyectoObjetivo.id, lista);
      } else if (lista.length > 0) {
        setProyectoIdSeleccionado(lista[0].id);
      }

      // Registro de Game Jam
      if (jamUrl) {
        setJamIdSeleccionada(jamUrl);
      }
    }

    inicializar();
  }, [idUrl, jamUrl]);

  const cargarDatosEnFormulario = (id: string, lista = misProyectos) => {
    setProyectoIdSeleccionado(id);
    const encontrado = lista.find((p) => p.id === id);
    if (!encontrado) return;

    setTitulo(encontrado.title || "");
    setDescripcion(encontrado.description || "");
    setCategoria(encontrado.category || "General");
    setAccentColor(encontrado.accent_color || "#3b82f6");
    setDiscordLink(encontrado.social_discord || "");
    setYoutubeLink(encontrado.social_youtube || "");
    setWebLink(encontrado.social_web || "");

    setCoverBlob(null);
    setCoverPreview(encontrado.cover_file_id ? `https://lh3.googleusercontent.com/d/${encontrado.cover_file_id}` : null);
    setIconBlob(null);
    setIconPreview(encontrado.icon_file_id ? `https://lh3.googleusercontent.com/d/${encontrado.icon_file_id}` : null);
    setArchivo(null);
  };

  const cambiarModo = (nuevoModo: "nuevo" | "actualizar") => {
    setModo(nuevoModo);
    if (nuevoModo === "actualizar" && misProyectos.length > 0) {
      cargarDatosEnFormulario(misProyectos[0].id);
    } else {
      setTitulo("");
      setDescripcion("");
      setCategoria("General");
      setAccentColor("#3b82f6");
      setDiscordLink("");
      setYoutubeLink("");
      setWebLink("");
      setArchivo(null);
      setCoverBlob(null);
      setCoverPreview(null);
      setIconBlob(null);
      setIconPreview(null);
    }
  };

  const procesarCanvas = (rawFile: File, anchoTarget: number, altoTarget: number, onComprimido: (blob: Blob, url: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = anchoTarget;
        canvas.height = altoTarget;
        const scale = Math.max(anchoTarget / img.width, altoTarget / img.height);
        const offsetX = (anchoTarget - img.width * scale) / 2;
        const offsetY = (altoTarget - img.height * scale) / 2;
        ctx?.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
        canvas.toBlob((blob) => {
          if (blob) onComprimido(blob, URL.createObjectURL(blob));
        }, "image/webp", 0.8);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(rawFile);
  };

  // 3. Cálculos de almacenamiento
  const restante = Math.max(
    0,
    almacenamiento.limite - almacenamiento.usado
  );

  const porcentaje = almacenamiento.limite > 0
    ? Math.min(100, (almacenamiento.usado / almacenamiento.limite) * 100)
    : 100;

  const porcentajeProyectos = almacenamiento.limiteProyectos > 0
    ? Math.min(
        100,
        (almacenamiento.proyectos / almacenamiento.limiteProyectos) * 100
      )
    : 100;

  const sinEspacio =
    !almacenamiento.ilimitado &&
    almacenamiento.usado >= almacenamiento.limite;

  const sinProyectosDisponibles =
    almacenamiento.proyectos >= almacenamiento.limiteProyectos;

  const bloquearNuevo =
    modo === "nuevo" &&
    (sinEspacio || sinProyectosDisponibles);

  const formatearMB = (mb: number) =>
    mb < 1
      ? `${(mb * 1024).toFixed(1)} KB`
      : `${mb.toFixed(2)} MB`;

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!usuarioId) {
      alert("Debes iniciar sesión.");
      return;
    }

    if (modo === "nuevo" && !archivo) {
      alert("Por favor selecciona un archivo .catrobat");
      return;
    }

    const actual = misProyectos.find((p) => p.id === proyectoIdSeleccionado);
    if (modo === "actualizar" && !actual) {
      alert("No se encontró el proyecto seleccionado.");
      return;
    }

    setEstado("subiendo");
    setPorcentajeSubida(0);

    try {
      let directGameId: string | null = null;

      // 1. SI HAY ARCHIVO DEL JUEGO: SUBIR DIRECTO A GOOGLE DRIVE
      if (archivo) {
        // Pedir sesión a Google
        const sesionRes = await fetch("/api/upload/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: archivo.name,
            fileSize: archivo.size,
            mimeType: archivo.type || "application/octet-stream",
          }),
        });

        const sesionData = await sesionRes.json();
        if (!sesionRes.ok || !sesionData.uploadUrl) {
          throw new Error(sesionData.error || "No se pudo iniciar la conexión con Google Drive.");
        }

        // Subir directamente a Google con seguimiento de porcentaje
        directGameId = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", sesionData.uploadUrl, true);

          xhr.setRequestHeader("Content-Type", archivo.type || "application/octet-stream");

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const porcentaje = Math.round((event.loaded / event.total) * 100);
              setPorcentajeSubida(porcentaje);
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) {
              const resJson = JSON.parse(xhr.responseText);
              resolve(resJson.id);
            } else {
              reject(new Error("Error enviando datos a Google Drive."));
            }
          };

          xhr.onerror = () => reject(new Error("Fallo de red al conectar con Google Drive."));
          xhr.send(archivo);
        });
      }

      // 2. ENVIAR METADATOS Y MINIATURAS A LA API
      setEstado("guardando");
      const formData = new FormData();

      if (directGameId && archivo) {
        formData.append("directGameId", directGameId);
        formData.append("directGameSize", archivo.size.toString());
      }

      if (coverBlob) {
        formData.append("cover", coverBlob, `${titulo || "cover"}.webp`);
      }

      if (iconBlob) {
        formData.append("icon", iconBlob, `${titulo || "icon"}_thumb.webp`);
      }

      if (modo === "actualizar" && actual) {
        formData.append("projectId", actual.id);
      }

      if (jamIdSeleccionada) {
        formData.append("jamId", jamIdSeleccionada);
      }

      formData.append("title", titulo.trim());
      formData.append("description", descripcion.trim());
      formData.append("category", categoria);
      formData.append("accentColor", accentColor);
      formData.append("discordLink", discordLink.trim());
      formData.append("youtubeLink", youtubeLink.trim());
      formData.append("webLink", webLink.trim());

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const dataUpload = await res.json();
      if (!res.ok || !dataUpload.success) {
        throw new Error(dataUpload.error || "No se pudo guardar el proyecto.");
      }

      setEstado("exito");
    } catch (error: any) {
      console.error("Error guardando proyecto:", error);
      setEstado("esperando");
      alert(error.message || "Hubo un error al guardar el proyecto.");
    }
  };

  if (bloqueoFecha) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-red-950/20 border border-red-500/50 p-8 rounded-3xl text-center backdrop-blur-md shadow-[0_0_30px_rgba(239,68,68,0.15)] relative z-10">
        <span className="text-5xl block mb-3">🚫</span>
        <h2 className="text-2xl font-black text-white">Subida Restringida</h2>
        <p className="text-xs text-gray-300 mt-2 leading-relaxed">
          Tu cuenta tiene una penalización activa impuesta por moderación. Tu capacidad de subir juegos nuevos y actualizar proyectos está pausada temporalmente.
        </p>

        {bloqueoFecha !== "permanente" ? (
          <div className="mt-5 inline-block font-mono text-xs bg-red-900/40 border border-red-700/60 text-red-300 px-4 py-2 rounded-xl">
            ⏳ Se restablece el: <span className="font-bold">{new Date(bloqueoFecha).toLocaleString()}</span>
          </div>
        ) : (
          <div className="mt-5 inline-block font-mono text-xs bg-red-900/40 border border-red-700/60 text-red-300 px-4 py-2 rounded-xl font-bold">
            🚨 Cuenta suspendida permanentemente
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-bold px-5 py-2.5 rounded-xl border border-gray-800 transition"
          >
            ← Volver al Catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg backdrop-blur-md">
      
      {/* 4. Panel visual de almacenamiento */}
      {almacenamiento.cargado && (
        <div className="mb-6 p-5 bg-gray-950 border border-gray-800 rounded-xl space-y-5">
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-300 font-bold">
                Almacenamiento utilizado
              </span>

              <span className="text-blue-400 font-mono">
                {formatearMB(almacenamiento.usado)}
                {!almacenamiento.ilimitado &&
                  ` / ${formatearMB(almacenamiento.limite)}`}
              </span>
            </div>

            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${porcentaje}%` }}
              />
            </div>

            <p className="text-[11px] text-gray-500 mt-2">
              {almacenamiento.ilimitado
                ? "Almacenamiento ilimitado"
                : `Te quedan ${formatearMB(restante)} disponibles`}
            </p>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-300 font-bold">
                Proyectos publicados
              </span>

              <span className="text-indigo-400 font-mono">
                {almacenamiento.proyectos} / {almacenamiento.limiteProyectos}
              </span>
            </div>

            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${porcentajeProyectos}%` }}
              />
            </div>
          </div>

          <p className="text-[10px] text-gray-500">
            El almacenamiento incluye los archivos de tus proyectos,
            banners e iconos.
          </p>
        </div>
      )}

      {/* 5. Bloqueo de formulario y contenedor original */}
      {!almacenamiento.cargado ? (
        <p className="text-center text-gray-400 text-sm">
          Calculando tu almacenamiento...
        </p>
      ) : bloquearNuevo && modo === "nuevo" ? (
        <div className="p-5 rounded-xl border border-red-800/50 bg-red-950/30 text-center">
          <div className="text-3xl mb-2">🚫</div>

          <h3 className="font-bold text-red-300">
            No puedes publicar otro proyecto
          </h3>

          <p className="text-sm text-gray-400 mt-2">
            {sinEspacio
              ? "Has alcanzado tu límite de almacenamiento. Elimina archivos o libera espacio."
              : "Has alcanzado tu límite de proyectos. Elimina uno para publicar otro."}
          </p>

          <button
            type="button"
            onClick={() => router.push("/cuenta")}
            className="mt-4 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold"
          >
            Administrar mis proyectos
          </button>
          
          {misProyectos.length > 0 && (
            <button
              type="button"
              onClick={() => cambiarModo("actualizar")}
              className="mt-3 block w-full text-xs text-gray-400 hover:text-white transition"
            >
              o actualizar un proyecto existente
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-950 border border-gray-800 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => cambiarModo("nuevo")}
              className={`py-2 text-sm font-semibold rounded-lg transition ${
                modo === "nuevo" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
              }`}
            >
              ✨ Nuevo Proyecto
            </button>
            <button
              type="button"
              onClick={() => cambiarModo("actualizar")}
              disabled={misProyectos.length === 0}
              className={`py-2 text-sm font-semibold rounded-lg transition ${
                modo === "actualizar"
                  ? "bg-indigo-600 text-white shadow-md"
                  : misProyectos.length === 0
                  ? "text-gray-600 cursor-not-allowed"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              🔄 Actualizar Existente
            </button>
          </div>

          <form onSubmit={manejarEnvio} className="space-y-5">
            {modo === "actualizar" && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Selecciona el proyecto a editar
                </label>
                <select
                  value={proyectoIdSeleccionado}
                  onChange={(e) => cargarDatosEnFormulario(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                >
                  {misProyectos.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Arte del Proyecto (Banner e Ícono)
              </label>
              <div className="relative mb-6">
                <div className="relative border-2 border-dashed border-gray-800 hover:border-gray-700 rounded-xl overflow-hidden aspect-video bg-gray-950/60 flex items-center justify-center group">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <span className="text-2xl block mb-1">🖼️</span>
                      <span className="text-xs text-gray-400">Banner (16:9)</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="text-xs bg-gray-900/90 px-3 py-1.5 rounded-lg border border-gray-700">
                      {coverPreview ? "Cambiar Banner" : "Subir Banner"}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp, .png, .jpg, .jpeg, .webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) procesarCanvas(f, 800, 450, (blob, url) => {
                        setCoverBlob(blob);
                        setCoverPreview(url);
                      });
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>

                <div className="absolute -bottom-4 left-4 w-16 h-16 rounded-xl border-2 border-gray-900 overflow-hidden bg-gray-900 shadow-xl flex items-center justify-center cursor-pointer hover:border-blue-500 transition group/icon">
                  {iconPreview ? (
                    <img src={iconPreview} alt="Icon" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">🎮</span>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/icon:opacity-100 transition flex items-center justify-center">
                    <span className="text-[10px] text-white">Editar</span>
                  </div>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp, .png, .jpg, .jpeg, .webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) procesarCanvas(f, 256, 256, (blob, url) => {
                        setIconBlob(blob);
                        setIconPreview(url);
                      });
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              </div>
            </div>

            {/* 🔥 AQUÍ ENTRA EL CARTEL ÉPICO DE LA GAME JAM 🔥 */}
            {jamIdSeleccionada && (
              <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/50 flex items-center gap-2.5 text-xs text-purple-300 backdrop-blur-md">
                <span className="text-lg">🏆</span>
                <span>Inscribiendo este proyecto en la <strong>Dexa Game Jam</strong> activa.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Título del Juego
              </label>
              <input
                type="text"
                placeholder="Ej: Catrot Horror Survival"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Categoría
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="General">🎮 General</option>
                  <option value="Terror">👁️ Terror</option>
                  <option value="Plataformas">🏃 Plataformas</option>
                  <option value="Acción">💥 Acción</option>
                  <option value="Aventura">🗺️ Aventura</option>
                  <option value="Minijuegos">🕹️ Minijuego</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex justify-between">
                  <span>Color de Acento</span>
                  <span className="font-mono text-[10px] text-gray-400">{accentColor}</span>
                </label>
                <div className="flex items-center gap-1.5 pt-1">
                  {["#3b82f6", "#ef4444", "#a855f7", "#22c55e", "#f97316"].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setAccentColor(hex)}
                      className={`w-6 h-6 rounded-lg transition-transform ${
                        accentColor === hex ? "scale-125 border border-white" : "opacity-80"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <div className="relative w-6 h-6 rounded-lg overflow-hidden border border-gray-700 bg-gray-950 flex items-center justify-center">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <span className="text-[10px]">🎨</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Enlaces de Comunidad (Opcional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm">💬</span>
                  <input
                    type="url"
                    placeholder="Servidor de Discord"
                    value={discordLink}
                    onChange={(e) => setDiscordLink(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm">📺</span>
                  <input
                    type="url"
                    placeholder="Trailer en YouTube"
                    value={youtubeLink}
                    onChange={(e) => setYoutubeLink(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Descripción
              </label>
              <textarea
                rows={2}
                placeholder="Breve sinopsis o notas de cambios..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {modo === "nuevo" ? "Archivo del Juego (.catrobat)" : "Reemplazar Archivo .catrobat (Opcional)"}
              </label>
              <div className="border-2 border-dashed border-gray-800 hover:border-gray-700 rounded-xl p-5 text-center transition cursor-pointer relative bg-gray-950/40">
                <input
                  type="file"
                  accept=".catrobat"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                />
                <span className="text-gray-300 text-sm">
                  {archivo ? (
                    <span className="text-blue-400 font-bold block truncate">📦 {archivo.name}</span>
                  ) : modo === "nuevo" ? (
                    "Selecciona el archivo .catrobat"
                  ) : (
                    "Deja vacío para conservar la versión actual del juego"
                  )}
                </span>
              </div>
            </div>

            <button
  type="submit"
  disabled={estado === "subiendo" || estado === "guardando"}
  className={`w-full py-3.5 rounded-xl font-bold transition ${
    estado === "subiendo" || estado === "guardando"
      ? "bg-gray-800 text-blue-400 cursor-wait"
      : estado === "exito"
      ? "hidden"
      : modo === "nuevo"
      ? "bg-blue-600 hover:bg-blue-500 text-white"
      : "bg-indigo-600 hover:bg-indigo-500 text-white"
  }`}
>
  {estado === "subiendo"
    ? `🚀 Subiendo a la nube... ${porcentajeSubida}%`
    : estado === "guardando"
    ? "💾 Registrando en Dexa Community..."
    : modo === "nuevo"
    ? "Publicar Proyecto"
    : "Guardar Actualización"}
</button>
          </form>
          
          {estado === "exito" && (
            <div className="mt-5 p-5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-center">
              <div className="text-3xl mb-2">🎉</div>

              <h3 className="text-white font-bold text-lg">
                ¡Cambios guardados!
              </h3>

              <p className="text-gray-400 text-sm mt-1 mb-4">
                Tu proyecto ya está actualizado en Dexa Community.
              </p>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition"
              >
                Salir al catálogo
              </button>

              <button
                type="button"
                onClick={() => setEstado("esperando")}
                className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-white transition"
              >
                Seguir editando
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SubirProyectoPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-6 flex justify-center items-center">
      <Suspense fallback={<div className="text-gray-500 text-sm">Cargando editor...</div>}>
        <FormularioSubir />
      </Suspense>
    </main>
  );
}