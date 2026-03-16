import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import SignInForm from "./SignInForm";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return <SignInForm />;
}
