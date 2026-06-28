export function buildTraefikLabels(
  slug: string,
  port: number,
  domains: { hostname: string }[]
): Record<string, string> {
  const routerName = `vps-${slug}`;
  const hostRules = domains.map((d) => `Host(\`${d.hostname}\`)`).join(" || ");
  const labels: Record<string, string> = {
    "traefik.enable": "true",
    [`traefik.http.routers.${routerName}.rule`]: hostRules,
    [`traefik.http.routers.${routerName}.entrypoints`]: "websecure",
    [`traefik.http.routers.${routerName}.tls`]: "true",
    [`traefik.http.routers.${routerName}.tls.certresolver`]: "letsencrypt",
    [`traefik.http.services.${routerName}.loadbalancer.server.port`]: String(port),
  };

  const httpRouter = `${routerName}-http`;
  labels[`traefik.http.routers.${httpRouter}.rule`] = hostRules;
  labels[`traefik.http.routers.${httpRouter}.entrypoints`] = "web";
  labels[`traefik.http.routers.${httpRouter}.middlewares`] = `${routerName}-redirect`;
  labels[`traefik.http.middlewares.${routerName}-redirect.redirectscheme.scheme`] =
    "https";

  return labels;
}
