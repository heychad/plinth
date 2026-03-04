import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;

  if (role === "consultant" || role === "platform_admin") {
    redirect("/dashboard");
  }

  redirect("/app");
}
