import { redirect } from "next/navigation";

// /admin is the founder dashboard root → land on the metrics overview.
// Users list lives one click away in the sidebar.
export default function AdminIndex() {
  redirect("/admin/metrics");
}
