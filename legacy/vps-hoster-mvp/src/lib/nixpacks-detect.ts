import path from "path";
import fs from "fs/promises";

export async function hasDockerfile(workDir: string): Promise<boolean> {
  return fs
    .access(path.join(workDir, "Dockerfile"))
    .then(() => true)
    .catch(() => false);
}
