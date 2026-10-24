import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { loadConversationModule } from './conversation-module.mjs';
const transcript = await loadConversationModule('conversation/transcript');
const configSource = readFileSync(new URL('../../src/types/config.ts', import.meta.url), 'utf8')
  .replace("from 'zod'", `from '${import.meta.resolve('zod')}'`);
const configJs = ts.transpileModule(configSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const config = await import(`data:text/javascript;base64,${Buffer.from(configJs).toString('base64')}`);
export function mountConversationView(props) {
 const slots=[],effects=[],copied=[]; let cursor=0,dirty=false,tree;
 const changed=(a,b)=>!a||!b||b.some((v,i)=>!Object.is(v,a[i]));
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
 useState(initial){const i=cursor++; if(!(i in slots)) slots[i]=typeof initial==='function'?initial():initial; return [slots[i],next=>{const v=typeof next==='function'?next(slots[i]):next;if(!Object.is(v,slots[i])){slots[i]=v;dirty=true;}}];},
 useRef:v=>slots[cursor++]??={current:v},
 useMemo(fn,deps){const i=cursor++;if(changed(slots[i]?.deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},
 useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
 useEffect(fn,deps){const i=cursor++;if(changed(slots[i]?.deps,deps))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
 };react.useLayoutEffect=react.useEffect;
 const load=path=>{const exports={};const js=ts.transpileModule(readFileSync(new URL('../../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;vm.runInNewContext(js,{exports,console,window:{addEventListener(){},removeEventListener(){},getSelection:()=>null},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},require:name=>{
 if(name==='react')return {...react,default:react};
 if(name==='@/conversation/transcript')return transcript;
 if(name==='@/lib/thinkingParser')return thinking;
 if(name==='@/lib/provider')return providerRules;
 if(name==='@/lib/links')return {collectLinksFromRoot:()=>[],linksEqual:()=>true};
 if(name==='@/lib/utils')return {cn:(...x)=>x.filter(Boolean).join(' ')};
 if(name==='@/hooks/useCopyFeedback')return {useCopyFeedback:()=>({copied:false,copy(text){copied.push(text);}})};
 if(name==='@/hooks/useTranslation')return {useTranslation:()=>({t:x=>x,resolvedLanguage:'en'})};
 if(name==='@/hooks/useChatSessions')return {useChatSessions:()=>props.chatSessions};
 if(name==='@/types/config')return config;
 if(name==='@tauri-apps/api/core')return {invoke:async()=>false};
 if(name.startsWith('@/components/')||name==='lucide-react')return new Proxy({},{get:(_,key)=>key});
 throw new Error(name);
 }});return exports;};
 const thinking=load('src/lib/thinkingParser.ts');
 const providerRules=load('src/lib/provider.ts');
 const {ResultCard}=load('src/components/overlay/ResultCard.tsx');
 function render(patch={}){props={...props,...patch};let n=0;do{dirty=false;cursor=0;tree=ResultCard(props);effects.splice(0).forEach(fn=>fn());assert.ok(++n<20,'render loop');}while(dirty);return tree;}
 render();return {render,copied,get tree(){return tree;}};
}
export function nodes(tree,type){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(x=>nodes(x,type));return [...(tree.type===type?[tree]:[]),...nodes(tree.props?.children,type)];}
