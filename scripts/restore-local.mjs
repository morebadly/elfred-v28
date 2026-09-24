import {DatabaseSync} from 'node:sqlite';
import {copyFileSync,existsSync,readFileSync,renameSync,mkdirSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.resolve(process.env.ELFRED_DATA_DIR||path.join(root,'.elfred-data'));
if(!process.argv[2]||!process.argv.includes('--confirm'))throw Error('先停止本地服务，再执行 node scripts/restore-local.mjs <备份文件> --confirm。当前数据库会保留为恢复前副本。');
const source=path.resolve(process.argv[2]),target=path.join(data,'elfred.sqlite');
if(source===target)throw Error('备份和目标不能相同');
const lock=path.join(data,'server.pid');
if(existsSync(lock)){const pid=Number(readFileSync(lock,'utf8'));if(Number.isInteger(pid)){let live=false;try{process.kill(pid,0);live=true}catch{}if(live)throw Error('本地服务仍在运行，请先正常停止');}}
const verify=new DatabaseSync(source,{readOnly:true});try{if(verify.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('备份损坏');verify.prepare('SELECT count(*) FROM users').get();if(verify.prepare('PRAGMA user_version').get().user_version!==1)throw Error('不支持该备份版本');}finally{verify.close();}
const saved=target+'.before-restore-'+Date.now();
mkdirSync(data,{recursive:true});
// The old main database and WAL are retained together; no user data is deleted.
if(existsSync(target))renameSync(target,saved);
for(const suffix of ['-wal','-shm'])if(existsSync(target+suffix))renameSync(target+suffix,saved+suffix);
try{copyFileSync(source,target);}catch(error){if(existsSync(target))unlinkSync(target);for(const suffix of ['','-wal','-shm'])if(existsSync(saved+suffix))renameSync(saved+suffix,target+suffix);throw error;}
console.log('恢复完成。恢复前数据库保留于：'+saved);
