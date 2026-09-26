import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {Store,id} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {ModelProvider} from '../../server/elfred/providers.mjs';
import {apiHandler} from '../../server/elfred/http.mjs';
import {parseFile} from '../../server/elfred/file-parser.mjs';
test('真实 HTTP 附件、私有沙箱预览、消息游标及持续事件通知',async t=>{
 const store=new Store(':memory:'),service=new Service(store,new ModelProvider({}));let handler;
 const server=createServer((req,res)=>void handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;handler=apiHandler(service,{origin});
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));store.close()});
 const req=(client,path,body)=>fetch(origin+'/api/elfred'+path,{method:body===undefined?'GET':'POST',headers:{...(client?{Cookie:client.cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json',Origin:origin,'X-Elfred-Client':'1','X-CSRF-Token':client?.csrf||'','Idempotency-Key':id()})},body:body===undefined?undefined:JSON.stringify(body)});
 const account=async handle=>{const r=await req(null,'/auth/register',{handle,name:handle,password:'isolated-test-password'}),data=await r.json();return {cookie:r.headers.get('set-cookie').split(';')[0],csrf:data.csrf,id:data.user.id}};
 const a=await account('media_alice'),b=await account('media_bob'),cmd=(u,action,input)=>service.command(u.id,id(),action,input),ref=o=>({id:o.id,version:store.get(o.id).version});
 const upload=await req(a,'/commands',{action:'attachment.upload',input:{name:'large.txt',base64:Buffer.alloc(1200000,65).toString('base64')}});assert.equal(upload.status,200);const file=await upload.json();
 assert.equal((await req(b,'/attachments/'+file.id)).status,404);const download=await req(a,'/attachments/'+file.id);assert.equal((await download.text()).length,1200000);assert.match(download.headers.get('content-disposition'),/attachment/);
 const parse=await req(a,'/attachment-parse',{id:file.id});assert.equal(parse.status,200);const doc=await parse.json();assert.equal(store.get(doc.id).data.content.length,500000);
 const tool=cmd(a,'tool.save',{kind:'Mini App',title:'计数器',instructions:'点击增加',html:'<button id="b">0</button><script>let n=0;b.onclick=()=>b.textContent=++n</script>'}),version=store.get(tool.id).data.version_id;
 const preview=await req(a,'/preview/'+version);assert.equal(preview.status,200);assert.match(preview.headers.get('content-security-policy'),/connect-src 'none'/);assert.match(preview.headers.get('content-security-policy'),/sandbox allow-scripts/);assert.equal((await req(b,'/preview/'+version)).status,404);
 const friend=cmd(a,'friend.request',{handle:'media_bob'}),accepted=cmd(b,'friend.respond',{...ref(friend),decision:'accept'}),conversation=accepted.conversation_id;
 for(let i=1;i<=7;i++)cmd(a,'message.send',{id:conversation,text:'消息 '+i});
 const first=await (await req(b,`/conversations/${conversation}/messages?limit=3`)).json();assert.deepEqual(first.items.map(m=>m.data.seq),[5,6,7]);assert.equal(first.has_more,true);
 const next=await (await req(b,`/conversations/${conversation}/messages?limit=3&before=${first.next_before}`)).json();assert.deepEqual(next.items.map(m=>m.data.seq),[2,3,4]);
 const controller=new AbortController(),cursor=store.db.prepare('SELECT MAX(seq) AS n FROM events').get().n;
 const events=await fetch(origin+`/api/elfred/events?after=${cursor}`,{headers:{Cookie:b.cookie,Accept:'text/event-stream'},signal:controller.signal});const reader=events.body.getReader();await reader.read();
 const sent=cmd(a,'message.send',{id:conversation,text:'实时消息'});let output='';const timeout=setTimeout(()=>controller.abort(),6000);
 try{while(!output.includes(sent.id)){const item=await reader.read();if(item.done)break;output+=new TextDecoder().decode(item.value);}assert.match(output,new RegExp(sent.id));}finally{clearTimeout(timeout);controller.abort();await reader.cancel().catch(()=>{})}
});
test('Office 实际解析保留中文与表格单元格引用',async()=>{
 const script="import io,zipfile,base64; b=io.BytesIO(); z=zipfile.ZipFile(b,'w'); z.writestr('xl/sharedStrings.xml','<sst><si><t>共创项目</t></si></sst>'); z.writestr('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r=\"A1\" t=\"s\"><v>0</v></c><c r=\"B1\"><v>42</v></c></row></sheetData></worksheet>'); z.close(); print(base64.b64encode(b.getvalue()).decode())";
 const base64=execFileSync(process.env.ELFRED_PYTHON||(process.platform==='win32'?'python':'python3'),['-X','utf8','-c',script],{encoding:'utf8',windowsHide:true}).trim();
 const output=await parseFile({data:{name:'项目.xlsx',base64}});assert.match(output,/A1: 共创项目/);assert.match(output,/B1: 42/);
});
