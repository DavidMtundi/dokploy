import path from "path";

export const config = {
  dataDir: process.env.VPS_HOSTER_DATA_DIR ?? path.join(process.cwd(), "data"),
  reposDir: path.join(
    process.env.VPS_HOSTER_DATA_DIR ?? path.join(process.cwd(), "data"),
    "repos"
  ),
  network: process.env.VPS_HOSTER_NETWORK ?? "vps-hoster",
  traefikNetwork: process.env.TRAEFIK_NETWORK ?? "vps-hoster",
  baseDomain: process.env.VPS_HOSTER_BASE_DOMAIN ?? "localhost",
  letsencryptEmail: process.env.LETSENCRYPT_EMAIL ?? "",
};
