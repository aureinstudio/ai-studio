import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_avatars")
    .select("id, heygen_talking_photo_id, label, gender, source_image_url, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    avatars: (data ?? []).map((a) => ({
      id: a.id,
      talking_photo_id: a.heygen_talking_photo_id,
      label: a.label,
      gender: a.gender,
      source_image_url: a.source_image_url,
      created_at: a.created_at,
    })),
  });
}
