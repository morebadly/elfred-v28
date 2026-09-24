import {fail,hash} from './store.mjs';
import {taskCommand} from './runtime.mjs';
import {string} from './policy.mjs';
export function attachmentCommand(store,user,action,input){
 if(action==='attachment.analyze'){
  const file=store.read(user,input.id,'attachment');
  if(!/^(image|audio)\//.test(file.data.mime))fail('UNSUPPORTED_FORMAT','请选择图片或音频');
  const task=taskCommand(store,user,'task.create',{goal:file.data.mime.startsWith('audio/')?'将这段音频准确转写为文字，保留说话内容。':'识别图片中的文字并按原结构整理，标出无法辨认处。',mode:'compose',system:'explore',source_refs:[{id:file.id,version:file.version}]});
  const item=store.get(task.id);store.update(item,{...item.data,media_operation:file.data.mime.startsWith('audio/')?'transcribe':'vision'},user);return {id:task.id,task_id:task.id};
 }
 if(action!=='attachment.upload')return null;
 const name=string(input.name,'文件名',180).replace(/[\\/\r\n]/g,'_');
 if(typeof input.base64!=='string'||input.base64.length>11200000||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64))fail('INVALID_FILE','附件格式错误或超过 8 MB');
 const bytes=Buffer.from(input.base64,'base64');if(!bytes.length||bytes.length>8*1024*1024)fail('FILE_TOO_LARGE','附件需在 1 字节至 8 MB 之间');
 const ext=name.split('.').pop().toLowerCase();
 const allowed={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'video/mp4',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm',pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain',md:'text/plain',csv:'text/csv',json:'application/json',zip:'application/zip'};
 const mime=allowed[ext];if(!mime)fail('UNSUPPORTED_FORMAT','支持图片、音频、PDF、Office、文本与 ZIP 文件');
 if(mime==='image/png'&&bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||mime==='image/jpeg'&&bytes.subarray(0,3).toString('hex')!=='ffd8ff'||mime==='image/webp'&&(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP'))fail('INVALID_IMAGE','图片内容与格式不符');
 if(mime==='video/mp4'&&(bytes.length<12||bytes.subarray(4,8).toString()!=='ftyp'))fail('INVALID_FILE','视频内容与 MP4 格式不符');
 let space=null;if(input.conversation_id){const conversation=store.read(user,input.conversation_id,'conversation');if(!store.role(conversation.id,user))fail('FORBIDDEN','当前不在会话中',403);space=conversation.id;}
 return {id:store.add('attachment',user,{name,mime,size:bytes.length,base64:bytes.toString('base64'),digest:hash(bytes),access_space:space,status:'ready'}).id};
}
export function attachmentRefs(store,user,ids=[],conversationId){
 if(!Array.isArray(ids)||ids.length>6)fail('INVALID_INPUT','每次最多选择 6 个附件');
 return ids.map(id=>{const attachment=store.owned(user,id,'attachment');if(conversationId&&attachment.data.access_space!==conversationId)fail('INVALID_CONTEXT','附件不属于当前会话');if(!conversationId&&attachment.data.access_space)fail('INVALID_CONTEXT','会话附件不能直接公开，请明确重新上传');return {id:attachment.id,name:attachment.data.name,mime:attachment.data.mime,size:attachment.data.size};});
}
export function attachmentMetadata(item){const {base64,...data}=item.data;return {...item,data};}
