import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

export async function GET() {
  const authenticated = await isAdmin();
  return NextResponse.json({ authenticated });
}
