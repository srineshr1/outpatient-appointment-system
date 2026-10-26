import { DoctorDirectory } from "@/components/directory/DoctorDirectory";
import { getDoctors, getUpcoming } from "@/lib/repository";

export default async function HomePage() {
  const [doctors, upcoming] = await Promise.all([getDoctors(), getUpcoming()]);
  return <DoctorDirectory doctors={doctors} upcoming={upcoming} />;
}
