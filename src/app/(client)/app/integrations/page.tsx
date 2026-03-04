import { permanentRedirect } from "next/navigation";

export default function IntegrationsRedirect() {
  permanentRedirect("/app/connections");
}
