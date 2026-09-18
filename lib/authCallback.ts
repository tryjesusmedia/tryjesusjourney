type AuthResult = { error: unknown };
type AuthClient = {
  getSession: () => Promise<{ data: { session: unknown }; error: unknown }>;
  exchangeCodeForSession: (code: string, options?: { flowId: string }) => Promise<AuthResult>;
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<AuthResult>;
};

// Both the browser result and Expo Router may receive the same redirect.
// Share the exchange so the one-time PKCE code is consumed exactly once.
export function createAuthCallbackHandler(auth: AuthClient) {
  let lastKey = '';
  let lastCompletion: Promise<boolean> | null = null;

  return async function completeAuthCallback(url: string): Promise<boolean> {
    const parsed = new URL(url);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const param = (name: string) => parsed.searchParams.get(name) ?? hash.get(name);
    if (param('error') || param('error_description')) {
      throw new Error('Sign-in was not completed. Please try again.');
    }
    const code = param('code');
    const flowId = param('sb_flow_id');
    const accessToken = param('access_token');
    const refreshToken = param('refresh_token');
    const key = code ? `code:${code}` : accessToken && refreshToken ? `token:${accessToken}` : '';
    if (!key) {
      throw new Error('This sign-in link is incomplete. Please sign in again.');
    }

    if (key !== lastKey || !lastCompletion) {
      lastKey = key;
      lastCompletion = (async () => {
        const result = code
          ? await auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
          : await auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });
        if (result.error) {
          // Do not render callback URLs, tokens, or raw provider errors.
          throw new Error('This sign-in link could not be completed. Please sign in again.');
        }
        return true;
      })();
    }
    await lastCompletion;
    const { data, error } = await auth.getSession();
    if (error || !data.session) {
      throw new Error('Your sign-in session is unavailable. Please sign in again.');
    }
    return true;
  };
}
