import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const featuredOnly = searchParams.get("featured") === "true";
    const limit = Number(searchParams.get("limit")) || 5;

    // Pedimos * para no fallar si cambia algún nombre de columna
    let query = supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (featuredOnly) {
      query = query.eq("is_featured", true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const proyectos = (data || []).map((p) => {
      // Busca automáticamente la columna que guarde la imagen
      const rawCover =
        p.cover_url ||
        p.image_url ||
        p.cover ||
        p.thumbnail_url ||
        p.portada_url ||
        null;

      // Si es un ID de Google Drive lo convierte a URL, si ya es URL lo deja pasar
      let finalCover = rawCover;
      if (rawCover && !rawCover.startsWith("http")) {
        finalCover = `https://lh3.googleusercontent.com/d/${rawCover}`;
      }

      return {
        id: p.id,
        title: p.title || p.name || "Sin título",
        coverUrl: finalCover,
      };
    });

    return NextResponse.json(proyectos);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}