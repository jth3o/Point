import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isBugReportsAdminEmail } from "@/lib/bug-reports-admin";

export async function GET() {
  const session = await auth();
  const email =
    session?.user && "email" in session.user
      ? (session.user.email as string | undefined)
      : undefined;
  return NextResponse.json({ canView: isBugReportsAdminEmail(email) });
}
