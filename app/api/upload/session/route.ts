import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createSupabaseServer } from "../../../../lib/supabaseServer";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { fileName, fileSize, mimeType } = await request.json();

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const tokenResponse = await oauth2Client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      return NextResponse.json({ error: "Fallo de autenticación con Google." }, { status: 500 });
    }

    // Pedirle a Google Drive la URL de subida reanudable
    const driveRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType || "application/octet-stream",
          "X-Upload-Content-Length": String(fileSize),
        },
        body: JSON.stringify({
          name: fileName,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
        }),
      }
    );

    const uploadUrl = driveRes.headers.get("location");

    if (!uploadUrl) {
      return NextResponse.json({ error: "Google no devolvió la URL de subida." }, { status: 500 });
    }

    // Devolvemos el enlace al navegador
    return NextResponse.json({ uploadUrl });
  } catch (error: any) {
    console.error("Error al iniciar sesión de subida:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}