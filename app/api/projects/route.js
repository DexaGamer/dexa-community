import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const featuredOnly = searchParams.get("featured") === "true";
  const limit = Number(searchParams.get("limit")) || 5;

  let query = supabase
    .from("projects")
    .select("id, title, cover_drive_id, is_featured")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (featuredOnly) {
    query = query.eq("is_featured", true);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const proyectos = data.map((p) => ({
    id: p.id,
    title: p.title,
    coverUrl: p.cover_drive_id
      ? `https://lh3.googleusercontent.com/d/${p.cover_drive_id}`
      : null,
  }));

  return NextResponse.json(proyectos);
}