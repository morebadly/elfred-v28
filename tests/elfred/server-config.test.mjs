import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {serverConfig} from '../../server/elfred/server-config.mjs';
import {Store} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {ModelProvider} from '../../server/elfred/providers.mjs';
import {apiHandler} from '../../server/elfred/http.mjs';

test('服务器监听本机端口，公开来源必须是明确的 HTTP(S) 地址',()=>{
  assert.deepEqual(serverConfig({ELFRED_PORT:'3001'}),{port:3001,localOrigin:'http://127.0.0.1:3001',publicOrigin:'http://127.0.0.1:3001'});
  assert.equal(serverConfig({ELFRED_PUBLIC_ORIGIN:'https://elfred.example/'}).publicOrigin,'https://elfred.example');
  for(const value of ['https://user:secret@elfred.example','https://elfred.example/v28','https://elfred.example/?x=1','https://elfred.example/#x','file:///tmp/site'])
    assert.throws(()=>serverConfig({ELFRED_PUBLIC_ORIGIN:value}));
  assert.throws(()=>serverConfig({ELFRED_PORT:'80'}));
});

test('反向代理保留公开 Host 后 HTTPS 登录可用，外部来源仍被拒绝',async t=>{
  const store=new Store(':memory:'),service=new Service(store,new ModelProvider({}));
  const origin='https://elfred.example';
  const handler=apiHandler(service,{origin});
  const server=createServer((req,res)=>void handler(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close()});
  const address=`http://127.0.0.1:${server.address().port}`;
  const register=headers=>new Promise((resolve,reject)=>{
    const req=request(address+'/api/elfred/auth/register',{method:'POST',headers:{Host:'elfred.example',Origin:origin,'Content-Type':'application/json','X-Elfred-Client':'1',...headers}},res=>{
      let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,data:JSON.parse(body)}));
    });
    req.on('error',reject);req.end(JSON.stringify({handle:'server_origin_test',name:'Server',password:'isolated-server-test-password'}));
  });
  assert.equal((await register({Origin:'https://other.example'})).status,403);
  assert.equal((await register({Host:'127.0.0.1'})).status,403);
  const response=await register({});
  assert.equal(response.status,200);
  assert.match(response.headers['set-cookie'][0],/; Secure/);
  const account=response.data;
  const profile=service.list(account.user.id,'profile')[0];
  service.command(account.user.id,'profile-media-test','profile.save',{id:profile.id,version:profile.version,name:'路人',bio:'已保存',tags:['产品'],avatar:'data:image/png;base64,iVBORw0KGgo=',cover:'data:image/png;base64,iVBORw0KGgo=',showLevel:false});
  const saved=service.list(account.user.id,'profile')[0];
  assert.equal(saved.data.showLevel,false);
  assert.equal(saved.data.bio,'已保存');
  assert.equal(saved.data.avatar,'data:image/png;base64,iVBORw0KGgo=');
});
