
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Rango {
  id: string;
  name: string;
  color: string;
  storage_limit_mb: number;
  project_limit: number;
  sort_order: number;
}

const rangoVacio = {
  name: "",
  color: "#a855f7",
  storage_limit_mb: 670,
  project_limit: 5,
  sort_order: 0,
};

export default function GestionRangos() {
  const [rangos, setRangos] = useState<Rango[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [formulario, setFormulario] = useState(rangoVacio);

  useEffect(() => {
    cargarRangos();
  }, []);

  async function cargarRangos() {
    setCargando(true);

    const { data, error } = await supabase
      .from("ranks")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      alert("Error cargando rangos: " + error.message);
    } else {
      setRangos(data || []);
    }

    setCargando(false);
  }

  function prepararEdicion(rango: Rango) {
    setEditando(rango.id);
    setFormulario({
      name: rango.name,
      color: rango.color,
      storage_limit_mb: rango.storage_limit_mb,
      project_limit: rango.project_limit,
      sort_order: rango.sort_order,
    });
  }

  function limpiarFormulario() {
    setEditando(null);
    setFormulario(rangoVacio);
  }

  async function guardarRango(e: React.FormEvent) {
    e.preventDefault();

    if (!formulario.name.trim()) {
      alert("Escribe un nombre para el rango.");
      return;
    }

    setGuardando(true);

    const datos = {
      ...formulario,
      name: formulario.name.trim(),
    };

    const resultado = editando
      ? await supabase.from("ranks").update(datos).eq("id", editando)
      : await supabase.from("ranks").insert(datos);

    if (resultado.error) {
      alert("No se pudo guardar: " + resultado.error.message);
    } else {
      limpiarFormulario();
      await cargarRangos();
    }

    setGuardando(false);
  }

  async function eliminarRango(rango: Rango) {
    if (!confirm(`¿Eliminar el rango "${rango.name}"?`)) return;

    const { error } = await supabase
      .from("ranks")
      .delete()
      .eq("id", rango.id);

    if (error) {
      alert("No se pudo eliminar: " + error.message);
    } else {
      await cargarRangos();
    }
  }

  const actualizar = (
    campo: keyof typeof rangoVacio,
    valor: string | number
  ) => {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">
          Rangos de la comunidad
        </h1>
        <p className="text-gray-400 text-sm">
          Crea y configura los niveles de los usuarios.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={guardarRango}
          className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 h-fit"
        >
          <h2 className="text-lg font-bold text-white mb-5">
            {editando ? "Editar rango" : "Crear rango"}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Nombre
              </label>
              <input
                required
                value={formulario.name}
                onChange={(e) => actualizar("name", e.target.value)}
                placeholder="Ej. Desarrollador"
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Color del rango
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={formulario.color}
                  onChange={(e) => actualizar("color", e.target.value)}
                  className="w-12 h-12 bg-transparent cursor-pointer"
                />
                <span className="text-gray-400 text-sm font-mono">
                  {formulario.color}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Almacenamiento (MB)
              </label>
              <input
                type="number"
                min="0"
                required
                value={formulario.storage_limit_mb}
                onChange={(e) =>
                  actualizar("storage_limit_mb", Number(e.target.value))
                }
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Límite de proyectos
              </label>
              <input
                type="number"
                min="0"
                required
                value={formulario.project_limit}
                onChange={(e) =>
                  actualizar("project_limit", Number(e.target.value))
                }
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Orden de aparición
              </label>
              <input
                type="number"
                value={formulario.sort_order}
                onChange={(e) =>
                  actualizar("sort_order", Number(e.target.value))
                }
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-purple-500"
              />
            </div>

            <button
              type="submit"
              disabled={guardando}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold transition"
            >
              {guardando
                ? "Guardando..."
                : editando
                  ? "Guardar cambios"
                  : "Crear rango"}
            </button>

            {editando && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="w-full py-2 text-gray-400 hover:text-white text-sm"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-white">
            Rangos existentes ({rangos.length})
          </h2>

          {cargando ? (
            <div className="text-gray-500 py-10 text-center">
              Cargando rangos...
            </div>
          ) : rangos.length === 0 ? (
            <div className="text-gray-500 py-10 text-center">
              Todavía no hay rangos.
            </div>
          ) : (
            rangos.map((rango) => (
              <div
                key={rango.id}
                className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-4 h-12 rounded-full"
                    style={{ backgroundColor: rango.color }}
                  />

                  <div>
                    <h3
                      className="font-black text-lg"
                      style={{ color: rango.color }}
                    >
                      {rango.name}
                    </h3>

                    <p className="text-xs text-gray-400 mt-1">
                      {rango.storage_limit_mb.toLocaleString()} MB ·{" "}
                      {rango.project_limit} proyectos
                    </p>

                    <p className="text-[10px] text-gray-600 mt-1">
                      Orden: {rango.sort_order}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => prepararEdicion(rango)}
                    className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold"
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => eliminarRango(rango)}
                    className="px-4 py-2 rounded-lg bg-red-950/40 hover:bg-red-900 text-red-400 text-xs font-bold"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
