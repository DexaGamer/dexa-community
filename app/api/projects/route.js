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
      // Columna confirmada de tu base de datos
      const rawId = p.icon_file_id || p.cover_drive_id || null;

      let finalUrl = null;
      if (rawId) {
        finalUrl = rawId.startsWith("http")
          ? rawId
          : `https://lh3.googleusercontent.com/d/${rawId}`;
      }

      return {
        id: p.id,
        title: p.title || p.name || "Sin título",
        coverUrl: finalUrl,
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