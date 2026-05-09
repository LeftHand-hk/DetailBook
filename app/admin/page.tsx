import { redirect } from "next/navigation";

// Overview was removed from the admin nav. Visiting /admin lands on the
// Users list (the new default entry point).
export default function AdminIndex() {
  redirect("/admin/users");
}
