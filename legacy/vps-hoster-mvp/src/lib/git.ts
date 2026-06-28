import fs from "fs/promises";
import path from "path";
import simpleGit from "simple-git";
import { config } from "./config";

export async function cloneOrPull(
  repoUrl: string,
  branch: string,
  slug: string,
  rootDir: string
): Promise<{ commitSha: string; commitMessage: string; workDir: string }> {
  await fs.mkdir(config.reposDir, { recursive: true });
  const repoPath = path.join(config.reposDir, slug);
  const workDir = path.join(repoPath, rootDir === "." ? "" : rootDir);

  const git = simpleGit();
  const exists = await fs
    .access(repoPath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    await git.clone(repoUrl, repoPath, ["--branch", branch, "--single-branch"]);
  } else {
    const repoGit = simpleGit(repoPath);
    await repoGit.fetch("origin", branch);
    await repoGit.checkout(branch);
    await repoGit.pull("origin", branch);
  }

  const repoGit = simpleGit(repoPath);
  const log = await repoGit.log({ maxCount: 1 });
  const latest = log.latest;

  return {
    commitSha: latest?.hash ?? "unknown",
    commitMessage: latest?.message ?? "",
    workDir,
  };
}

export async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}
