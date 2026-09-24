import {fail,DomainError,id} from './store.mjs';
export class EmbeddingProvider {
 constructor(config=process.env,fetcher=fetch){this.fetcher=fetcher;const nativeBase=!config.ELFRED_MODEL_BASE_URL||/^https:\/\/api\.openai\.com\/v1\/?$/.test(config.ELFRED_MODEL_BASE_URL);this.key=config.ELFRED_EMBEDDING_API_KEY||(nativeBase?(config.ELFRED_MODEL_API_KEY||config.OPENAI_API_KEY):null);this.base=config.ELFRED_EMBEDDING_BASE_URL||config.ELFRED_MODEL_BASE_URL||'https://api.openai.com/v1';this.model=config.ELFRED_EMBEDDING_MODEL||'text-embedding-3-small';}
 status(){return {configured:Boolean(this.key),model:this.model};}
 async embed({input,maxTokens,signal}){
  if(!this.key)fail('PROVIDER_NOT_CONFIGURED','语义检索模型尚未配置，可继续使用基础检索',503);
  const base=new URL(this.base);if(base.username||base.password||base.search||base.hash||base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname)))fail('PROVIDER_CONFIG_INVALID','向量服务地址需为 HTTPS 或本机服务',503);
  if(!Array.isArray(input)||input.length<1||input.length>11||input.some(s=>typeof s!=='string'||!s.trim()||Buffer.byteLength(s,'utf8')>8000))fail('INVALID_EMBEDDING_INPUT','语义检索输入不符合本次大小限制');
  if(input.reduce((n,s)=>n+Buffer.byteLength(s,'utf8'),512)>maxTokens)fail('CONTEXT_BUDGET_EXCEEDED','剩余文本预算不足以核对下一批资料',409);
  const requestId=id();let response;try{response=await this.fetcher(base.href.replace(/\/$/,'')+'/embeddings',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.key}`,'X-Request-ID':requestId},body:JSON.stringify({model:this.model,input,encoding_format:'float'}),signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(45000)])});}catch{if(signal?.aborted)fail('CANCELLED','语义检索已停止',409);fail('PROVIDER_UNAVAILABLE','向量服务连接失败，保留已完成范围，不自动重放',503);}
  if(!response.ok)fail('PROVIDER_HTTP_ERROR',`向量服务返回 HTTP ${response.status}，未自动重放`,503);
  const raw=await response.text();if(raw.length>2000000)fail('PROVIDER_INVALID_OUTPUT','向量响应超过大小上限',502);let result;try{result=JSON.parse(raw)}catch{fail('PROVIDER_INVALID_OUTPUT','向量响应格式错误',502);}
  const usage=result.usage;if(!usage||!Number.isSafeInteger(usage.total_tokens)||usage.total_tokens<0)fail('PROVIDER_USAGE_UNKNOWN','向量服务未返回可核对用量',502);
  if(usage.total_tokens>maxTokens){const e=new DomainError('TOKEN_BUDGET_EXCEEDED','向量服务报告用量超过本次上限，已停止后续批次',409);e.usage=usage;throw e;}
  if(!Array.isArray(result.data)||result.data.length!==input.length)fail('PROVIDER_INVALID_OUTPUT','向量数量与输入不一致',502);
  const sorted=[...result.data].sort((a,b)=>a.index-b.index),size=sorted[0]?.embedding?.length;
  if(!Number.isInteger(size)||size<1||size>4096||sorted.some((r,i)=>r.index!==i||!Array.isArray(r.embedding)||r.embedding.length!==size||r.embedding.some(v=>!Number.isFinite(v))||!r.embedding.some(v=>v!==0)))fail('PROVIDER_INVALID_OUTPUT','向量维度、顺序或数值不合法',502);
  return {vectors:sorted.map(r=>r.embedding),usage,model:this.model,provider:'embedding-compatible',provider_operation_id:requestId};
 }
}
export function cosine(a,b){let ab=0,aa=0,bb=0;for(let i=0;i<a.length;i++){ab+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?ab/Math.sqrt(aa*bb):0;}
