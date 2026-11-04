import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: Request) {
  try {
    // 1. Paginación
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 2. Consulta 100% segura (sin JOINs que rompan Supabase)
    const { data: proyectos, error: errProyectos, count } = await supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (errProyectos) throw errProyectos;

    // 3. Extraer IDs de dueños y buscar perfiles por separado
    const ownerIds = Array.from(new Set((proyectos || []).map((p) => p.owner_id).filter(Boolean)));
    let perfilesMap = new Map();

    if (ownerIds.length > 0) {
      const { data: listaPerfiles, error: errPerfiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', ownerIds);

      if (!errPerfiles && listaPerfiles) {
        listaPerfiles.forEach((prof) => {
          perfilesMap.set(prof.id, prof);
        });
      }
    }

    // 4. Formatear la respuesta cruzando los datos en memoria
    const payload = (proyectos || []).map((p) => {
      const autor = perfilesMap.get(p.owner_id) || {};
      
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category || 'General',
        color: p.accent_color || '#3b82f6',
        size_mb: p.file_size_mb,
        downloads: p.downloads_count || 0,
        created_at: p.created_at,
        
        download_url: p.drive_file_id ? `https://drive.google.com/uc?export=download&id=${p.drive_file_id}` : null,
        cover_url: p.cover_file_id ? `https://lh3.googleusercontent.com/d/${p.cover_file_id}` : null,
        icon_url: p.icon_file_id ? `https://lh3.googleusercontent.com/d/${p.icon_file_id}` : null,
        
        author: {
          username: autor.username || 'creador',
          display_name: autor.display_name || autor.username || 'Creador',
          avatar_url: autor.avatar_url || null,
        }
      };
    });

    // 5. Devolver JSON listo para Android
    return NextResponse.json({
      success: true,
      data: payload,
      pagination: {
        page,
        limit,
        total_items: count,
        total_pages: count ? Math.ceil(count / limit) : 0,
        has_more: count ? offset + limit < count : false
      }
    });

  } catch (error: any) {
    console.error("🚨 Error en API v1 projects:", error);
    // Ahora devolverá el mensaje exacto del error en pantalla
    return NextResponse.json(
      { success: false, error: error.message || 'Fallo interno del servidor' }, 
      { status: 500 }
    );
  }
}