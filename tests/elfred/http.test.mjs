import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';
import {Store,id} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {ModelProvider} from '../../server/elfred/providers.mjs';
import {apiHandler} from '../../server/elfred/http.mjs';

test('HTTP会话、CSRF、双用户权限、幂等与撤权后的读取',async t=>{
  const store=new Store(':memory:'),service=new Service(store,new ModelProvider({}));let handler;
  const server=createServer((req,res)=>void handler(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;handler=apiHandler(service,{origin});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close()});
  const request=async(client,path,body,headers={})=>{const response=await fetch(origin+'/api/elfred'+path,{method:body===undefined?'GET':'POST',headers:{...client?.cookie?{Cookie:client.cookie}:{},...body!==undefined?{'Content-Type':'application/json',Origin:origin,'X-Elfred-Client':'1','X-CSRF-Token':client?.csrf||'','Idempotency-Key':id()}:{},...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json(),headers:response.headers}};
  const account=async handle=>{const result=await request(null,'/auth/register',{handle,name:handle,password:'isolated-http-test-password'});assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);return {cookie:result.headers.get('set-cookie').split(';')[0],csrf:result.data.csrf,user:result.data.user}};
  const alice=await account('http_alice'),bob=await account('http_bob');
  const payload={action:'knowledge.create',input:{title:'HTTP私有记录',content:'仅 Alice 可读'}};
  assert.equal((await request(alice,'/commands',payload,{Origin:'https://untrusted.invalid'})).status,403);
  assert.equal((await request(alice,'/commands',payload,{'X-CSRF-Token':'invalid'})).status,403);
  const invalidHost=await new Promise((resolve,reject)=>{const req=httpRequest(origin+'/api/elfred/bootstrap',{headers:{Host:'evil.invalid',Cookie:alice.cookie}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode))});req.on('error',reject);req.end()});assert.equal(invalidHost,403);
  const key=id(),created=await request(alice,'/commands',payload,{'Idempotency-Key':key});assert.equal(created.status,200);
  const replay=await request(alice,'/commands',payload,{'Idempotency-Key':key});assert.deepEqual(replay.data,created.data);
  assert.equal((await request(bob,'/objects/'+created.data.id)).status,404);
  const exported=await request(bob,'/export');assert.equal(exported.data.objects.knowledge.length,0);
  const search=await request(alice,'/search',{query:'HTTP'});assert.equal(search.data.hits[0].id,created.data.id);
  const logout=await request(alice,'/auth/logout',{});assert.equal(logout.status,200);assert.equal((await request(alice,'/bootstrap')).status,401);
  assert.equal((await request(alice,'/session')).data.user,null);
});
