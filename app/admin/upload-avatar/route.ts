import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";
import { createClient } from "@supabase/supabase-js";

// Inicializar cliente administrativo de Supabase
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Configuración de Google Drive con credenciales OAuth
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: "v3", auth: oauth2Client });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;
    const userId = formData.get("userId") as string | null;

    if (!file || !userId) {
      return NextResponse.json(
        { error: "Falta el archivo de imagen o el ID de usuario." },
        { status: 400 }
      );
    }

    // 1. OBTENER Y ELIMINAR EL AVATAR ANTERIOR (Si existe en Drive)
    const { data: perfilActual } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .single();

    if (perfilActual?.avatar_url) {
      // Extraemos el ID de Drive de la URL (ej: https://lh3.googleusercontent.com/d/ID_AQUI)
      const match = perfilActual.avatar_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      const oldFileId = match ? match[1] : null;

      if (oldFileId) {
        try {
          await drive.files.delete({ fileId: oldFileId });
          console.log(`[Drive] Avatar viejo eliminado: ${oldFileId}`);
        } catch (delError: any) {
          console.warn("[Drive] No se pudo borrar el avatar anterior:", delError.message);
        }
      }
    }

    // 2. SUBIR EL NUEVO AVATAR A GOOGLE DRIVE
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const driveRes = await drive.files.create({
      requestBody: {
        name: `avatar_${userId}_${Date.now()}.${file.name.split(".").pop() || "png"}`,
        // Si tienes una carpeta designada para avatares, pon su ID aquí; si no, va a la raíz
        parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined,
      },
      media: {
        mimeType: file.type,
        body: stream,
      },
      fields: "id",
    });

    const newFileId = driveRes.data.id;
    if (!newFileId) {
      throw new Error("Google Drive no devolvió un ID para el archivo subido.");
    }

    // 3. HACER EL ARCHIVO PÚBLICO PARA LECTURA
    await drive.permissions.create({
      fileId: newFileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const avatarUrl = `https://lh3.googleusercontent.com/d/${newFileId}`;

    // 4. ACTUALIZAR SUPABASE
    const { error: dbError } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId);

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      avatar_url: avatarUrl,
      fileId: newFileId,
    });
  } catch (error: any) {
    console.error("ERROR SUBIENDO AVATAR:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la subida del avatar." },
      { status: 500 }
    );
  }
}