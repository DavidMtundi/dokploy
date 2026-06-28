import { spawn } from "child_process";
import path from "path";
import { hasDockerfile } from "./nixpacks-detect";

export { hasDockerfile };

export async function buildWithNixpacks(
  workDir: string,
  imageTag: string,
  log: (line: string) => Promise<void>
): Promise<void> {
  const absWorkDir = path.resolve(workDir);
  await log(`Building with Nixpacks CLI → ${imageTag}`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "nixpacks",
      ["build", absWorkDir, "--name", imageTag],
      {
        env: {
          ...process.env,
          DOCKER_HOST: process.env.DOCKER_HOST,
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const handle = (chunk: Buffer) => {
      const text = chunk.toString("utf-8").trim();
      if (text) void log(text);
    };

    proc.stdout?.on("data", handle);
    proc.stderr?.on("data", handle);
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Nixpacks build failed with exit code ${code}`));
    });
  });

  await log("Nixpacks build completed.");
}
