import { LandingPage } from "@/components/landing/LandingPage";
import { getDoctors, getUpcoming } from "@/lib/repository";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const [doctors, upcoming, user] = await Promise.all([getDoctors(), getUpcoming(), getCurrentUser()]);
  const role = user ? (user.role === "patient" ? "patient" : "staff") : null;
  return <LandingPage doctors={doctors} upcoming={upcoming} role={role} />;
}
