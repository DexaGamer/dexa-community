import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";
import { createSupabaseServer } from "../../../lib/supabaseServer";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const MB = 1024 * 1024;
const MAX_GAME_SIZE = 100 * MB;
const MAX_IMAGE_SIZE = 10 * MB;

export async function POST(request: Request) {
  const uploadedIds: string[] = [];

  let drive: ReturnType<typeof google.drive> | null = null;

  try {
    // 1. Comprobar sesión
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión." },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const cover = formData.get("cover") as File | null;
    const icon = formData.get("icon") as File | null;

    const projectId = formData.get("projectId")?.toString() || null;

    if (!file && !cover && !icon && !projectId) {
      return NextResponse.json(
        { error: "No se recibieron datos." },
        { status: 400 }
      );
    }

    if (!projectId && !file) {
      return NextResponse.json(
        { error: "Un proyecto nuevo necesita un archivo .catrobat." },
        { status: 400 }
      );
    }

    // 2. Validar archivos
    if (file) {
      if (!file.name.toLowerCase().endsWith(".catrobat")) {
        return NextResponse.json(
          { error: "El archivo debe ser .catrobat." },
          { status: 400 }
        );
      }

      if (file.size > MAX_GAME_SIZE) {
        return NextResponse.json(
          { error: "El juego supera el máximo de 100 MB." },
          { status: 400 }
        );
      }
    }

    for (const image of [cover, icon]) {
      if (!image) continue;

      if (!image.type.startsWith("image/") || image.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: "Las imágenes deben ser válidas y no superar 10 MB." },
          { status: 400 }
        );
      }
    }

    // 3. Comprobar propiedad del proyecto
    let proyectoAnterior: any = null;

    if (projectId) {
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return NextResponse.json(
          { error: "El proyecto no existe o no te pertenece." },
          { status: 403 }
        );
      }

      proyectoAnterior = data;
    }

    // 4. Conectar con Google Drive
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    drive = google.drive({
      version: "v3",
      auth: oauth2Client,
    });

    const obtenerTamaño = async (id: string | null) => {
      if (!id) return 0;

      const resultado = await drive!.files.get({
        fileId: id,
        fields: "size",
      });

      return Number(resultado.data.size || 0);
    };

    // 5. Conservar IDs anteriores si no se reemplazan
    let gameId = proyectoAnterior?.drive_file_id || null;
    let coverId = proyectoAnterior?.cover_file_id || null;
    let iconId = proyectoAnterior?.icon_file_id || null;

    const subirADrive = async (archivo: File) => {
      const buffer = Buffer.from(await archivo.arrayBuffer());
      const stream = Readable.from(buffer);

      const resultado = await drive!.files.create({
        requestBody: {
          name: archivo.name,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
        },
        media: {
          mimeType: archivo.type || "application/octet-stream",
          body: stream,
        },
        fields: "id",
      });

      const id = resultado.data.id;

      if (!id) throw new Error("Google Drive no devolvió un ID.");

      uploadedIds.push(id);

      await drive!.permissions.create({
        fileId: id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      return id;
    };

    // 6. Subir los archivos nuevos sin borrar los anteriores
    if (file) gameId = await subirADrive(file);
    if (cover) coverId = await subirADrive(cover);
    if (icon) iconId = await subirADrive(icon);

    // 7. Calcular el tamaño total del proyecto
    const tamañoJuego = file
      ? file.size
      : await obtenerTamaño(gameId);

    const tamañoCover = cover
      ? cover.size
      : await obtenerTamaño(coverId);

    const tamañoIcon = icon
      ? icon.size
      : await obtenerTamaño(iconId);

    const bytesTotales = tamañoJuego + tamañoCover + tamañoIcon;
    const sizeMb = bytesTotales / MB;
    const fileSizeMb = Math.ceil(sizeMb);

    // 8. Preparar datos del proyecto
    const titulo = formData.get("title")?.toString().trim();
    const descripcion = formData.get("description")?.toString().trim();
    const jamId = formData.get("jamId")?.toString() || null;

    const proyecto = {
      title: titulo || file?.name.replace(/\.catrobat$/i, "") || proyectoAnterior?.title || "Proyecto sin título",
      description: descripcion || "Proyecto de Dexa Community",
      category: formData.get("category")?.toString() || proyectoAnterior?.category || "General",
      accent_color: formData.get("accentColor")?.toString() || proyectoAnterior?.accent_color || "#3b82f6",
      social_discord: formData.get("discordLink")?.toString() || null,
      social_youtube: formData.get("youtubeLink")?.toString() || null,
      social_web: formData.get("webLink")?.toString() || null,
      drive_file_id: gameId,
      cover_file_id: coverId,
      icon_file_id: iconId,
      jam_id: jamId || null, // 👈 ¡ESTA ES LA LÍNEA MÁGICA!
    };

    // 9. Guardar proyecto y actualizar almacenamiento en una transacción
    const { data: savedId, error: saveError } = await supabaseAdmin.rpc(
      "guardar_proyecto_seguro",
      {
        p_user_id: user.id,
        p_project_id: projectId,
        p_project: proyecto,
        p_file_size_mb: fileSizeMb,
        p_size_mb: sizeMb,
      }
    );

    if (saveError) {
      if (drive) {
        for (const id of uploadedIds) {
          try {
            await drive.files.delete({ fileId: id });
          } catch (cleanupError) {
            console.error("Error limpiando archivo:", cleanupError);
          }
        }
        uploadedIds.length = 0;
      }

      if (saveError.message.includes("STORAGE_LIMIT_EXCEEDED")) {
        return NextResponse.json(
          { error: "Has superado tu límite de almacenamiento. Libera espacio para subir más archivos." },
          { status: 413 }
        );
      }

      if (saveError.message.includes("PROJECT_NOT_FOUND")) {
        return NextResponse.json(
          { error: "El proyecto no existe o no te pertenece." },
          { status: 403 }
        );
      }

      throw saveError;
    }

    // 👇 ASIGNAR JAM_ID DIRECTAMENTE AL PROYECTO CREADO O EDITADO 👇
    const finalProjectId = savedId || projectId;
    if (finalProjectId && jamId) {
      await supabaseAdmin
        .from("projects")
        .update({ jam_id: jamId })
        .eq("id", finalProjectId);
    }
    // 👆 FIN DEL BLOQUE 👆

    // 10. Solo ahora eliminar los archivos anteriores reemplazados
    const archivosAnteriores = [
      file ? proyectoAnterior?.drive_file_id : null,
      cover ? proyectoAnterior?.cover_file_id : null,
      icon ? proyectoAnterior?.icon_file_id : null,
    ].filter(Boolean) as string[];

    for (const id of archivosAnteriores) {
      try {
        await drive.files.delete({ fileId: id });
      } catch (error) {
        console.warn("No se pudo eliminar archivo anterior:", id, error);
      }
    }

    return NextResponse.json({
      success: true,
      projectId: savedId,
      size_mb: sizeMb,
      file_size_mb: fileSizeMb,
    });

  } catch (error) {
    console.error("Error en subida:", error);

    // Si falla el proceso, limpiar los archivos nuevos.
    // Los anteriores todavía no se han eliminado.
    if (drive) {
      for (const id of uploadedIds) {
        try {
          await drive.files.delete({ fileId: id });
        } catch (cleanupError) {
          console.error("Error limpiando archivo nuevo:", cleanupError);
        }
      }
    }

    return NextResponse.json(
      { error: "No se pudo guardar el proyecto. Tus archivos anteriores se conservaron." },
      { status: 500 }
    );
  }
}