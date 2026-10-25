const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const calls = [];
let platform = 'ios';
let cancelled = false;
let apiError = null;
const auth = new Proxy({}, { get: (_, name) => async (...args) => {
  calls.push({name, args});
  return { data: { url: 'https://example.com/auth', session: null }, error: apiError };
} });
const mocks = {
  'react-native': { Platform: { get OS() { return platform; } } },
  'expo-auth-session': { makeRedirectUri: () => 'tryjesusjourney://auth/callback' },
  'expo-web-browser': { maybeCompleteAuthSession() {}, openAuthSessionAsync: async () => ({type:'cancel'}) },
  '@/lib/supabase': { supabase: { auth } },
  '@/lib/authCallback': { createAuthCallbackHandler: () => async () => true },
  'expo-crypto': { randomUUID: () => 'random-raw-nonce', CryptoDigestAlgorithm:{SHA256:'sha256'}, digestStringAsync: async (algorithm, raw) => { assert.equal(raw, 'random-raw-nonce'); return 'hashed-nonce'; } },
  'expo-apple-authentication': { isAvailableAsync: async () => true, AppleAuthenticationScope: {FULL_NAME:0, EMAIL:1}, signInAsync: async request => {
    assert.equal(request.nonce, 'hashed-nonce');
    if (cancelled) throw {code:'ERR_REQUEST_CANCELED'};
    return {identityToken:'apple-token',fullName:{givenName:'Test',familyName:'Reader'}};
  } },
};
const moduleObject = {exports:{}};
const compiled = ts.transpileModule(fs.readFileSync('lib/auth.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(compiled, {exports:moduleObject.exports,require:name => {assert.ok(mocks[name],name);return mocks[name];},URL,URLSearchParams});
const api = moduleObject.exports;
(async () => {
  await api.signInWithApple();
  const native = calls.find(c => c.name === 'signInWithIdToken');
  assert.equal(native.args[0].nonce,'random-raw-nonce');
  assert.equal(native.args[0].token,'apple-token');
  calls.length=0;
  await api.signInWithApple(true);
  assert.equal(calls[0].name,'linkIdentity','Connecting Apple must link the current account rather than sign into another');
  cancelled=true; calls.length=0;
  assert.equal(await api.signInWithApple(),false);
  assert.equal(calls.length,0,'Cancel must not create a server session');
  cancelled=false; platform='android'; calls.length=0;
  await api.signInWithApple(); assert.equal(calls[0].name,'signInWithOAuth'); assert.equal(calls[0].args[0].provider,'apple');
  calls.length=0; await api.signInWithEmail(' reader@example.com ','secret');
  assert.equal(calls[0].args[0].email,'reader@example.com');
  calls.length=0; assert.equal(await api.registerWithEmail('reader@example.com','long-password'),false,'Unconfirmed signup must not pretend to be signed in');
  assert.equal(calls[0].args[0].options.emailRedirectTo,'tryjesusjourney://auth/callback');
  calls.length=0; await api.requestPasswordReset('reader@example.com');
  assert.equal(calls[0].args[1].redirectTo,'tryjesusjourney://auth/callback?next=recovery');
  apiError=new Error('invalid credentials'); await assert.rejects(api.signInWithEmail('reader@example.com','wrong'));
  console.log('Auth method tests passed: Apple nonce, cancellation, identity linking, fallback, email confirmation, reset routing and error propagation.');
})().catch(error => { console.error(error); process.exitCode=1; });
