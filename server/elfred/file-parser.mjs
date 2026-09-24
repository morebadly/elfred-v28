import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {fail} from './store.mjs';
const exec=promisify(execFile);
export async function parseFile(attachment){
 const data=attachment.data,ext=data.name.split('.').pop().toLowerCase(),bytes=Buffer.from(data.base64,'base64');
 if(['txt','md','csv','json'].includes(ext))return bytes.toString('utf8').slice(0,500000);
 if(['docx','pptx','xlsx'].includes(ext))return await new Promise((resolve,reject)=>{
   const child=execFile(process.env.ELFRED_PYTHON||'python',['-X','utf8',fileURLToPath(new URL('../../scripts/parse-office.py',import.meta.url))],{timeout:20000,maxBuffer:3000000,windowsHide:true},(error,stdout)=>{if(error){reject(new Error('Office 文件解析失败，文件可能已损坏或加密'));return;}try{resolve(JSON.parse(stdout).content);}catch{reject(new Error('Office 解析响应无效'));}});child.stdin.end(JSON.stringify({base64:data.base64}));
 });
 if(ext==='pdf'){
   const dir=await mkdtemp(path.join(tmpdir(),'elfred-parse-'));
   try{await writeFile(path.join(dir,'input.pdf'),bytes);await exec(process.env.ELFRED_PDFTOTEXT||'pdftotext',['-enc','UTF-8','-layout',path.join(dir,'input.pdf'),path.join(dir,'output.txt')],{timeout:20000,maxBuffer:1000000,windowsHide:true});return (await readFile(path.join(dir,'output.txt'),'utf8')).slice(0,500000);}finally{const target=path.resolve(dir),root=path.resolve(tmpdir())+path.sep;if(target.startsWith(root)&&path.basename(target).startsWith('elfred-parse-'))await rm(target,{recursive:true,force:true});}
 }
 fail('UNSUPPORTED_FORMAT','该文件需要图片识别或语音转写');
}
