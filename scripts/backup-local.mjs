import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.resolve(process.env.ELFRED_DATA_DIR||path.join(root,'.elfred-data'));
const destination=path.resolve(process.argv[2]||path.join(data,'backups','elfred-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite'));
mkdirSync(path.dirname(destination),{recursive:true});
const db=new DatabaseSync(path.join(data,'elfred.sqlite'),{readOnly:true});
try{db.exec("VACUUM INTO '"+destination.replaceAll("'","''")+"'");console.log('已创建一致性快照：'+destination);}finally{db.close();}
const verify=new DatabaseSync(destination,{readOnly:true});try{if(verify.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('备份完整性校验失败');console.log('SQLite integrity_check: ok');}finally{verify.close();}
