import { expect, it, describe, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Import after mocking
import { cloneRepo } from '../utils/git';

describe('git utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cloneRepo', () => {
    describe('token authentication', () => {
      it('when no token is provided, the source URL is used as-is', async () => {
        const source = 'https://github.com/owner/repo.git';
        const destination = '/tmp/test';

        await cloneRepo(source, destination, 'main', 'path');

        // First call is git clone - check it uses the original URL
        const firstCall = vi.mocked(execSync).mock.calls[0][0] as string;
        expect(firstCall).toBe(`git clone --no-checkout ${source} ${destination}`);
      });

      it('when a token is provided, it is embedded in the URL using x-access-token format', async () => {
        const source = 'https://github.com/owner/repo.git';
        const destination = '/tmp/test';
        const token = 'ghp_xxxxxxxxxxxx';

        await cloneRepo(source, destination, 'main', 'path', token);

        // First call should be git clone with authenticated URL
        const firstCall = vi.mocked(execSync).mock.calls[0][0] as string;
        expect(firstCall).toBe(
          `git clone --no-checkout https://x-access-token:${token}@github.com/owner/repo.git ${destination}`
        );
      });

      it('when a token with special characters is provided, it is URL-encoded', async () => {
        const source = 'https://github.com/owner/repo.git';
        const destination = '/tmp/test';
        const token = 'token/with+special=chars';

        await cloneRepo(source, destination, 'main', 'path', token);

        // Token should be URL-encoded in the clone command (/ becomes %2F, = becomes %3D)
        const firstCall = vi.mocked(execSync).mock.calls[0][0] as string;
        expect(firstCall).toContain('x-access-token:token%2Fwith+special%3Dchars@github.com');
      });

      it('when an SSH URL is provided with a token, the original URL is used (SSH does not support URL-embedded tokens)', async () => {
        const source = 'git@github.com:owner/repo.git';
        const destination = '/tmp/test';
        const token = 'ghp_xxxxxxxxxxxx';

        await cloneRepo(source, destination, 'main', 'path', token);

        // SSH URL should remain unchanged since URL parsing fails
        const firstCall = vi.mocked(execSync).mock.calls[0][0] as string;
        expect(firstCall).toBe(`git clone --no-checkout ${source} ${destination}`);
      });

      it('works with GitHub App installation tokens (ghs_ prefix)', async () => {
        const source = 'https://github.com/owner/private-repo.git';
        const destination = '/tmp/test';
        const token = 'ghs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

        await cloneRepo(source, destination, 'main', 'path', token);

        const firstCall = vi.mocked(execSync).mock.calls[0][0] as string;
        expect(firstCall).toBe(
          `git clone --no-checkout https://x-access-token:${token}@github.com/owner/private-repo.git ${destination}`
        );
      });
    });
  });
});
