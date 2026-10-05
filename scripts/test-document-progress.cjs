const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const plan=JSON.parse(fs.readFileSync('data/chronologicalBiblePlan.json'));
function fixture(entries={},cloud={}) {
 const storage=new Map(Object.entries(entries).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)])),writes=[];
 const asyncStorage={getItem:async k=>storage.get(k)??null,setItem:async(k,v)=>storage.set(k,v),multiSet:async rows=>rows.forEach(([k,v])=>storage.set(k,v)),removeItem:async k=>storage.delete(k)};
 const db={from:()=>{const filters={};return {select(){return this},eq(k,v){filters[k]=v;return this},maybeSingle:async()=>({data:cloud[filters.user_id+':'+filters.plan_id]??null}),upsert:async row=>{assert.equal(row.plan_id,plan.planId);writes.push(row);cloud[row.user_id+':'+row.plan_id]={...row};return {error:null}}}}};
 const cache={};function load(path){if(cache[path])return cache[path];const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:name=>name==='@react-native-async-storage/async-storage'?asyncStorage:name==='@/lib/supabase'?{supabase:db}:name.startsWith('@/data/')?{chronologicalDocumentMigration:plan.migration,chronologicalPlanMeta:{...plan,...plan.migration.legacy,notesPlanId:'chronological-bible-order-v3',previousPlanId:'chronological-bible-order-v3',taskLegacyPlanId:'chronological-bible-order-v2',originalLegacyPlanId:'chronological-bible-order-v1'}}:load(name.replace('@/','')+'.ts'),Date,console});return cache[path]=module.exports;}
 return {api:load('lib/chronologicalProgress.ts'),storage,writes,cloud};
}
(async()=>{
 const old='tryjesus_chronological_plan_progress_v4',next='tryjesus_chronological_plan_progress_v5';
 const row={completed:[0,1],lastIndex:0,updatedAt:'2026-10-01T00:00:00Z'};
 const core=fixture().api;assert.ok(core);
 // Derive the established scoped-key format from the existing core, not guesses.
 const source=ts.transpileModule(fs.readFileSync('lib/chronologicalProgressCore.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(source,{exports,Date});const {guestProgressKey:g,accountProgressKey:a}=exports;
 let f=fixture({[g(old)]:row});let r=await f.api.loadChronologicalProgress();assert.deepEqual([...r.completed],[0,1]);assert.ok(f.storage.has(g(old)));assert.ok(f.storage.has(g(next)));
 // A detached guest snapshot can reconnect only to its original account.
 f=fixture({[g(old)]:row,[g(old)+':link-target']:'A'});r=await f.api.loadChronologicalProgress('B');assert.deepEqual([...r.completed],[]);assert.equal(f.storage.get(g(next)+':link-target'),'A');
 // Old per-account data is available offline, without being imported to another account.
 f=fixture({[a(old,'A')]:row});r=await f.api.loadLocalChronologicalProgress('A');assert.deepEqual([...r.completed],[0,1]);r=await f.api.loadLocalChronologicalProgress('B');assert.deepEqual([...r.completed],[]);
 // Existing website v5 progress wins over newer timestamps in old-version app data.
 f=fixture({[a(old,'A')]:{...row,updatedAt:'2030-01-01T00:00:00Z'}},{['A:'+plan.planId]:{completed_indices:[7],last_index:2,updated_at:'2026-10-05T00:00:00Z'}});r=await f.api.loadChronologicalProgress('A');assert.deepEqual([...r.completed],[7]);
 // Old cloud migration never mutates or deletes the legacy row.
 const oldCloud={completed_indices:[0,1],last_index:0,updated_at:'2026-10-01T00:00:00Z'};
 f=fixture({}, {'A:chronological-bible-order-v4':oldCloud});r=await f.api.loadChronologicalProgress('A');assert.deepEqual([...r.completed],[0,1]);assert.deepEqual(f.cloud['A:chronological-bible-order-v4'],oldCloud);
 assert.ok(f.writes.every(w=>w.plan_id===plan.planId));
 console.log('Guest, account, detached-account isolation, old cloud migration, website precedence, and preserved legacy rows passed.');
})().catch(e=>{console.error(e);process.exit(1)});
