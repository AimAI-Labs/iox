use crate::config::{ActionConfig, AppConfig};
use base64::{engine::general_purpose::STANDARD, Engine};
use std::io::Read;
use std::path::Path;

pub const MAX_FILES: usize = 10;
pub const MAX_TOTAL_BYTES: u64 = 20 * 1024 * 1024;

pub fn enabled_web_action<'a>(config: &'a AppConfig, id: &str) -> Result<&'a ActionConfig, String> {
    config
        .actions
        .iter()
        .find(|a| a.id == id && a.enabled && a.action_type == "web")
        .ok_or_else(|| "请选择已启用的官网动作".to_string())
}

#[derive(serde::Serialize)]
pub struct Attachment {
    pub name: String,
    pub data: String,
}

/// Check every opened handle before reading; cap actual reads as files can grow after metadata.
pub fn read_attachments(paths: &[String]) -> Result<Vec<Attachment>, String> {
    if paths.is_empty() || paths.len() > MAX_FILES {
        return Err("每次请选择 1–10 个文件".into());
    }
    let mut opened = Vec::with_capacity(paths.len());
    let mut declared_total = 0u64;
    for path in paths {
        let file = std::fs::File::open(path).map_err(|_| "无法打开选中文件".to_string())?;
        let metadata = file
            .metadata()
            .map_err(|_| "无法读取文件信息".to_string())?;
        if !metadata.is_file() {
            return Err("仅支持普通文件，不支持文件夹".into());
        }
        declared_total = declared_total
            .checked_add(metadata.len())
            .ok_or("文件总大小超出限制")?;
        if declared_total > MAX_TOTAL_BYTES {
            return Err("文件总大小不能超过 20 MiB".into());
        }
        let name = Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("文件名无效")?
            .to_string();
        opened.push((name, file));
    }
    let mut total = 0u64;
    let mut attachments = Vec::with_capacity(opened.len());
    for (name, file) in opened {
        let mut bytes = Vec::new();
        file.take(MAX_TOTAL_BYTES - total + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "读取文件失败".to_string())?;
        total += bytes.len() as u64;
        if total > MAX_TOTAL_BYTES {
            return Err("文件总大小不能超过 20 MiB".into());
        }
        attachments.push(Attachment {
            name,
            data: STANDARD.encode(bytes),
        });
    }
    Ok(attachments)
}

pub fn is_attachment_destination(url: &tauri::Url, origin: &str) -> bool {
    url.origin().ascii_serialization() == origin
        && !url.path_segments().into_iter().flatten().any(|part| {
            matches!(
                part.to_ascii_lowercase().as_str(),
                "login"
                    | "signin"
                    | "sign-in"
                    | "auth"
                    | "oauth"
                    | "passport"
                    | "signup"
                    | "register"
            )
        })
}

pub fn build_attachment_script(origin: &str, files: &[Attachment], request_id: &str, theme: &str) -> String {
    let origin = serde_json::to_string(origin).unwrap();
    let files = serde_json::to_string(files).unwrap();
    let id = serde_json::to_string(request_id).unwrap();
    let theme = serde_json::to_string(theme).unwrap();
    format!("(()=>{{const expectedOrigin={origin};if(window.top!==window||location.origin!==expectedOrigin||location.pathname.split('/').some(part=>['login','signin','sign-in','auth','oauth','passport','signup','register'].includes(part.toLowerCase())))return;const requestId={id},toastTheme={theme};\n{}\n{}\n}})();", super::scripts::WEB_TOAST_SCRIPT, ATTACHMENT_SCRIPT.replace("__FILES__", &files))
}

