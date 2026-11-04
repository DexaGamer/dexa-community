import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(request: Request) {
  try {
    const { project_id } = await request.json();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    }

    // Comprobar si ya le había dado favorito antes
    const { data: existente } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('project_id', project_id)
      .single();

    if (existente) {
      // Si ya estaba, lo quitamos
      await supabase.from('user_favorites').delete().eq('id', existente.id);
      return NextResponse.json({ success: true, action: 'removed' });
    } else {
      // Si no estaba, lo agregamos
      await supabase.from('user_favorites').insert({
        user_id: user.id,
        project_id: project_id
      });
      return NextResponse.json({ success: true, action: 'added' });
    }
  } catch (error: any) {
    console.error("Error en favoritos:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}