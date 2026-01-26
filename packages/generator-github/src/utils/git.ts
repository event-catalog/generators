import { execSync } from 'child_process';

const getAuthenticatedUrl = (source: string, token?: string): string => {
  if (!token) return source;

  try {
    const url = new URL(source);
    // Use x-access-token format which works for both GitHub App tokens and PATs
    // Format: https://x-access-token:TOKEN@github.com/owner/repo
    url.username = 'x-access-token';
    url.password = token;
    return url.toString();
  } catch {
    // If URL parsing fails (e.g., SSH URLs), return original
    return source;
  }
};

export const cloneRepo = async (source: string, destination: string, branch?: string, path?: string, token?: string) => {
  const authenticatedSource = getAuthenticatedUrl(source, token);

  // Clone the repo without checking out the files
  await execSync(`git clone --no-checkout ${authenticatedSource} ${destination}`);

  if (path) {
    // Sparse checkout the content
    await execSync(`git sparse-checkout init`, { cwd: destination });
    await execSync(`git sparse-checkout set ${path}`, { cwd: destination });
  }

  // Sparse checkout the content
  await execSync(`git sparse-checkout init`, { cwd: destination });

  const gitPaths = [path].map((p) => p?.replace(/\\/g, '/'));

  await execSync(`git sparse-checkout set ${gitPaths.join(' ')} --no-cone`, { cwd: destination });

  // // Checkout the branch
  await execSync(`git checkout ${branch || 'main'}`, { cwd: destination });
};