const ATTACHMENT_SCRIPT: &str = r#"
const requests=window.__ioxAttachmentRequests||(window.__ioxAttachmentRequests=new Set());
if(requests.has(requestId))return;
requests.add(requestId);
// Keep only small request identifiers; never keep file content in global state.
if(requests.size>100)requests.delete(requests.values().next().value);
let payload=__FILES__, timer=null, finished=false;
const deadline=Date.now()+60000;
const epoch=window.__iox_injection_epoch||0;
let panel=null, statusType=null;
function status(type,title,description){
 if(!document.body)return;
 if(statusType===type)return;
 if(!panel)panel=createIoxToast({theme:toastTheme,onDismiss:cleanup});
 statusType=type;
 panel.update({type,title,description,duration:type==='loading'?0:3500});
}
function cleanup(){finished=true;payload=[];if(timer!==null)clearInterval(timer);window.removeEventListener('pagehide',cleanup)}
window.addEventListener('pagehide',cleanup,{once:true});
const types={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',bmp:'image/bmp',txt:'text/plain',md:'text/markdown',csv:'text/csv',json:'application/json',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',zip:'application/zip'};
function mime(name){return types[name.split('.').pop().toLowerCase()]||'application/octet-stream'}
function accepts(input,file){
 const accept=(input.accept||'').trim().toLowerCase();if(!accept)return true;
 const type=mime(file.name), name=file.name.toLowerCase();
 return accept.split(',').some(rule=>{rule=rule.trim();return rule.startsWith('.')?name.endsWith(rule):rule.endsWith('/*')?type.startsWith(rule.slice(0,-1)):type===rule});
}
function attempt(){
 if(finished)return;
 if((window.__iox_injection_epoch||0)!==epoch){cleanup();panel?.dismiss();return}
 if(window.top!==window||location.origin!==expectedOrigin||location.pathname.split('/').some(part=>['login','signin','sign-in','auth','oauth','passport','signup','register'].includes(part.toLowerCase()))){status('error','附件已停止','页面已改变或需要登录，本次已停止。请返回官网后重新选择文件。');cleanup();return}
 if(Date.now()>=deadline){status('error','未找到附件入口','请登录后点击网站附件按钮，或手动选择文件；本次已停止。');cleanup();return}
 const input=Array.from(document.querySelectorAll('input[type="file"]')).find(el=>!el.disabled&&(payload.length===1||el.multiple)&&payload.every(file=>accepts(el,file)));
 if(!input){status('loading','正在等待附件入口','请先登录并点击网站附件按钮，最多等待 60 秒。仅添加文件，不自动发送；关闭提示可取消。');return}
 try{
  const transfer=new DataTransfer();
  for(const file of payload){const bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));transfer.items.add(new File([bytes],file.name,{type:mime(file.name)}))}
  input.files=transfer.files;
  if(input.files.length!==payload.length)throw new Error('incomplete file list');
  cleanup();
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  status('success','附件已交给网页','请确认网站中的附件及上传结果后手动发送。');
 }catch(_){status('error','网页未能接收附件','请使用网站附件按钮手动选择文件。');cleanup()}
}
attempt();if(!finished)timer=setInterval(attempt,500);
"#;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn destination_excludes_login_and_foreign_origins() {
        for url in [
            "https://example.com/login",
            "https://example.com/auth/signin",
            "https://login.example.com/",
            "https://example.com.evil.test/",
        ] {
            assert!(!is_attachment_destination(
                &url.parse().unwrap(),
                "https://example.com"
            ));
        }
        assert!(is_attachment_destination(
            &"https://example.com/chat".parse().unwrap(),
            "https://example.com"
        ));
    }

    #[test]
    fn rejects_non_web_disabled_and_missing_actions() {
        let mut config = AppConfig::default();
        assert!(enabled_web_action(&config, "missing").is_err());
        let mut action = config.actions[0].clone();
        action.id = "test".into();
        action.action_type = "web".into();
        action.enabled = true;
        config.actions.push(action);
        assert!(enabled_web_action(&config, "test").is_ok());
        config.actions.last_mut().unwrap().enabled = false;
        assert!(enabled_web_action(&config, "test").is_err());
        config.actions.last_mut().unwrap().enabled = true;
        config.actions.last_mut().unwrap().action_type = "api".into();
        assert!(enabled_web_action(&config, "test").is_err());
    }
    #[test]
    fn rejects_empty_excessive_missing_directory_and_oversized_files() {
        assert!(read_attachments(&[]).is_err());
        assert!(read_attachments(&vec!["absent".into(); 11]).is_err());
        assert!(read_attachments(&["absent-file".into()]).is_err());
        assert!(read_attachments(&[std::env::temp_dir().to_string_lossy().into_owned()]).is_err());
        let path = std::env::temp_dir().join(format!("iox-limit-{}", std::process::id()));
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(20 * 1024 * 1024 + 1).unwrap();
        assert!(read_attachments(&[path.to_string_lossy().into_owned()]).is_err());
        drop(file);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn reads_file_content_and_rejects_aggregate_size_before_reading() {
        let dir = std::env::temp_dir().join(format!("iox-attachment-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let first = dir.join("first.txt");
        let second = dir.join("second.txt");
        std::fs::write(&first, b"hi").unwrap();
        let attachments = read_attachments(&[first.to_string_lossy().into_owned()]).unwrap();
        assert_eq!(attachments[0].name, "first.txt");
        assert_eq!(attachments[0].data, "aGk=");
        let a = std::fs::File::create(&first).unwrap();
        let b = std::fs::File::create(&second).unwrap();
        a.set_len(11 * 1024 * 1024).unwrap();
        b.set_len(11 * 1024 * 1024).unwrap();
        assert!(read_attachments(&[
            first.to_string_lossy().into_owned(),
            second.to_string_lossy().into_owned()
        ])
        .is_err());
        drop((a, b));
        std::fs::remove_file(first).unwrap();
        std::fs::remove_file(second).unwrap();
        std::fs::remove_dir(dir).unwrap();
    }

    #[test]
    fn script_deduplicates_dispatch_and_never_touches_foreign_origin() {
        let name = "quote\"\\\n文件.txt";
        let script = build_attachment_script(
            "https://example.com",
            &[Attachment {
                name: name.into(),
                data: "aGk=".into(),
            }],
            "request-1",
            "system",
        );
        // Test the attachment lifecycle independently of the website toast DOM renderer.
        let script = script.replace(super::super::scripts::WEB_TOAST_SCRIPT, r#"
function createIoxToast(options) {
 const panel=document.createElement('div');document.body.appendChild(panel);
 return {update(status){panel.textContent=status.description;panel.dismiss=options.onDismiss},dismiss(){options.onDismiss();panel.remove()}};
}
"#);
        let harness = r#"
const vm = require('node:vm'), assert = require('node:assert/strict');
const script = SCRIPT;
function context(origin) {
 let changes = 0, timers = [], panel, events = {}, now=0;
 const input = {disabled:false,multiple:true,files:[],dispatchEvent(e){if(e.type==='change')changes++}};
 const doc = {body:{appendChild(v){panel=v}},createElement(){return {style:{},appendChild(){},remove(){},addEventListener(){}}},getElementById(){return panel},querySelectorAll(){return [input]}};
 const ctx = {document:doc,location:{origin,pathname:'/'},Date:{now:()=>now},Uint8Array,atob,Event,File:class {constructor(bytes,name){this.name=name;this.bytes=bytes}},DataTransfer:class {constructor(){this.files=[];this.items={add:f=>this.files.push(f)}}},setInterval(fn){timers.push(fn);return 1},clearInterval(){},setTimeout(){return 2},clearTimeout(){},addEventListener(name,fn){events[name]=fn},removeEventListener(name){delete events[name]}};
 ctx.window=ctx;ctx.top=ctx;vm.createContext(ctx);
 return {ctx,input,get changes(){return changes},get panel(){return panel},timers,events,advance(){now=60001}};
}
const safe=context('https://example.com');vm.runInContext(script,safe.ctx);vm.runInContext(script,safe.ctx);
assert.equal(safe.changes,1);assert.equal(safe.input.files[0].name,NAME);
const foreign=context('https://login.example.com');vm.runInContext(script,foreign.ctx);assert.equal(foreign.changes,0);
const frame=context('https://example.com');frame.ctx.top={};vm.runInContext(script,frame.ctx);assert.equal(frame.changes,0);
const pending=context('https://example.com');pending.input.accept='image/*';vm.runInContext(script,pending.ctx);assert.equal(pending.changes,0);assert.equal(pending.timers.length,1);
pending.input.accept='.txt';pending.timers[0]();assert.equal(pending.changes,1);pending.timers[0]();assert.equal(pending.changes,1);
vm.runInContext(script.replaceAll('request-1','request-2'),safe.ctx);assert.equal(safe.changes,2);
const timeout=context('https://example.com');timeout.input.disabled=true;vm.runInContext(script,timeout.ctx);timeout.advance();timeout.timers[0]();timeout.input.disabled=false;timeout.timers[0]();assert.equal(timeout.changes,0);
const navigation=context('https://example.com');navigation.input.disabled=true;vm.runInContext(script,navigation.ctx);navigation.events.pagehide();navigation.input.disabled=false;navigation.timers[0]();assert.equal(navigation.changes,0);
const spaLogin=context('https://example.com');spaLogin.input.disabled=true;vm.runInContext(script,spaLogin.ctx);spaLogin.ctx.location.pathname='/auth/login';spaLogin.input.disabled=false;spaLogin.timers[0]();assert.equal(spaLogin.changes,0);assert.match(spaLogin.panel.textContent,/本次已停止/);
const restored=context('https://example.com');restored.input.disabled=true;vm.runInContext(script,restored.ctx);restored.ctx.__iox_injection_epoch=1;restored.input.disabled=false;restored.timers[0]();assert.equal(restored.changes,0,'A new action or same-document session restore must cancel pending attachments');
const multi=context('https://example.com');multi.input.multiple=false;vm.runInContext(script.replace('let payload=[','let payload=[{name:"a.txt",data:"aGk="},'),multi.ctx);assert.equal(multi.changes,0);

"#;
        let harness = harness
            .replace("SCRIPT", &serde_json::to_string(&script).unwrap())
            .replace("NAME", &serde_json::to_string(name).unwrap());
        let output = std::process::Command::new("node")
            .args(["-e", &harness])
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
}
