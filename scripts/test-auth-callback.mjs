import assert from 'node:assert/strict';
const { createAuthCallbackHandler } = await import(new URL('../lib/authCallback.ts', import.meta.url));
const calls=[];
let session = null;
const auth = {
  getSession: async () => ({data:{session},error:null}),
  exchangeCodeForSession: async (code, options) => {
    calls.push({code,options});
    await new Promise(resolve => setTimeout(resolve, 10));
    if (code === 'expired') return {error:new Error('provider response')};
    session = {user:{id:code}};
    return {error:null};
  },
  setSession: async tokens => {calls.push(tokens); session={user:{id:'implicit'}}; return {error:null};}
};
const complete = createAuthCallbackHandler(auth);
const url = 'tryjesusjourney://auth/callback?code=first&sb_flow_id=flow';
assert.deepEqual(await Promise.all([complete(url),complete(url)]),[true,true]);
assert.equal(calls.length,1,'Router and browser must exchange the code exactly once');
assert.deepEqual(calls[0],{code:'first',options:{flowId:'flow'}});
assert.equal(await complete(url),true);
assert.equal(calls.length,1,'A late route mount must reuse successful completion');
assert.equal(await complete('bibleandconflict://auth/callback?code=second'),true);
assert.equal(session.user.id,'second','An existing session must not skip a different callback');
await assert.rejects(complete('tryjesusjourney://auth/callback?code=expired'),/could not be completed/);
await assert.rejects(complete('tryjesusjourney://auth/callback?error=denied&error_description=private-provider-details'),error=>!error.message.includes('private-provider-details'));
await assert.rejects(complete('tryjesusjourney://auth/callback'),/incomplete/);
assert.equal(await complete('tryjesusjourney://auth/callback#access_token=test-access&refresh_token=test-refresh'),true);
assert.deepEqual(calls.at(-1),{access_token:'test-access',refresh_token:'test-refresh'});
session=null;
await assert.rejects(complete('tryjesusjourney://auth/callback#access_token=test-access&refresh_token=test-refresh'),/session is unavailable/);
console.log('Callback tests passed: concurrent and late delivery, account switch, PKCE flow, errors, implicit tokens, and signed-out replay.');
