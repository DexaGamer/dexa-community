"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let activo = true;

    async function verificarAdmin() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: perfil, error: perfilError } = await supabase
          .from("profiles")
          .select("rank, role")
          .eq("id", user.id)
          .single();

        if (perfilError || (perfil?.rank !== "Creador" && perfil?.role !== "admin")) {
          router.replace("/");
          return;
        }

        if (activo) setAutorizado(true);
      } catch (error) {
        console.error("Error verificando admin:", error);
        router.replace("/");
      } finally {
        if (activo) setCargando(false);
      }
    }

    verificarAdmin();
    return () => { activo = false; };
  }, [router]);

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#070709] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!autorizado) return null;

  const navLinks = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
    { href: "/admin/usuarios", label: "Usuarios", icon: "👥" },
    { href: "/admin/proyectos", label: "Proyectos", icon: "📁" },
    { href: "/admin/moderacion", label: "Moderación", icon: "🛡️" },
    { href: "/admin/comunidad", label: "Comunidad", icon: "📢" },
    { href: "/admin/rangos", label: "Rangos", icon: "🏅" },
    { href: "/admin/configuracion", label: "Configuración", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-[#070709] text-white flex overflow-hidden">
      <aside className="w-64 bg-gray-950 border-r border-gray-800 flex-col hidden md:flex z-20 relative">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 to-cyan-500">
            Dexa Admin
          </h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">
            Centro de Mando
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-purple-500/10 text-purple-400 font-bold border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                    : "text-gray-400 hover:bg-gray-900/80 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <Link
            href="/"
            className="block text-center px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-bold transition"
          >
            ← Salir al Catálogo
          </Link>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-purple-600/10 blur-[120px] pointer-events-none rounded-full" />
        <div className="p-6 md:p-10 relative z-10">{children}</div>
      </main>
    </div>
  );
}