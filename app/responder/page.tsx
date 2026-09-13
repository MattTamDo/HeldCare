import { redirect } from "next/navigation";

export default function ResponderRedirect() {
  redirect("/monitor?tab=responder");
}
