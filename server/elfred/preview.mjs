import vm from 'node:vm';
import {fail} from './store.mjs';
import path from 'node:path';
export const PREVIEW_CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts";
export function renderWebArtifact(html,files={}){
 if(typeof html!=='string'||!html.trim()||html.length>200000)fail('INVALID_ARTIFACT','网页作品必须包含有效的 HTML 主文件');
 const resolve=(url,from='index.html')=>{if(!url||/^(?:[a-z]+:|\/|\\)/i.test(url)||/[?#\\]/.test(url))fail('EXTERNAL_DEPENDENCY','预览只加载项目内明确列出的相对文件');const name=path.posix.normalize(path.posix.join(path.posix.dirname(from),url));if(name==='..'||name.startsWith('../')||typeof files[name]!=='string')fail('MISSING_DEPENDENCY','缺少项目文件：'+name);return name;};
 const attribute=(attrs,key)=>attrs.match(new RegExp('\\b'+key+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'))?.slice(1).find(v=>v!==undefined);
 const cssCache=new Map();
 const css=(name,seen=new Set())=>{if(seen.has(name)||seen.size>20)fail('DEPENDENCY_CYCLE','样式依赖循环或层级过深');if(cssCache.has(name))return cssCache.get(name);const chain=new Set(seen).add(name);let size=files[name].length;if(size>200000)fail('INVALID_ARTIFACT','样式展开超过大小上限');const output=files[name].replace(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/gi,(match,url)=>{const child=css(resolve(url,name),chain);size+=child.length-match.length;if(size>200000)fail('INVALID_ARTIFACT','样式展开超过大小上限');return child;});cssCache.set(name,output);return output;};
 let expandedSize=html.length;const checked=(original,replacement)=>{expandedSize+=replacement.length-original.length;if(expandedSize>200000)fail('INVALID_ARTIFACT','项目文件展开超过大小上限');return replacement;};
 const output=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,(tag,attrs,body)=>{const src=attribute(attrs,'src');if(!src)return tag;const name=resolve(src);if(!/\.js$/i.test(name))fail('UNSUPPORTED_DEPENDENCY','脚本文件需为 JavaScript');if(body.trim())fail('INVALID_ARTIFACT','外部脚本标签不能同时包含内联正文');return checked(tag,`<script${attrs.replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,'')}>${files[name].replace(/<\/script/gi,'<\\/script')}</script>`);}).replace(/<link\b([^>]*)\/?\s*>/gi,(tag,attrs)=>{if(attribute(attrs,'rel')?.toLowerCase()!=='stylesheet')return tag;const href=attribute(attrs,'href'),name=resolve(href);if(!/\.css$/i.test(name))fail('UNSUPPORTED_DEPENDENCY','样式文件需为 CSS');return checked(tag,`<style>${css(name).replace(/<\/style/gi,'<\\/style')}</style>`);});
 if(output.length>1000000)fail('INVALID_ARTIFACT','打包后的页面超过预览大小上限');return output;
}
export function validateWebArtifact(source,files={}){
 const html=renderWebArtifact(source,files);
 if(typeof html!=='string'||!html.trim()||html.length>200000)fail('INVALID_ARTIFACT','网页作品必须是 1—200000 字的单文件 HTML');
 if(!/<(?:html|body|div|main|section|h[1-6]|button|p)\b/i.test(html))fail('INVALID_ARTIFACT','没有可预览的 HTML 内容');
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
   if(/\bsrc\s*=|\btype\s*=\s*["']?module/i.test(match[1]))fail('EXTERNAL_DEPENDENCY','请将脚本打包到页面内，不依赖外部模块');
   if(/type\s*=\s*["']application\/json/i.test(match[1]))continue;
   try{new vm.Script(match[2]);}catch{fail('BUILD_FAILED','页面 JavaScript 存在语法错误，请修复后发布');}
 }
 return {status:'passed',checks:['html-present','inline-script-syntax','isolated-browser-sandbox'],runtime:'browser-html-css-js'};
}
