import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createSupabaseServer } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: Request) {
  try {
    // 1. Verificar sesión
    const supabase = await createSupabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión.' },
        { status: 401 }
      )
    }

    // 2. Verificar perfil
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, rank')
      .eq('id', user.id)
      .single()

    console.log("DELETE DEBUG:", {
      userId: user.id,
      profile,
      profileError: profileError?.message,
      profileErrorCode: profileError?.code,
    })

    if (profileError || !profile) {
      console.error("PERMISO DENEGADO:", {
        profileError,
        profile,
        userId: user.id,
      })

      return NextResponse.json(
        { error: 'No se pudo verificar tu perfil. Revisa los registros del servidor.' },
        { status: 403 }
      )
    }

    // 3. Obtener ID
    const body = await request.json()
    const projectId = body.projectId

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'ID de proyecto inválido.' },
        { status: 400 }
      )
    }

    // 4. Buscar proyecto
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, owner_id, drive_file_id, cover_file_id, icon_file_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado.' },
        { status: 404 }
      )
    }

    // Solo el dueño o un administrador/creador pueden eliminarlo
    const esAdministrador =
      profile.role === 'admin' || profile.rank === 'Creador'
    const esPropietario = project.owner_id === user.id

    if (!esAdministrador && !esPropietario) {
      return NextResponse.json(
        { error: 'No puedes eliminar este proyecto.' },
        { status: 403 }
      )
    }

    // 5. Conectar con Google Drive
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    )

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    })

    const drive = google.drive({
      version: 'v3',
      auth: oauth2Client,
    })

    const about = await drive.about.get({
      fields: 'user(emailAddress, displayName)',
    })

    console.log('CUENTA DE GOOGLE CONECTADA:', about.data.user)

    // 6. Eliminar archivos de Drive
    const fileIds = [
      project.drive_file_id,
      project.cover_file_id,
      project.icon_file_id,
    ].filter((id): id is string => Boolean(id))

    console.log('ARCHIVOS QUE SE INTENTARÁN ELIMINAR:', fileIds)

    for (const fileId of [...new Set(fileIds)]) {
      try {
        const archivo = await drive.files.get({
          fileId,
          fields: 'id,name,mimeType,parents,webViewLink',
        })

        console.log('ARCHIVO ENCONTRADO:', archivo.data)

        await drive.files.delete({ fileId })

        console.log('ELIMINACIÓN CONFIRMADA:', fileId)

        try {
          await drive.files.get({
            fileId,
            fields: 'id,name',
          })

          console.error('⚠️ EL ARCHIVO SIGUE EXISTIENDO:', fileId)
        } catch (error: any) {
          if (error.code === 404) {
            console.log('✅ ARCHIVO YA NO EXISTE:', fileId)
          } else {
            throw error
          }
        }
      } catch (error: any) {
        console.error('❌ ERROR CON ARCHIVO:', fileId, error.message)
        throw error
      }
    }

    // 7. Eliminar registro de Supabase
    const { error: deleteError } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', project.id)

    if (deleteError) {
      console.error('Error eliminando proyecto:', deleteError)

      return NextResponse.json(
        { error: 'No se pudo eliminar el proyecto de la base de datos.' },
        { status: 500 }
      )
    }

    // 8. Recalcular almacenamiento del propietario
    const { data: proyectosRestantes, error: storageError } = await supabaseAdmin
      .from('projects')
      .select('size_mb, file_size_mb')
      .eq('owner_id', project.owner_id)

    if (storageError) {
      console.error('Error calculando almacenamiento:', storageError)

      return NextResponse.json({
        success: true,
        storageUpdated: false,
        message: 'Proyecto eliminado. No se pudo actualizar el contador de almacenamiento.',
      })
    }

    const almacenamientoTotal = (proyectosRestantes || []).reduce(
      (total, p) => total + Number(p.size_mb || p.file_size_mb || 0),
      0
    )

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ storage_used_mb: almacenamientoTotal })
      .eq('id', project.owner_id)

    if (updateError) {
      console.error('Error actualizando almacenamiento:', updateError)

      return NextResponse.json({
        success: true,
        storageUpdated: false,
        message: 'Proyecto eliminado. No se pudo actualizar el contador de almacenamiento.',
      })
    }

    return NextResponse.json({
      success: true,
      storageUpdated: true,
      storageUsed: almacenamientoTotal,
    })

  } catch (error) {
    console.error('Error en delete-project:', error)

    return NextResponse.json(
      { error: 'Ocurrió un error durante la eliminación.' },
      { status: 500 }
    )
  }
}