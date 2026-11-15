import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { homeFor } from "@/lib/auth-routing";
import { getDoctors, getUpcoming } from "@/lib/repository";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(homeFor(user.role));
  }
  const [doctors, upcoming] = await Promise.all([getDoctors(), getUpcoming()]);
  return <LandingPage doctors={doctors} upcoming={upcoming} role={null} />;
}
