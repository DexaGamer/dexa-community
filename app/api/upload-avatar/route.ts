import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
    let oldAvatarId = formData.get("oldAvatarId") as string | null;

    if (!file || !userId) {
      return NextResponse.json(
        { error: "Falta la imagen o el identificador de usuario." },
        { status: 400 }
      );
    }

    // 1. Si no vino el oldAvatarId por el formulario, lo buscamos en Supabase
    if (!oldAvatarId) {
      const { data: perfil } = await supabaseAdmin
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();

      if (perfil?.avatar_url) {
        const match = perfil.avatar_url.match(/\/d\/([^/]+)/);
        if (match) oldAvatarId = match[1];
      }
    }

    // 2. BORRAR EL AVATAR ANTERIOR DE GOOGLE DRIVE (Limpieza de basura)
    if (oldAvatarId) {
      try {
        await drive.files.delete({ fileId: oldAvatarId });
        console.log(`[Drive] Avatar viejo eliminado: ${oldAvatarId}`);
      } catch (delError: any) {
        console.warn("[Drive] No se pudo borrar el avatar anterior:", delError.message);
      }
    }

    // 3. SUBIR EL NUEVO AVATAR A GOOGLE DRIVE
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const driveRes = await drive.files.create({
      requestBody: {
        name: `avatar_${userId}_${Date.now()}.webp`,
        parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined,
      },
      media: {
        mimeType: "image/webp",
        body: stream,
      },
      fields: "id",
    });

    const newFileId = driveRes.data.id;
    if (!newFileId) {
      throw new Error("Google Drive no generó un ID para el archivo.");
    }

    // 4. HACER PÚBLICO EL AVATAR EN DRIVE
    await drive.permissions.create({
      fileId: newFileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const avatarUrl = `https://lh3.googleusercontent.com/d/${newFileId}`;

    return NextResponse.json({
      success: true,
      avatar_url: avatarUrl,
      fileId: newFileId,
    });
  } catch (error: any) {
    console.error("ERROR EN UPLOAD-AVATAR:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la subida del avatar." },
      { status: 500 }
    );
  }
}