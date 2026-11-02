import { catalog as sampleCatalog, initialRecords, remoteRecords, posts, sampleCode } from './data.js';
import { fetchAllRecords } from './api-data.js';

// Sample interactions stay in memory. Development records use the preview's read-only API bridge.
let catalog = sampleCatalog;
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => structuredClone(value);
// Local-IP HTTP is not a secure context. Preview IDs also work without randomUUID.
const randomId = () => crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
async function copyCode(text) {
 if (navigator.clipboard?.writeText) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* Try the user-triggered HTTP fallback. */ }
 }
 const previous=document.activeElement, input=document.createElement('textarea');
 input.value=text;input.setAttribute('readonly','');input.style.cssText='position:fixed;left:0;top:0;opacity:0;pointer-events:none';
 ($('#dialog').open?$('#dialog'):document.body).append(input);input.select();
 try { return document.execCommand('copy'); } catch { return false; }
 finally { input.remove();previous?.focus(); }
}
const params = new URLSearchParams(location.search);
const oneOf = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const scenarios = ['returning', 'new', 'new-device', 'offline', 'sync-error', 'restore-error'];
const state = {
  dataSource: params.get('data') === 'development' ? 'development' : 'sample',
  development: {configured:null, connected:false, phase:'idle', error:'', code:'', count:0},
  variant: 'archive', // Selected direction; older comparison links now open A.
  lang: oneOf(params.get('lang'), ['ko', 'en'], 'ko'),
  theme: oneOf(params.get('theme'), ['light', 'dark'], 'light'),
  scenario: oneOf(params.get('scenario'), scenarios, 'returning'),
  route: location.hash.slice(1) || 'home', records: [], publicPosts: clone(posts),
  query: '', type: 'all', status: 'all', codeSaved: false, connected: false,
  ownCode: 'H4N8Q6RT', modal: null, selectedId: null, savedId: null,
  search: '', searchType: 'all', connectionInput: '', connectionStep: 'input',
  connectionError: '', busy: false, restoreFailedOnce: false, syncFailedOnce: false,
  deviceCount: 1, lastFocus: null, online: true, restorePending: false, connectionTarget: null, publishError: '', nickname: '', studioExpanded: false,
  entryDraft: null, tpoError: '',
};
const t = (ko, en) => state.lang === 'ko' ? ko : en;
const isDevelopment = () => state.dataSource === 'development';
const localized = value => typeof value === 'object' && value !== null ? value[state.lang] ?? value.ko ?? value.en ?? '' : value ?? '';
const hasNote = value => localized(value).trim().length > 0;
const title = id => catalog.find(item => item.id === id);
const record = id => state.records.find(item => item.id === id);
const cover = item => item?.cover || item?.poster || '';
const titleName = item => localized(item?.title);
const locale = () => state.lang === 'ko' ? 'ko-KR' : 'en-US';
const asDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value||'') ? new Date(`${value}T00:00:00`) : new Date(value);
const dateText = date => date && Number.isFinite(asDate(date).getTime()) ? new Intl.DateTimeFormat(locale(), {month:'short',day:'numeric'}).format(asDate(date)) : t('날짜 미기록','Date not recorded');
const timeText = date => date ? new Intl.DateTimeFormat(locale(), {hour:'2-digit',minute:'2-digit'}).format(asDate(date)) : '';
const fullDateText = date => date ? new Intl.DateTimeFormat(locale(), {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(asDate(date)) : t('기록하지 않았어요','Not recorded');
const recordDate = r => r.watchedAt || r.createdAt || r.updatedAt || '';
const newestFirst = (a,b) => (Date.parse(recordDate(b))||0)-(Date.parse(recordDate(a))||0);
const recordMonth = r => {const date=asDate(recordDate(r));return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;};
const placeLabels = {HOME:['집','Home'],THEATER:['극장','Cinema'],TRANSIT:['이동 중','In transit'],CAFE:['카페','Café'],OFFICE:['직장','Work'],LIBRARY:['도서관','Library'],BOOKSTORE:['서점','Bookshop'],SCHOOL:['학교','School'],PARK:['공원','Park'],OUTDOOR:['야외','Outdoors'],ETC:['기타','Other']};
const occasionLabels = {ALONE:['혼자','On my own'],DATE:['데이트','On a date'],FAMILY:['가족','With family'],FRIENDS:['친구','With friends'],BREAK:['휴식','Taking a break'],ETC:['기타','Other']};
const labelPlace = value => placeLabels[value] ? t(...placeLabels[value]) : '';
const labelOccasion = value => occasionLabels[value] ? t(...occasionLabels[value]) : '';
const labelType = type => ({movie:t('영화','Film'),series:t('시리즈','Series'),book:t('책','Book')})[type] || t('작품','Title');
const labelStatus = (status, type) => ({DONE:type === 'book' ? t('읽었어요','Read') : t('봤어요','Watched'),IN_PROGRESS:type === 'book' ? t('읽는 중','Reading') : t('보는 중','Watching'),WISHLIST:type === 'book' ? t('읽고 싶어요','To read') : t('보고 싶어요','To watch')})[status] || t('상태 미기록','Status not recorded');
const paths = {
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1z"/>',
 records:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
 together:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 3V11.5A8.5 8.5 0 0 1 9.5 3H13a8 8 0 0 1 8 8.5Z"/>',
 space:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',check:'<path d="m5 12 4 4L19 6"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 link:'<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
 book:'<path d="M12 5v16M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 cloud:'<path d="M6 18a5 5 0 1 1 1-10 6 6 0 0 1 11 2 4 4 0 0 1 0 8z"/>',
 heart:'<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 4 1 9 8 14 7-5 12-10 8-14Z"/>',
 pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m2 10v-3a6 6 0 0 0-3-5"/>',
};
const icon = name => `<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
const developmentHiddenActions = new Set(['profile','save-profile','edit-saved','save-status','save-edit','submit-code','confirm-merge','retry-restore','sync','sync-connect','resume-restore','show-code','copy-code','download-code','download-report','lost-code','publish','confirm-publish','like','connectivity','reset']);
const button = (text, action, cls = 'secondary', attrs = '') => {
 if(isDevelopment()) {
  if(developmentHiddenActions.has(action)) return '';
  if(action==='edit'){if(cls==='primary')return '';action='detail';text=`${t('기록 보기','View record')}${icon('arrow')}`;}
  if(action==='record'){action='records';text=cls.includes('mobile-record')?icon('search'):`${icon('search')}${t('내 기록 찾기','Find my records')}`;attrs=attrs.replace(/aria-label="[^"]*"/,`aria-label="${t('내 기록 찾기','Find my records')}"`);}
  if(action==='connect'){action='development-connect';}
 }
 return `<button type="button" class="button ${cls}" data-action="${action}" ${attrs}>${text}</button>`;
};
const image = (item, cls = '') => cover(item) ? `<img class="${cls}" src="${esc(cover(item))}" alt="${esc(titleName(item))}" loading="lazy" referrerpolicy="no-referrer" width="400" height="600">` : `<span class="cover-placeholder ${cls}" role="img" aria-label="${esc(titleName(item))}"><span>${esc(titleName(item))}</span></span>`;
const groupedCode = code => `${code.slice(0,4)} ${code.slice(4)}`;
const pendingCount = () => state.records.filter(r => r.syncStatus !== 'synced').length;
const recordEdition = r => !isDevelopment()?'':[r.seasonNumber!=null?t(`시즌 ${r.seasonNumber}`,`Season ${r.seasonNumber}`):'',r.episodeNumber!=null?t(`${r.episodeNumber}화`,`Episode ${r.episodeNumber}`):'',r.ott||''].filter(Boolean).join(' · ');
function recordContext(r,{timeOnly=false,modifier=''}={}) {
 const parts=[];
 if(r?.watchedAt)parts.push(`<time class="context-time" datetime="${esc(r.watchedAt)}">${icon('clock')}<span>${esc(timeOnly?timeText(r.watchedAt):`${dateText(r.watchedAt)} · ${timeText(r.watchedAt)}`)}</span></time>`);
 if(labelPlace(r?.place))parts.push(`<span class="context-place">${icon('pin')}<span>${esc(labelPlace(r.place))}</span></span>`);
 if(labelOccasion(r?.occasion))parts.push(`<span class="context-occasion">${icon('people')}<span>${esc(labelOccasion(r.occasion))}</span></span>`);
 return parts.length?`<div class="record-context ${modifier?`record-context--${modifier}`:''}" aria-label="${t('그날의 맥락','The moment’s context')}">${parts.join('')}</div>`:'';
}
function detailContext(r) {
 return `<section class="detail-context"><h2>${t('그날의 맥락','The moment around the story')}</h2><dl class="context-grid"><div><dt>${t('언제','When')}</dt><dd data-testid="detail-when">${r.watchedAt?`<time datetime="${esc(r.watchedAt)}">${esc(fullDateText(r.watchedAt))}</time>`:t('기록하지 않았어요','Not recorded')}</dd></div><div><dt>${t('어디서','Where')}</dt><dd data-testid="detail-place">${esc(labelPlace(r.place)||t('기록하지 않았어요','Not recorded'))}</dd></div><div><dt>${t('누구와·어떤 상황','Company or occasion')}</dt><dd data-testid="detail-occasion">${esc(labelOccasion(r.occasion)||t('기록하지 않았어요','Not recorded'))}</dd></div></dl>${r.status==='WISHLIST'?`<p class="hint">${t('나중에 만날 작품이에요. 이전에 남긴 감상 맥락은 그대로 보관해요.','Saved for later. Any previously recorded context is kept.')}</p>`:''}</section>`;
}
function localDateTime(value) {
 if(!value)return '';
 const date=asDate(value), pad=n=>String(n).padStart(2,'0');
 return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function prepareDraft(r=null) {
 state.tpoError='';
 state.entryDraft={sourceId:r?.id||null,when:r?localDateTime(r.watchedAt):localDateTime(new Date().toISOString()),place:r?.place||'',occasion:r?.occasion||'',note:clone(r?.note||''),rating:r?.rating||0,status:r?.status||'DONE'};
}
function tpoEditor({editing=false}={}) {
 const draft=state.entryDraft, current=editing?title(record(state.savedId)?.titleId):title(state.selectedId);
 const keys=current?.type==='book'?['HOME','CAFE','LIBRARY','BOOKSTORE','SCHOOL','PARK','OUTDOOR','TRANSIT','ETC']:['HOME','THEATER','TRANSIT','CAFE','OFFICE','ETC'];
 if(draft.place&&!keys.includes(draft.place))keys.push(draft.place);
 const disabled=editing&&draft.status==='WISHLIST';
 const options=(values,label,selected)=>`<option value="">${t('선택 안 함','Not recorded')}</option>${values.map(value=>`<option value="${value}" ${selected===value?'selected':''}>${esc(label(value))}</option>`).join('')}`;
 return `<fieldset class="tpo-editor"><legend>${t('그날의 맥락','Keep the moment, too')}</legend><p class="tpo-help">${disabled?t('나중에 만날 작품이에요. 기존 감상 맥락은 바꾸지 않고 보관해요.','Saved for later. Previous context stays unchanged.'):t('기억하고 싶은 만큼만 남겨요. 비워 두어도 괜찮아요.','Keep what you want to remember. These are optional.')}</p><div class="tpo-fields"><div class="field tpo-when-field"><label for="tpo-when">${t('언제','When')}</label><input type="datetime-local" id="tpo-when" data-testid="tpo-when" data-control="tpo-when" name="watchedAt" step="60" value="${esc(draft.when)}" ${disabled?'disabled':''} aria-describedby="tpo-error"></div><div class="field tpo-place-field"><label for="tpo-place">${t('어디서','Where')}</label><select id="tpo-place" data-testid="tpo-place" data-control="tpo-place" name="place" ${disabled?'disabled':''}>${options(keys,labelPlace,draft.place)}</select></div><div class="field tpo-occasion-field"><label for="tpo-occasion">${t('누구와·어떤 상황','Company or occasion')}</label><select id="tpo-occasion" data-testid="tpo-occasion" data-control="tpo-occasion" name="occasion" ${disabled?'disabled':''}>${options(Object.keys(occasionLabels),labelOccasion,draft.occasion)}</select></div></div><p class="field-error" id="tpo-error" data-testid="tpo-error" role="alert">${esc(state.tpoError)}</p></fieldset>`;
}
function readDraftContext(status,existing) {
 if(status==='WISHLIST')return {watchedAt:existing?.watchedAt||null,place:existing?.place||null,occasion:existing?.occasion||null};
 const draft=state.entryDraft, input=$('#tpo-when');
 if(input){draft.when=input.value;}
 const parsed=draft.when?new Date(draft.when):null;
 if(input?.validity.badInput || (draft.when&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.when)||Number.isNaN(parsed.getTime())||localDateTime(parsed.toISOString())!==draft.when))) {
  state.tpoError=t('날짜와 시간을 확인해 주세요. 비워 두어도 괜찮아요.','Check the date and time, or leave it blank.');$('#tpo-error').textContent=state.tpoError;input?.focus();return null;
 }
 return {watchedAt:parsed?.toISOString()||null,place:placeLabels[draft.place]?draft.place:null,occasion:occasionLabels[draft.occasion]?draft.occasion:null};
}
const initialOwnCode = 'H4N8Q6RT';
const demoAccounts = new Map();
let operationGeneration = 0;
function cancelOperation() { operationGeneration += 1; state.busy = false; }
function savedSyncStatus() { return !state.online ? 'pending' : state.scenario === 'sync-error' && !state.syncFailedOnce ? 'failed' : 'synced'; }
function resetDemoAccounts() {
 demoAccounts.clear();
 demoAccounts.set(initialOwnCode, clone(initialRecords));
 demoAccounts.set(sampleCode, clone(remoteRecords));
}
function freshDemoCode() {
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 let code;
 do { code=Array.from(crypto.getRandomValues(new Uint8Array(8)), n=>alphabet[n%alphabet.length]).join(''); } while(demoAccounts.has(code));
 return code;
}
function newestRecords(source, target) {
 const byTitle=new Map();
 for(const r of [...source,...target]) {
  const previous=byTitle.get(r.titleId);
  if(!previous || (r.updatedAt||r.watchedAt)>=(previous.updatedAt||previous.watchedAt)) byTitle.set(r.titleId,{...clone(r),syncStatus:'synced'});
 }
 return [...byTitle.values()];
}
function persistSyncedRecords() {
 const synced=state.records.filter(r=>r.syncStatus==='synced');
 if(!synced.length)return;
 demoAccounts.set(state.ownCode,newestRecords(demoAccounts.get(state.ownCode)||[],synced));
 state.connected=true;
}
function initScenario({resetAccounts=false}={}) {
 catalog=sampleCatalog;
 cancelOperation();
 if(resetAccounts){resetDemoAccounts();state.nickname='';}
 state.online = state.scenario !== 'offline'; state.restorePending = false; state.connectionTarget=null;
 state.modal = null; state.selectedId = null; state.savedId = null; state.entryDraft=null; state.tpoError=''; state.connectionStep = 'input'; state.connectionInput = ''; state.connectionError = ''; state.publishError='';
 const blank=['new','new-device','restore-error'].includes(state.scenario);
 state.ownCode=blank?freshDemoCode():(demoAccounts.has(initialOwnCode)?initialOwnCode:sampleCode);
 state.records=blank?[]:clone(demoAccounts.get(state.ownCode)||[]);
 state.publicPosts=clone(posts);state.connected=!blank&&demoAccounts.has(state.ownCode);
 state.codeSaved = false; state.deviceCount = 1; state.restoreFailedOnce = false; state.syncFailedOnce = false;
 if (['offline','sync-error'].includes(state.scenario) && state.records[0]) state.records[0].syncStatus = state.scenario === 'offline' ? 'pending' : 'failed';
 state.query = ''; state.type = 'all'; state.status = 'all'; state.route = 'home';
}
let developmentController = null, developmentGeneration = 0;
function cancelDevelopment() { developmentGeneration++; developmentController?.abort(); developmentController=null; }
function clearDevelopmentRecords() {
 catalog=[];state.records=[];state.publicPosts=[];state.nickname='';state.ownCode='';state.connected=false;state.restorePending=false;state.entryDraft=null;state.online=true;state.development.count=0;
}
function developmentError(code) {
 const messages={
  NOT_CONFIGURED:['개발 API 연결이 아직 준비되지 않았어요. 서버 설정을 확인한 뒤 다시 불러와 주세요.','The development API is not configured yet. Check the preview server, then try again.'],
  SESSION_REQUIRED:['개발 기록의 연결 코드를 입력해 주세요.','Enter the connection code for your development records.'],
  SESSION_EXPIRED:['연결이 만료됐어요. 연결 코드를 다시 입력해 주세요.','Your connection has expired. Enter your code again.'],
  INVALID_CODE:['연결 코드를 확인해 주세요. 개발 계정의 8자리 코드가 필요해요.','Check your code. Use the 8-character code from your development account.'],
  CONNECTION_FAILED:['이 코드로 연결하지 못했어요. 개발 계정의 코드인지 확인한 뒤 다시 시도해 주세요.','This code could not be connected. Check that it belongs to your development account and try again.'],
  FORBIDDEN:['이 연결을 확인하지 못했어요. 페이지를 새로 열고 다시 시도해 주세요.','This connection could not be verified. Reopen the page and try again.'],
 };
 return t(...(messages[code]||['개발 기록을 불러오지 못했어요. API 연결을 확인한 뒤 다시 시도해 주세요.','Your development records could not be loaded. Check the API connection and try again.']));
}
async function developmentRequest(path, options={}, signal=developmentController?.signal) {
 const response=await fetch(`/preview-api${path}`,{credentials:'same-origin',cache:'no-store',...options,headers:{'Accept-Language':state.lang,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal});
 const body=await response.json().catch(()=>null);
 if(!response.ok)throw Object.assign(new Error('Development API request failed'),{code:body?.error||'API_UNAVAILABLE',status:response.status});
 return body;
}
async function loadDevelopment({code}={}) {
 cancelDevelopment();const generation=developmentGeneration;developmentController=new AbortController();
 clearDevelopmentRecords();state.development.phase='loading';state.development.error='';state.development.count=0;render();if(state.modal==='development-connect')renderDialog();
 try {
  const session=await developmentRequest('/session',code?{method:'POST',body:JSON.stringify({code})}:{});
  if(generation!==developmentGeneration||!isDevelopment())return;
  state.development.configured=code?true:session.configured;state.development.connected=session.connected===true;
  if(!state.development.configured){state.development.phase='error';state.development.error='NOT_CONFIGURED';render();if(state.modal)renderDialog();return;}
  if(!session.connected){state.development.phase='disconnected';render();if(state.modal)renderDialog();return;}
  state.development.code='';
  const [data,profile]=await Promise.all([
   fetchAllRecords(path=>developmentRequest(path),count=>{if(generation===developmentGeneration){state.development.count=count;const node=$('[data-testid="development-progress"]');if(node)node.textContent=t(`${count}개의 기록을 살펴보고 있어요.`,`${count} records loaded so far.`);}}),
   developmentRequest('/auth/profile'),
  ]);
  if(generation!==developmentGeneration||!isDevelopment())return;
  catalog=data.catalog;state.records=data.records;state.nickname=typeof profile?.nickname==='string'?profile.nickname:'';
  state.development.phase='ready';state.development.count=data.records.length;state.connected=true;
  if(state.modal==='development-connect')closeModal();
  render();
 }catch(error){
  if(generation!==developmentGeneration||!isDevelopment()||error.name==='AbortError')return;
  developmentController?.abort();clearDevelopmentRecords();state.development.phase='error';state.development.error=error.code||'API_UNAVAILABLE';
  if(['SESSION_REQUIRED','SESSION_EXPIRED'].includes(error.code))state.development.connected=false;
  render();if(state.modal==='development-connect')renderDialog();
 }
}
async function disconnectDevelopment() {
 cancelDevelopment();const generation=developmentGeneration;developmentController=new AbortController();
 clearDevelopmentRecords();state.development.phase='loading';state.development.error='';render();
 try{
  await developmentRequest('/session',{method:'DELETE'});
  if(generation!==developmentGeneration||!isDevelopment())return;
  state.development.connected=false;state.development.code='';state.development.phase='disconnected';render();
 }catch(error){if(generation!==developmentGeneration||!isDevelopment()||error.name==='AbortError')return;state.development.phase='error';state.development.error=error.code||'API_UNAVAILABLE';render();}
}
function switchDataSource(value) {
 if(value===state.dataSource)return;
 if($('#dialog').open)closeModal();cancelDevelopment();cancelOperation();
 state.dataSource=value==='development'?'development':'sample';state.query='';state.type='all';state.status='all';state.route='home';
 if(isDevelopment()){clearDevelopmentRecords();loadDevelopment();}else{initScenario({resetAccounts:true});render();}
}
function developmentControls() {
 return `<div class="development-actions">${button(t('다시 불러오기','Reload records'),'development-refresh','secondary',`data-testid="development-refresh" ${state.development.phase==='loading'?'disabled':''}`)}${state.development.connected?button(t('이 미리보기에서 나가기','Leave this preview'),'development-disconnect','quiet',`data-testid="development-disconnect" ${state.development.phase==='loading'?'disabled':''}`):button(t('개발 기록 연결하기','Connect development records'),'development-connect','primary',`data-testid="development-connect" ${state.development.phase==='loading'||state.development.configured===false?'disabled':''}`)}</div>`;
}
function developmentStatus() {
 const dev=state.development;
 return `<section class="development-status" data-testid="development-status" data-phase="${dev.phase}" aria-live="polite"><div>${icon('cloud')}<span><strong>${t('개발 데이터 · 읽기 전용','Development data · read only')}</strong><p>${dev.phase==='ready'?t(`${state.records.length}개의 기록을 불러왔어요.`,`${state.records.length} records loaded.`):dev.phase==='loading'?t('개발 기록을 불러오고 있어요.','Loading your development records.'):dev.error?developmentError(dev.error):t('개발 계정의 연결 코드로 기록을 열어보세요.','Open your records with your development account’s connection code.')}</p></span></div>${developmentControls()}</section>`;
}
function developmentGate() {
 const dev=state.development;
 return `<div class="page-heading"><div><p class="eyebrow">${t('나의 아카이브','YOUR PERSONAL ARCHIVE')}</p><h1>${t('내 기록으로 만나보는 A 시안','See A with your own records')}</h1><p class="lead">${t('개발 서버에 남긴 작품과 그날의 맥락을 불러와요.','Bring in the titles and moments kept on your development server.')}</p></div></div>${developmentStatus()}${dev.phase==='loading'?`<div class="development-loading" role="status"><div class="development-skeletons" aria-hidden="true">${Array.from({length:6},()=>'<span></span>').join('')}</div><p data-testid="development-progress">${t(`${dev.count}개의 기록을 살펴보고 있어요.`,`${dev.count} records loaded so far.`)}</p></div>`:`<p class="hint">${t('이 미리보기에서는 기록을 읽기만 해요. 연결 코드를 입력하면 개발 계정에 미리보기 기기가 연결돼요.','This preview only reads records. Entering your code links a preview device to your development account.')}</p>`}`;
}
function developmentSpace() {
 return `<div class="page-heading"><div><p class="eyebrow">${t('나의 공간','MY SPACE')}</p><h1>${t('개발 기록이 머무는 곳','Your development records, here')}</h1><p class="lead">${t('지금 연결한 계정의 기록을 살펴봐요.','Take a look through the records from your connected account.')}</p></div></div>${developmentStatus()}<section class="panel settings-panel"><h2>${t('나의 프로필','My profile')}</h2><p>${esc(state.nickname)||t('닉네임 없이 남긴 기록이에요.','Records kept without a nickname.')}</p><p class="hint">${t('프로필과 기록은 이 미리보기에서 바꾸지 않아요.','Profiles and records cannot be changed in this preview.')}</p></section><section class="panel settings-panel"><h2>${t('나에게 맞게','Make it yours')}</h2><div class="settings-list">${button(`${t('화면 테마','Appearance')}<span>${state.theme==='light'?t('라이트','Light'):t('다크','Dark')}${icon('arrow')}</span>`,'theme','quiet')}${button(`${t('언어','Language')}<span>${state.lang==='ko'?'한국어':'English'}${icon('arrow')}</span>`,'language','quiet')}${button(`${t('내 기록 내보내기','Export my records')}<span>CSV ${icon('download')}</span>`,'export','quiet')}</div></section><p class="hint">${t('미리보기에서 나가면 이 브라우저의 연결만 끝나요. 개발 계정의 기기 목록은 원래 서비스에서 관리할 수 있어요.','Leaving ends this browser’s preview session. Manage linked devices in the original service.')}</p>`;
}
function developmentConnectionDialog() {
 const dev=state.development;
 return dialogFrame(t('개발 기록 이어보기','Open your development records'),t('개발 서비스의 내 공간에서 연결 코드를 확인해 주세요.','Find the connection code in My space on your development service.'),`<form id="development-connection-form"><div class="field"><label for="development-code">${t('개발 기록 연결 코드','Development connection code')}</label><input id="development-code" class="code-input" data-control="development-code" data-testid="development-code" value="${esc(dev.code)}" placeholder="ABCD EFGH" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="development-code-help development-code-error" ${dev.phase==='loading'?'disabled':''}><p class="hint" id="development-code-help">${t('개발 계정의 8자리 코드예요. 입력하면 미리보기 기기가 연결되고, 기록은 읽기만 해요.','Use your development account’s 8-character code. This links a preview device; records are read only.')}</p><p class="field-error" role="alert" id="development-code-error" data-testid="development-error">${dev.error?developmentError(dev.error):''}</p></div>${button(dev.phase==='loading'?t('기록 불러오는 중','Loading records'):t('내 기록 열어보기','Open my records'),'development-submit','primary',`data-testid="development-connect-submit" ${dev.phase==='loading'?'disabled':''}`)}</form>`);
}
function updateURL() {
 const url = new URL(location.href);
 for (const key of ['variant','lang','theme','scenario']) url.searchParams.set(key, state[key]);
 if(isDevelopment())url.searchParams.set('data','development');else url.searchParams.delete('data');
 url.hash = state.route; history.replaceState({}, '', url);
}
function syncLabel(item) {
 if(isDevelopment())return t('개발 서버에서 불러옴','Loaded from development server');
 if (item?.syncStatus === 'failed') return t('동기화 다시 시도','Sync needs a retry');
 if (item?.syncStatus === 'pending') return t('이 기기에 저장됨 · 동기화 대기','On this device · waiting to sync');
 return t('서버 동기화 완료','Synced to server');
}
function syncPill(item) { return `<span class="sync-pill ${item?.syncStatus === 'synced' ? '' : 'is-pending'}">${icon(item?.syncStatus === 'synced' ? 'check' : 'clock')}${syncLabel(item)}</span>`; }
function navItems() { return [['home',t('홈','Home')],['records',t('내 기록','My records')],['together',t('함께','Together')],['space',t('내 공간','My space')]]; }
function activeNav() { return ['report','shelf'].includes(state.route) || state.route.startsWith('title/') ? 'records' : state.route; }
function studio() {
 $('#studio').innerHTML = `<div class="studio ${state.studioExpanded?'is-expanded':''}" role="region" aria-label="${t('시안 미리보기 도구','Design preview controls')}">
 <div class="studio-brand"><span class="studio-dot"></span><strong>OTTLINE 2.0</strong><span>${t('디자인 미리보기','DESIGN PREVIEW')}</span></div>
 <div class="studio-selected" data-testid="selected-variant" aria-label="${t('선택한 시안','Selected design')}"><strong>${t('A 아카이브','A Archive')}</strong><span>${t('선택한 시안','Selected design')}</span></div>
 ${button(t('미리보기 설정','Preview'),'studio-toggle','studio-toggle',`data-testid="studio-toggle" aria-label="${t('미리보기 설정','Preview settings')}" aria-controls="studio-settings" aria-expanded="${state.studioExpanded}"`)}
 <div class="studio-settings" id="studio-settings"><div class="studio-controls">
 <label class="studio-select"><span class="sr-only">${t('보여줄 데이터','Data source')}</span><select data-control="data-source" data-testid="data-source"><option value="sample" ${!isDevelopment()?'selected':''}>${t('샘플 데이터','Sample data')}</option><option value="development" ${isDevelopment()?'selected':''}>${t('개발 데이터','Development data')}</option></select></label>
 ${!isDevelopment()?`<label class="studio-select"><span class="sr-only">${t('테스트 상황','Scenario')}</span><select data-control="scenario" data-testid="scenario">${scenarios.map((v,i)=>`<option value="${v}" ${state.scenario===v?'selected':''}>${[t('기록이 있는 사용자','Returning user'),t('처음 방문','First visit'),t('새 기기','New device'),t('오프라인','Offline'),t('동기화 오류','Sync error'),t('불러오기 오류','Restore error')][i]}</option>`).join('')}</select></label>`:''}
 ${button(state.lang === 'ko' ? 'EN' : '한국어','language','studio-tool',`aria-label="${t('영어로 보기','View in Korean')}" data-testid="language"`)}
 ${button(icon('sun'),'theme','studio-tool',`aria-label="${state.theme==='light'?t('다크 모드','Dark mode'):t('라이트 모드','Light mode')}" data-testid="theme"`)}
 ${button(state.online?t('온라인 (체험)','Online (preview)'):t('오프라인 (체험)','Offline (preview)'),'connectivity','studio-tool',`aria-label="${t('시안 네트워크 연결 전환','Toggle preview connectivity')}" aria-pressed="${state.online}" data-testid="connectivity"`)}
 ${button(t('초기화','Reset'),'reset','studio-tool',`data-testid="reset"`)}
 </div><div class="studio-caption">${isDevelopment()?t('개발 서버의 기록을 읽기 전용으로 보여줘요.','Read-only records from your development server.'):t('샘플 데이터로만 동작해요. 실제 기록에는 영향이 없어요.','Sample data only. Your real records stay untouched.')} ${isDevelopment()?`<span>${t('개발 데이터 · 읽기 전용','Development data · read only')}</span>`:`<span>${t('연결 체험 코드','Try connection code')}: <b>${groupedCode(sampleCode)}</b></span>`}</div></div></div>`;
}
function shell() {
 const nav = navItems().map(([key,label])=>`<a href="#${key}" class="${activeNav()===key?'is-active':''}" ${activeNav()===key?'aria-current="page"':''} data-testid="nav-${key}">${icon(key)}<span>${label}</span></a>`).join('');
 $('#app').innerHTML = `<header class="app-header"><a class="brand" href="#home" aria-label="OTTLINE ${t('홈','home')}"><span class="brand-main">ottline</span><span class="brand-sub">ON THE TIMELINE</span></a><nav class="desktop-nav" aria-label="${t('주요 메뉴','Main navigation')}">${nav}</nav><div class="header-actions">${button(`${icon('plus')}${t('기록 남기기','Leave a record')}`,'record','record-button secondary','data-testid="record-open"')}<button type="button" class="avatar" data-action="${isDevelopment()?'space':'profile'}" aria-label="${isDevelopment()?t('내 공간 보기','Open My space'):t('내 프로필 수정','Edit my profile')}" data-testid="profile-open">${state.nickname?esc(Array.from(state.nickname)[0]):icon('space')}</button></div></header>
 <main id="main" tabindex="-1" class="page">${pageContent()}</main>
 <footer class="site-footer"><span>ottline · on the timeline</span><span>${t('보고, 읽고, 남겨둔 나의 시간.','The things you watched, read, and kept.')}</span></footer>
 <nav class="mobile-nav" aria-label="${t('모바일 주요 메뉴','Mobile navigation')}">${nav.slice(0,nav.indexOf('<a href="#together"'))}${button(icon('plus'),'record','mobile-record secondary',`aria-label="${t('기록 남기기','Leave a record')}" data-testid="record-open-mobile"`)}${nav.slice(nav.indexOf('<a href="#together"'))}</nav>`;
}
function render() {
 document.documentElement.lang = state.lang; document.body.dataset.variant = state.variant; document.body.dataset.theme = state.theme; document.body.dataset.route = state.route;document.body.dataset.dataSource=state.dataSource;
 studio(); shell(); updateURL();
}
function sectionHeader(ko,en,href,linkKo='모두 보기',linkEn='View all') { return `<div class="section-header"><h2>${t(ko,en)}</h2>${href?`<a class="text-link" href="#${href}">${t(linkKo,linkEn)}${icon('arrow')}</a>`:''}</div>`; }
function posterCard(r) {
 const item = title(r.titleId); if(!item) return '';
 return `<article class="poster-card"><button type="button" data-action="detail" data-id="${esc(r.id)}" aria-label="${esc(titleName(item))} ${t('기록 보기','view record')}"><div class="cover-wrap">${image(item)}<span class="cover-type">${labelType(item.type)}</span></div><div class="poster-meta"><h3 class="title">${esc(titleName(item))}</h3><p class="meta">${labelStatus(r.status,item.type)}${recordEdition(r)?` · ${esc(recordEdition(r))}`:''}</p>${recordContext(r,{modifier:'compact'})}${hasNote(r.note)?`<p class="record-note">${esc(localized(r.note))}</p>`:''}</div></button></article>`;
}
function desktopHomePage() {
 const returning = state.records.length > 0;
 const continuing = state.records.filter(r=>r.status==='IN_PROGRESS').slice(0,2);
 const recent = [...state.records].sort(newestFirst).slice(0,6);
 return `<div class="home-top"><section class="hero"><p class="eyebrow">${t('나의 아카이브','YOUR PERSONAL ARCHIVE')} <span>—</span> ${isDevelopment()?esc(new Intl.DateTimeFormat(locale(),{month:'long',day:'numeric',weekday:'long'}).format(new Date())):t('11월 2일, 월요일','MONDAY, NOVEMBER 2')}</p><h1>${returning?t('좋은 이야기는<br>오래 남으니까.','Good stories<br>stay with you.'):t('보고 읽은 순간을,<br>나의 기록으로.','Watched. Read.<br>Remembered.')}</h1><p class="lead">${isDevelopment()?t('보고, 읽고, 느낀 것들. 남겨둔 이야기를 돌아봐요.','What you watched, read, and felt. Revisit the stories you kept.'):returning?t('보고, 읽고, 느낀 것들. 오늘의 한 줄을 이어가요.','What you watched, read, and felt. Keep the story going.'):t('가입 없이 가볍게 시작해요.<br>작품 하나면 첫 페이지가 채워져요.','Start without signing up.<br>One title is all your first page needs.')}</p>${!returning?`<div class="hero-actions">${button(`${icon('plus')}${t('첫 기록 남기기','Leave your first record')}`,'record','primary','data-testid="first-record"')}${button(`${t('내 기록 이어보기','Bring my records here')}${icon('arrow')}`,'connect','quiet','data-testid="connect-entry"')}</div>`:''}</section>
 <aside class="connection-note">${icon('lock')}<div><strong>${isDevelopment()?t('개발 기록으로 둘러보기','Explore your development records'):returning?t('내 기록은, 내 곁에.','Your records, close at hand.'):t('이미 남긴 기록이 있나요?','Already have records?')}</strong><p>${isDevelopment()?t('남겨둔 작품과 메모를<br>편안하게 돌아보세요.','Revisit the titles and notes<br>you have kept.') :returning?(pendingCount()?t('이 기기에 저장된 기록이 있어요.<br>연결되면 다른 기기에서도 볼 수 있어요.','Some records are on this device.<br>Sync them to open on another device.'):t('기록 연결 코드 하나로<br>어느 기기에서든 이어보세요.','One connection code.<br>The same records on every device.')):t('다른 기기의 기록 연결 코드를<br>입력하면 그대로 이어볼 수 있어요.','Enter the code from your other device<br>to pick up where you left off.')}</p>${button(`${isDevelopment()?t('연결 상태 보기','View connection'):returning?t('내 코드 확인하기','Find my code'):t('내 기록 이어보기','Bring my records here')}${icon('arrow')}`,returning?'space':'connect','quiet')}</div></aside></div>
 ${pendingCount()?`<div class="notice sync-notice">${icon('cloud')}<div><strong>${t('아직 이 기기에만 있는 기록이 있어요.','Some records are only on this device.')}</strong><p>${!state.online?t('인터넷에 다시 연결한 뒤 동기화해 주세요.','Reconnect to the internet, then sync.'):t('기록은 남아 있어요. 동기화를 다시 시도할 수 있어요.','Your records are still here. You can try syncing again.')}</p></div>${button(t('동기화 다시 시도','Retry sync'),'sync','secondary','data-testid="sync-retry"')}</div>`:''}

 ${continuing.length?`<section class="continue-section">${sectionHeader('이야기를 이어갈 시간','Pick up your story','records','내 기록으로','My records')}<div class="continue-grid">${continuing.map((r)=>{const item=title(r.titleId);return `<article class="continue-card">${image(item,'continue-cover')}<div class="continue-body"><p class="eyebrow">${labelType(item.type)} · ${labelStatus(r.status,item.type)}</p><h3>${esc(titleName(item))}</h3><p class="meta">${esc(localized(item.creator))}${recordEdition(r)?` · ${esc(recordEdition(r))}`:''}</p><div class="continue-footer">${recordContext(r,{modifier:'compact'})}${button(`${t('이어 적기','Add a note')}${icon('arrow')}`,'edit','quiet',`data-id="${esc(r.id)}"`)}</div></div></article>`;}).join('')}</div></section>`:''}
 ${state.restorePending?`<div class="notice"><strong>${t('연결된 기록을 마저 불러올까요?','Ready to finish loading your records?')}</strong><p>${t('기록 연결은 완료됐어요. 불러오기를 이어서 진행할 수 있어요.','The connection is ready. You can continue loading your records.')}</p>${button(t('기록 불러오기 계속','Continue loading records'),'resume-restore','secondary','data-testid="resume-restore-home"')}</div>`:''}<section class="recent-section">${sectionHeader(returning?'최근에 남긴 순간':'첫 페이지를 채워볼까요? ',returning?'Recently kept':'What will your first page hold?',returning?'records':null)}${returning?`<div class="poster-grid">${recent.map(posterCard).join('')}</div>`:`<div class="starter-grid">${catalog.slice(0,4).map(item=>`<button type="button" class="starter-card" data-action="select-title" data-id="${esc(item.id)}">${image(item)}<span><strong>${esc(titleName(item))}</strong><small>${labelType(item.type)} · ${item.year}</small></span>${icon('plus')}</button>`).join('')}</div><p class="hint">${t('시안용 가상 작품이에요. 검색에서 다른 작품도 골라볼 수 있어요.','Fictional titles for this preview. Explore more in search.')}</p>`}</section>
 ${returning?`<div class="home-bottom"><section class="memory-strip"><div><p class="eyebrow">${t('기록 속 작은 발견','A LITTLE DISCOVERY')}</p><h2>${t('쌓아온 취향을<br>한눈에 돌아봐요.','Your stories,<br>all in one place.')}</h2><a href="#report" class="text-link">${t('나의 리포트 보기','Open my report')}${icon('arrow')}</a></div><div class="memory-covers">${recent.slice(0,3).map(r=>image(title(r.titleId))).join('')}</div></section><aside class="report-callout"><p class="eyebrow">${t('차곡차곡 쌓인 시간','YOUR TIME, COLLECTED')}</p><strong class="record-total">${state.records.length}<span>${t('개의 기록',state.records.length===1?'record':'records')}</span></strong><p>${t('서두르지 않아도 괜찮아요.<br>남기고 싶은 순간에 다시 만나요.','No need to keep up.<br>Come back when there’s something to keep.')}</p></aside></div>`:''}`;
}
function homePage() {
 return `<div class="desktop-home">${desktopHomePage()}</div>${mobileArchiveHome()}`;
}
function mobileHomeHeading(heading) {
 return `<header class="mobile-home-heading"><p class="mobile-home-date">${isDevelopment()?esc(new Intl.DateTimeFormat(locale(),{month:'long',day:'numeric',weekday:'long'}).format(new Date())):t('11월 2일 월요일','MONDAY, NOVEMBER 2')}</p><h1>${heading}</h1></header>`;
}
function mobileAttention() {
 const pending=pendingCount();
 return `${state.restorePending?`<aside class="mobile-attention" role="status">${icon('cloud')}<div><strong>${t('연결됐어요. 기록을 마저 불러와요.','Connected. Finish loading your records.')}</strong>${button(t('불러오기 계속','Continue loading'),'resume-restore','quiet','data-testid="mobile-resume-restore"')}</div></aside>`:''}${pending?`<aside class="mobile-attention" role="status">${icon('clock')}<div><strong>${t(`${pending}개 기록, 이 기기에 보관 중`,`${pending} ${pending===1?'record':'records'} kept on this device`)}</strong><p>${!state.online?t('인터넷에 연결한 뒤 동기화하면 다른 기기에서도 이어볼 수 있어요.','Connect to the internet, then sync to open them on other devices.'):t('동기화를 마치면 다른 기기에서도 보여요.','Sync to open them on your other devices.')}</p>${state.online?button(t('동기화 다시 시도','Retry sync'),'sync','quiet','data-testid="mobile-sync-retry"'):''}</div></aside>`:!state.online?`<aside class="mobile-attention" role="status">${icon('cloud')}<div><strong>${t('지금은 오프라인이에요.','You are offline.')}</strong><p>${t('새 기록은 이 기기에 먼저 남아요.','New records will stay on this device.')}</p></div></aside>`:''}`;
}
function mobileConnectionShortcut() {
 if(isDevelopment())return button(`${icon('check')}<span>${t('개발 서버에서 불러온 기록','Records from your development server')}</span>${icon('arrow')}`,'space','mobile-home-status','data-testid="mobile-connection-status"');
 const label=state.restorePending?t('연결됨 · 기록 불러오기 대기','Connected · waiting to load'):pendingCount()?t('이 기기에만 있는 기록 확인','Check records waiting to sync'):state.connected?t('기록 동기화 완료 · 내 연결 코드','Records synced · my connection code'):t('다른 기기의 기록 이어보기','Bring records from another device');
 return button(`${icon(state.restorePending||pendingCount()?'clock':state.connected?'check':'link')}<span>${label}</span>${icon('arrow')}`,state.restorePending?'resume-restore':state.connected||pendingCount()?'space':'connect','mobile-home-status','data-testid="mobile-connection-status"');
}
function mobileFirstRecord() {
 return `<section class="mobile-first-record"><p>${t('영화, 시리즈, 책. 오늘의 작품 하나부터 남겨보세요.','A film, a series, a book. Start with one title from today.')}</p>${button(`${icon('plus')}${t('첫 기록 남기기','Leave your first record')}`,'record','primary','data-testid="mobile-first-record"')}${button(`${t('이미 남긴 기록 이어보기','Bring my existing records')}${icon('arrow')}`,'connect','quiet','data-testid="mobile-connect-entry"')}</section>${mobileAttention()}<section class="mobile-first-titles"><div class="mobile-section-heading"><h2>${t('이런 이야기부터','A place to begin')}</h2><span class="meta">${t('시안용 작품','Preview titles')}</span></div><div class="mobile-start-list">${catalog.slice(0,3).map(item=>`<button type="button" class="mobile-start-card" data-action="select-title" data-id="${esc(item.id)}">${image(item)}<span><strong>${esc(titleName(item))}</strong><small>${labelType(item.type)} · ${item.year}</small></span>${icon('plus')}</button>`).join('')}</div></section>`;
}
function mobileArchiveHome() {
 const continuing=state.records.filter(r=>r.status==='IN_PROGRESS');
 const recent=[...state.records].sort(newestFirst).slice(0,6);
 return `<div class="mobile-home mobile-home-archive" data-testid="mobile-archive-home">${mobileHomeHeading(state.records.length?(isDevelopment()?t('남겨둔 이야기를 만나요','Revisit your stories'):t('오늘의 이야기를 남겨요','Keep today’s story')):t('나의 첫 기록','Your first record'))}${!state.records.length?mobileFirstRecord():`${button(`${icon('search')}<span class="mobile-quick-copy"><strong>${t('어떤 작품을 만났나요?','What did you watch or read?')}</strong><small>${t('제목을 찾아 바로 기록하기','Find a title, keep a moment')}</small></span>${icon('arrow')}`,'record','mobile-quick-record','data-testid="mobile-search"')}${mobileAttention()}${continuing.length?`<section class="mobile-continue-section"><div class="mobile-section-heading"><h2>${isDevelopment()?t('함께하고 있는 이야기','Stories you are following'):t('이어서 남기기','Pick up where you left off')}</h2><a href="#records" class="text-link">${t('전체','View all')}${icon('arrow')}</a></div><div class="mobile-continue-rail">${continuing.map(r=>{const item=title(r.titleId);return `<article class="mobile-continue-card" data-testid="continue-card">${image(item,'mobile-continue-cover')}<div class="mobile-continue-content"><p class="meta">${labelStatus(r.status,item.type)}</p><h3>${esc(titleName(item))}</h3>${recordEdition(r)?`<p class="meta">${esc(recordEdition(r))}</p>`:''}${recordContext(r,{modifier:'compact'})}${button(`${t('이어 적기','Add a note')}${icon('arrow')}`,'edit','quiet',`data-id="${esc(r.id)}"`)}</div></article>`;}).join('')}</div></section>`:''}<section class="mobile-recent-section"><div class="mobile-section-heading"><h2>${t('최근 남긴 기록','Recently kept')}</h2><a href="#records" class="text-link">${t('전체','View all')}${icon('arrow')}</a></div><div class="mobile-recent-rail">${recent.map(r=>{const item=title(r.titleId);return `<button type="button" class="mobile-recent-card" data-action="detail" data-id="${esc(r.id)}" aria-label="${esc(titleName(item))} ${t('기록 보기','view record')}">${image(item)}<strong>${esc(titleName(item))}</strong><span>${r.watchedAt?dateText(r.watchedAt):r.status==='WISHLIST'?t('담아 둔 작품','Saved for later'):t('날짜 미기록','Date not recorded')}</span></button>`;}).join('')}</div></section>${mobileConnectionShortcut()}`}</div>`;
}
function recordsPage() {
 const filtered=state.records.filter(r=>{const item=title(r.titleId); return item && (state.type==='all'||item.type===state.type)&&(state.status==='all'||r.status===state.status)&&`${localized(item.title)} ${localized(r.note)}`.toLowerCase().includes(state.query.toLowerCase());}).sort(newestFirst);
 return `<div class="page-heading"><div><p class="eyebrow">${t('나의 기록','MY RECORDS')}</p><h1>${t('나의 시간이 쌓이는 곳','A little history of you')}</h1><p class="lead">${t('보고 읽은 것들, 그때의 마음까지.','What you watched and read, and how it felt.')}</p></div><div class="heading-actions"><a class="button secondary" href="#report">${icon('clock')}${t('리포트','Report')}</a>${state.lang==='ko'?`<a class="button secondary" href="#shelf">${icon('book')}내 서가</a>`:''}</div></div>
 <div class="filter-bar"><label class="search-field">${icon('search')}<input data-control="record-search" data-focus="record-search" data-testid="record-search" value="${esc(state.query)}" placeholder="${t('작품이나 메모 찾기','Search titles or notes')}" aria-label="${t('기록 검색','Search records')}"></label><div class="filter-chips">${['all','movie','series','book'].map(v=>button(v==='all'?t('전체','All'):labelType(v),'filter-type','',`data-value="${v}" aria-pressed="${state.type===v}"`)).join('')}</div><label class="status-filter"><span class="sr-only">${t('기록 상태','Record status')}</span><select data-control="status" data-testid="status-filter">${['all','DONE','IN_PROGRESS','WISHLIST'].map(v=>`<option value="${v}" ${state.status===v?'selected':''}>${({all:t('모든 상태','All statuses'),DONE:t('다 본·읽은 작품','Watched or read'),IN_PROGRESS:t('보고·읽는 중','Watching or reading'),WISHLIST:t('찜해둔 작품','Saved for later')})[v]}</option>`).join('')}</select></label></div>
 <p class="results-summary">${t(`${filtered.length}개의 기록`,`${filtered.length} ${filtered.length===1?'record':'records'}`)}</p>
 <div class="timeline-list">${filtered.length?filtered.map((r,i)=>{const item=title(r.titleId);const month=recordMonth(r);return `${i===0||recordMonth(filtered[i-1])!==month?`<h2 class="timeline-month">${recordDate(r)?new Intl.DateTimeFormat(locale(),{year:'numeric',month:'long'}).format(asDate(recordDate(r))):t('날짜 미기록','Date not recorded')}</h2>`:''}<article class="timeline-row"><div class="timeline-date">${dateText(recordDate(r))}${!r.watchedAt?`<small>${t('기록한 날','Added')}</small>`:''}</div><button class="timeline-cover" type="button" data-action="detail" data-id="${esc(r.id)}" aria-label="${esc(titleName(item))}">${image(item)}</button><div class="timeline-content"><p class="meta">${labelType(item.type)}${item.year?` · ${item.year}`:''}${recordEdition(r)?` · ${esc(recordEdition(r))}`:''}</p><h3><button type="button" class="title-link" data-action="detail" data-id="${esc(r.id)}">${esc(titleName(item))}</button></h3><span class="status-pill">${labelStatus(r.status,item.type)}</span>${recordContext(r,{timeOnly:true})}${hasNote(r.note)?`<p class="record-note">${esc(localized(r.note))}</p>`:''}${syncPill(r)}</div><div class="row-actions">${button(t('이어 적기','Edit note'),'edit','quiet',`data-id="${esc(r.id)}"`)}</div></article>`;}).join(''):empty(t('아직 여기에는 기록이 없어요.','No records here yet.'),isDevelopment()?t('다른 조건으로 찾아보세요.','Try another filter.'):t('다른 조건으로 찾아보거나 새로운 기록을 남겨보세요.','Try another filter or leave a new record.'),isDevelopment()?null:'record',t('기록 남기기','Leave a record'))}</div>`;
}
function empty(heading,desc,action,label) { return `<div class="empty-state">${icon('book')}<h2>${heading}</h2><p>${desc}</p>${action?button(label,action,'primary'):''}</div>`; }
function reportPage() {
 const count = state.records.length; const notes = state.records.filter(r=>hasNote(r.note)).length;
 return `<div class="page-heading"><div><a href="#records" class="text-link">← ${t('내 기록','My records')}</a><p class="eyebrow">${t('쌓아온 이야기','MY STORIES SO FAR')}</p><h1>${t('나의 기록 돌아보기','Your stories, revisited')}</h1><p class="lead">${t('기록한 만큼, 더 선명해진 시간.','Every little note brings a moment back.')}</p></div>${button(`${icon('download')}${t('리포트 카드 저장','Save report card')}`,'download-report','primary')}</div>${!count?empty(t('첫 기록이 리포트의 시작이에요.','One record starts your report.'),isDevelopment()?t('개발 계정에 기록이 생기면 여기서 돌아볼 수 있어요.','Records kept in your development account will appear here.'):t('영화나 책 하나부터 남겨보세요.','Start with a film or a book.'),isDevelopment()?null:'record',t('첫 기록 남기기','Leave your first record')):`<div class="report-grid"><section class="report-art"><p class="eyebrow">OTTLINE / ${t('나의 기록','MY RECORDS')}</p><h2>${t('내 취향의<br>작은 연대기.','A small chronicle<br>of your taste.')}</h2><div class="report-poster-wall">${state.records.slice(0,6).map(r=>image(title(r.titleId))).join('')}</div><p>${t('보고, 읽고, 마음에 남겨둔 것들.','Watched, read, and kept close.')}</p></section><div class="report-side"><section class="stat-card"><span>${t('남긴 기록','Records kept')}</span><strong>${count}</strong><p>${t('작품마다 하나씩, 나만의 기억.','A personal memory with every title.')}</p></section><section class="stat-card"><span>${t('마음을 남긴 메모','Notes written')}</span><strong>${notes}</strong></section><section class="panel report-bars"><h3>${t('어떤 이야기를 만났나요?','What stories found you?')}</h3>${['movie','series','book'].map(type=>{const n=state.records.filter(r=>title(r.titleId)?.type===type).length;return `<div class="report-bar"><span>${labelType(type)}</span><div class="progress-track"><div class="progress-fill" style="width:${n/count*100}%"></div></div><b>${n}</b></div>`;}).join('')}</section></div></div>`}`;
}
function shelfPage() {
 if(isDevelopment()) {
  const books=state.records.filter(r=>title(r.titleId)?.type==='book');
  return `<div class="page-heading"><div><a class="text-link" href="#records">← ${t('내 기록','My records')}</a><p class="eyebrow">${t('나의 서가','MY BOOKSHELF')}</p><h1>${t('한 권씩, 나의 서가','Your books, gathered')}</h1><p class="lead">${t('개발 기록에 남긴 책을 모았어요. 분류 정보는 아직 연결하지 않았어요.','Books kept in your development records. Classification is not connected yet.')}</p></div></div><section class="shelf-section"><div class="section-header"><h2>${t('분류를 기다리는 책','Books awaiting classification')}</h2><span class="meta">${books.length}${t('권',' books')}</span></div>${books.length?`<div class="shelf-grid">${books.map(posterCard).join('')}</div>`:empty(t('여기에 모인 책이 없어요.','No books gathered here yet.'),t('연결한 계정에 남긴 책이 이곳에 보여요.','Books from your connected account appear here.'))}</section>`;
 }
 if(state.lang!=='ko') return `<div class="page-heading"><h1>My books</h1></div>${empty('Your books are in My records.','The Korean classification shelf is available in Korean.','records','Open my records')}`;
 const categories=['총류','철학','종교','사회과학','자연과학','기술과학','예술','언어','문학','역사'];
 const books=state.records.filter(r=>title(r.titleId)?.type==='book');
 return `<div class="page-heading"><div><a class="text-link" href="#records">← 내 기록</a><p class="eyebrow">나의 서가</p><h1>한 권씩, 나의 서가</h1><p class="lead">남겨둔 책을 한국십진분류 순서로 모았어요.</p></div></div>${categories.map((label,index)=>{const items=books.filter(r=>title(r.titleId).kdc===index);return `<section class="shelf-section"><div class="section-header"><h2><span class="shelf-number">${index}</span> ${label}</h2><span class="meta">${items.length}권</span></div>${items.length?`<div class="shelf-grid">${items.map(posterCard).join('')}</div>`:`<p class="shelf-empty">아직 이 칸에 남긴 책이 없어요.</p>`}</section>`;}).join('')}`;
}
function togetherPage() {
 if(isDevelopment())return `<div class="page-heading"><div><p class="eyebrow">${t('함께 나누는 이야기','STORIES, SHARED')}</p><h1>${t('같은 이야기, 다른 마음','Same story, different feelings')}</h1></div></div>${empty(t('함께 화면은 아직 연결하지 않았어요.','Together is not connected yet.'),t('지금은 내 기록으로 A 시안을 살펴볼 수 있어요.','For now, explore A with your own records.'),'records',t('내 기록 보기','Open my records'))}`;
 return `<div class="page-heading"><div><p class="eyebrow">${t('함께 나누는 이야기','STORIES, SHARED')}</p><h1>${t('같은 이야기, 다른 마음','Same story, different feelings')}</h1><p class="lead">${t('누군가의 한 줄에서, 놓쳤던 장면을 발견해요.','Find a scene you missed in someone else’s words.')}</p></div><span class="private-note">${icon('lock')}${t('내 기록은 직접 공개할 때만 보여요.','Your records stay private until you share.')}</span></div><div class="community-grid">${state.publicPosts.map(post=>{const item=title(post.titleId);return `<article class="community-card">${image(item,'community-cover')}<div class="community-content"><p class="meta">${labelType(item.type)} · ${item.year}</p><h2>${esc(titleName(item))}</h2>${hasNote(post.note)?`<blockquote>“${esc(localized(post.note))}”</blockquote>`:''}<div class="community-author"><span>${icon('together')}${t('공개된 기록','Shared record')}</span><span>${dateText(post.date)}</span></div>${button(`${icon('heart')}${post.likes ?? 0}`,'like','quiet',`data-id="${esc(post.id)}" aria-label="${esc(titleName(item))} ${t('공감하기','like')}" aria-pressed="${!!post.liked}"`)}${button(t('나도 기록하기','Keep my own record'),'select-title','quiet',`data-id="${esc(item.id)}"`)}</div></article>`;}).join('')}</div>`;
}
function codeCard() { return `<div class="code-block"><p class="code-label">${t('기록 연결 코드','Record connection code')}</p><div class="code-display" data-testid="own-code">${groupedCode(state.ownCode)}</div><p>${t('다른 기기에서 이 코드를 입력하면<br>같은 기록을 이어볼 수 있어요.','Enter this code on another device<br>to open these same records.')}</p><div class="code-actions">${button(t('코드 복사','Copy code'),'copy-code','secondary','data-testid="copy-code"')}${button(`${icon('download')}${t('보관 카드 저장','Save recovery card')}`,'download-code','secondary','data-testid="download-code"')}</div><p class="hint">${state.codeSaved?t('보관 카드를 만들었어요. 개인 보관함에 저장해 주세요.','Recovery card created. Keep it somewhere private.'):t('코드는 내 기록을 여는 열쇠예요. 나만 볼 수 있는 곳에 보관해 주세요.','This code opens your records. Keep it somewhere only you can access.')}</p></div>`; }
function spacePage() {
 if(isDevelopment())return developmentSpace();
 return `<div class="page-heading"><div><p class="eyebrow">${t('나의 공간','MY SPACE')}</p><h1>${t('어디서든, 나의 기록','Your records, wherever you are')}</h1><p class="lead">${t('계정을 외우는 대신, 내 기록을 이어가는 방법.','A simple way to carry your records with you.')}</p></div></div>${state.restorePending?`<div class="notice" role="status"><strong>${t('연결은 됐어요. 기록 불러오기를 마저 진행해 주세요.','You are connected. Finish bringing your records here.')}</strong><p>${t('아직 모든 기록을 이 기기에 불러오지 못했어요.','Not all records have been loaded on this device yet.')}</p>${button(t('기록 불러오기 계속','Continue loading records'),'resume-restore','secondary','data-testid="resume-restore"')}</div>`:''}<div class="space-grid"><section class="panel connection-panel"><div class="panel-heading">${icon('link')}<h2>${t('내 기록 이어보기','Keep your records with you')}</h2></div>${state.connected?codeCard():`<p>${t('첫 기록이 서버와 동기화되면 연결 코드가 생겨요.','Your connection code appears after your first record syncs.')}</p>${button(t('첫 기록 남기기','Leave your first record'),'record','primary')}`}<div class="panel-divider"></div><h3>${t('다른 기기에 기록이 있나요?','Have records on another device?')}</h3><p>${t('그 기기의 연결 코드를 입력해 여기서 이어보세요.','Enter that device’s connection code to bring them here.')}</p>${button(`${t('기록 연결 코드 입력','Enter a connection code')}${icon('arrow')}`,'connect','secondary','data-testid="connect-entry"')}</section><div class="space-side"><section class="panel"><div class="panel-heading">${icon('cloud')}<h2>${t('기록 보관 상태','Record storage')}</h2></div><strong>${state.restorePending?t('연결됨 · 기록 불러오기 대기','Connected · records waiting to load'):pendingCount()?t(`${pendingCount()}개 동기화 대기`,`${pendingCount()} waiting to sync`):state.records.length?t('서버 동기화 완료','Synced to server'):t('아직 남긴 기록이 없어요','No records yet')}</strong><p>${pendingCount()?t('이 기기에 저장됐어요. 동기화 후 코드로 다른 기기에서 열 수 있어요.','Saved on this device. Sync before opening them on another device.'):t('기록 연결 코드로 동기화된 기록을 불러올 수 있어요.','Your code can restore records that have synced.')}</p>${pendingCount()?button(t('동기화 다시 시도','Retry sync'),'sync','secondary','data-testid="sync-retry"'):''}</section><section class="panel"><h2>${t('연결된 기기','Connected devices')}</h2>${state.connected?`<div class="device-row">${icon('space')}<div><strong>${t('지금 사용하는 기기','This device')}</strong><p>${t('현재 연결됨','Connected now')}</p></div><span class="status-pill">${t('현재','Current')}</span></div>`:`<p>${t('아직 연결된 기기가 없어요. 첫 기록을 동기화하거나 기존 코드를 입력해 주세요.','No device is connected yet. Sync your first record or enter an existing code.')}</p>`}${state.connected&&state.deviceCount>1?`<div class="device-row">${icon('space')}<div><strong>${t('이전에 연결한 기기','Previously connected device')}</strong><p>${t('같은 기록을 함께 사용해요','Uses the same records')}</p></div></div>`:''}</section></div></div><section class="panel settings-panel"><h2>${t('나의 프로필','My profile')}</h2><p>${state.nickname?esc(state.nickname):t('나의 기록에 작은 이름을 붙여보세요.','Give your personal records a little name.')}</p><p class="hint">${t('닉네임은 내 화면에서만 보여요. 함께 화면에는 공개되지 않아요.','Your nickname appears only on your own screens. It is not shown in Together.')}</p>${button(t('닉네임 수정','Edit nickname'),'profile','secondary','data-testid="profile-edit"')}</section><section class="panel settings-panel"><h2>${t('나에게 맞게','Make it yours')}</h2><div class="settings-list">${button(`${t('화면 테마','Appearance')}<span>${state.theme==='light'?t('라이트','Light'):t('다크','Dark')}${icon('arrow')}</span>`,'theme','quiet')}${button(`${t('언어','Language')}<span>${state.lang==='ko'?'한국어':'English'}${icon('arrow')}</span>`,'language','quiet')}${button(`${t('내 기록 내보내기','Export my records')}<span>CSV ${icon('download')}</span>`,'export','quiet')}${button(`${t('코드를 잃어버렸어요','I lost my code')}${icon('arrow')}`,'lost-code','quiet')}</div></section>`;
}
function detailPage(id) {
 const r=record(id); if(!r) return empty(t('이 기록을 찾지 못했어요.','Record not found.'),'','records',t('내 기록 보기','My records'));
 const item=title(r.titleId);
 const isPublic=state.publicPosts.some(post=>post.sourceRecordId===r.id);
 return `<a href="#records" class="text-link">← ${t('내 기록','My records')}</a><section class="detail-page"><div class="detail-art">${image(item)}</div><div class="detail-copy"><p class="eyebrow">${labelType(item.type)} · ${item.year}</p><h1>${esc(titleName(item))}</h1><p class="lead">${esc(localized(item.creator))}</p><span class="status-pill">${labelStatus(r.status,item.type)}</span>${recordEdition(r)?`<p class="meta record-edition">${esc(recordEdition(r))}</p>`:''}${detailContext(r)}<p class="detail-note">${esc(localized(r.note))||t('이 작품은 어떤 기억으로 남았나요?','What will you remember about this one?')}</p>${r.rating?`<p class="meta" aria-label="${t('별점','Rating')}">${isDevelopment()?`★ ${r.rating} / 5`:'★'.repeat(r.rating)}</p>`:''}${syncPill(r)}<div class="form-actions">${button(t('기록 수정하기','Edit this record'),'edit','primary',`data-id="${esc(r.id)}"`)}${button(isPublic?t('나눈 기록에도 반영하기','Update shared note'):t('함께 나누기','Share to Together'),'publish','secondary',`data-id="${esc(r.id)}"`)}</div><p class="hint" data-testid="publication-status">${isDevelopment()?t('개발 서버에서 불러온 기록이에요. 여기서는 읽기만 해요.','This record comes from your development server. It is read only here.'):isPublic?t('함께 화면에 나눈 기록이에요. 고친 내용은 ‘나눈 기록에도 반영하기’로 전할 수 있어요.','You shared this record in Together. Choose Update shared note to share your latest changes.'):t('공개하기 전까지 내 기록은 나에게만 보여요.','Only you can see this record until you share it.')}</p></div></section>`;
}
function pageContent() {
 if(isDevelopment()&&state.development.phase!=='ready')return developmentGate();
 if(isDevelopment()&&!state.records.length&&state.route==='home')return `${developmentStatus()}<div class="page-heading"><h1>${t('나의 아카이브','Your archive')}</h1></div>${empty(t('아직 남긴 기록이 없어요.','No records kept yet.'),t('이 개발 계정에 남긴 기록이 이곳에 보여요.','Records kept in this development account appear here.'))}`;
 const content=state.route.startsWith('title/')?detailPage(state.route.slice(6)):({home:homePage,records:recordsPage,together:togetherPage,space:spacePage,report:reportPage,shelf:shelfPage})[state.route]?.()||homePage();
 return `${isDevelopment()&&state.route!=='space'?developmentStatus():''}${content}`;
}

function openModal(kind) {
 state.lastFocus = document.activeElement;
 state.modal=kind; renderDialog(); $('#dialog').showModal();
 focusDialog();
}
function focusDialog() {
 // Keep the whole recording sheet visible until a phone user chooses a field.
 const target=['status','edit'].includes(state.modal)?$('#dialog-title'):$('#dialog input:not([type=hidden]), #dialog textarea, #dialog button:not(.dialog-close)');
 target?.focus({preventScroll:true});
}
function closeModal() {
 cancelOperation();
 $('#dialog').close(); state.modal=null;state.entryDraft=null;state.tpoError='';
 if(state.lastFocus?.isConnected) state.lastFocus.focus(); else $('#main')?.focus();
}
function dialogFrame(titleText,subtitle,body,foot='') {
 return `<div class="dialog-head"><div><p class="eyebrow">OTTLINE</p><h2 id="dialog-title" class="dialog-title" tabindex="-1" ${['status','edit'].includes(state.modal)?'autofocus':''}>${titleText}</h2>${subtitle?`<p class="dialog-subtitle">${subtitle}</p>`:''}</div>${button(icon('close'),'close','dialog-close icon-button',`aria-label="${t('닫기','Close')}"`)}</div><div class="dialog-body">${body}</div>${foot?`<div class="dialog-foot">${foot}</div>`:''}`;
}
function searchResults() {
 const matches=catalog.filter(item=>(state.searchType==='all'||item.type===state.searchType)&&`${localized(item.title)} ${localized(item.creator)}`.toLowerCase().includes(state.search.toLowerCase()));
 return matches.length?matches.map(item=>`<button type="button" class="search-result" data-action="select-title" data-id="${esc(item.id)}" data-testid="search-result">${image(item,'result-cover')}<span class="result-copy"><strong>${esc(titleName(item))}</strong><small>${labelType(item.type)} · ${item.year} · ${esc(localized(item.creator))}</small></span><span class="result-arrow">${icon('arrow')}</span></button>`).join(''):`<div class="empty-state"><p>${t('이 이름의 작품은 없어요. 다른 검색어로 찾아보세요.','No titles found. Try another search.')}</p></div>`;
}
function renderDialog() {
 let html=''; const item=title(state.selectedId);
 if(state.modal==='development-connect')html=developmentConnectionDialog();
 if(state.modal==='profile') html=dialogFrame(t('나의 기록에 이름 붙이기','A name for your records'),t('내 화면에서만 보이는 닉네임이에요.','This nickname is only for your own screens.'),`<div class="field"><label for="nickname">${t('닉네임','Nickname')}</label><input id="nickname" name="nickname" maxlength="32" autocomplete="off" value="${esc(state.nickname)}" placeholder="${t('예: 이야기 수집가','e.g. Story keeper')}" data-testid="nickname-input"><p class="hint">${t('최대 32자. 비워 두어도 괜찮아요.','Up to 32 characters. You can leave this blank.')}</p></div>`,button(t('닉네임 저장','Save nickname'),'save-profile','primary','data-testid="save-profile"'));
 if(state.modal==='search') html=dialogFrame(t('오늘은 어떤 이야기를 남길까요?','What story will you keep today?'),t('영상도 책도, 제목부터 가볍게 찾아요.','Start with the title. Films, series, and books belong here.'),`<label class="search-field">${icon('search')}<input autofocus data-control="title-search" data-testid="title-search" value="${esc(state.search)}" placeholder="${t('작품 제목 검색','Search for a title')}" aria-label="${t('작품 제목 검색','Search for a title')}"></label><div class="filter-chips">${['all','movie','series','book'].map(v=>button(v==='all'?t('전체','All'):labelType(v),'search-type','',`data-value="${v}" aria-pressed="${state.searchType===v}"`)).join('')}</div><div id="search-results" class="search-results">${searchResults()}</div>`);
 if(state.modal==='status'&&item) html=dialogFrame(t('어떤 순간으로 남겨둘까요?','How would you like to keep this title?'),t('그날의 맥락을 남기고, 상태를 눌러 저장해요.','Keep the context, then choose a status to save.'),`<div class="selected-title">${image(item,'dialog-cover')}<div><p class="meta">${labelType(item.type)} · ${item.year}</p><h3>${esc(titleName(item))}</h3><p>${esc(localized(item.creator))}</p></div></div>${tpoEditor()}<p class="hint">${t('보고·읽고 싶은 작품은 감상 맥락을 새로 저장하지 않아요. 기존 맥락은 그대로 남아요.','For a title saved for later, no new time, place, or occasion is added. Existing context stays.')}</p>`,`<div class="status-choices">${['DONE','IN_PROGRESS','WISHLIST'].map(v=>button(`${icon(v==='DONE'?'check':v==='IN_PROGRESS'?'book':'clock')}<strong>${labelStatus(v,item.type)}</strong>`,'save-status',v==='DONE'?'primary status-choice':'secondary status-choice',`data-value="${v}" data-testid="save-${v}"`)).join('')}</div>`);
 if(state.modal==='saved') {const r=record(state.savedId);html=dialogFrame(t('한 페이지가 더 쌓였어요.','One more moment, kept.'),t('기록은 끝났어요. 더 남기고 싶을 때 이어 적어요.','Your record is saved. Add a little more only if you want.'),`<div class="save-confirmation"><span class="success-mark">${icon('check')}</span><h3>${esc(titleName(title(r?.titleId)))}</h3><div class="saved-context" data-testid="saved-context">${recordContext(r,{modifier:'saved'})||`<p class="hint">${t('그날의 맥락은 나중에 더해도 괜찮아요.','You can add the context another time.')}</p>`}</div>${syncPill(r)}</div>${!state.codeSaved?`<div class="notice"><div><strong>${t('다른 기기에서도 이어보세요.','Keep this with you on another device.')}</strong><p>${state.connected?t('내 공간의 연결 코드를 보관해 두면 다시 찾을 수 있어요.','Keep the connection code in My space to find your records again.'):t('서버와 동기화되면 연결 코드를 보관할 수 있어요.','After syncing, you can save a connection code.')}</p></div>${button(t('코드 보관하기','Keep my code'),'show-code','quiet')}</div>`:''}`,`${button(t('맥락·감상 더 남기기','Add context or a note'),'edit-saved','secondary')}${button(t('내 기록에서 보기','See my records'),'saved-done','primary','data-testid="saved-done"')}`);}
 if(state.modal==='edit') {const r=record(state.savedId);const current=title(r?.titleId),draft=state.entryDraft;html=dialogFrame(t('그날의 맥락과 마음을 남겨요.','Keep the moment and the feeling.'),esc(titleName(current)),`<form id="edit-form">${tpoEditor({editing:true})}<div class="field"><label for="note">${t('나의 메모','My note')}</label><textarea id="note" name="note" rows="4" maxlength="2000" placeholder="${t('기억하고 싶은 장면이나 한 줄','A scene or a thought to remember')}" data-control="edit-note" data-testid="note-input">${esc(localized(draft.note))}</textarea></div><div class="details-grid"><div class="field"><label for="rating">${t('별점','Rating')}</label><select id="rating" name="rating" data-control="edit-rating">${[0,1,2,3,4,5].map(v=>`<option value="${v}" ${Number(draft.rating||0)===v?'selected':''}>${v?'★'.repeat(v):t('별점 없이','No rating')}</option>`).join('')}</select></div><div class="field"><label for="edit-status">${t('지금 상태','Current status')}</label><select id="edit-status" name="status" data-control="edit-status" data-testid="edit-status">${['DONE','IN_PROGRESS','WISHLIST'].map(v=>`<option value="${v}" ${draft.status===v?'selected':''}>${labelStatus(v,current?.type)}</option>`).join('')}</select></div></div></form>`,`${button(t('이대로 남기기','Keep this record'),'save-edit','primary','data-testid="save-edit"')}${button(t('나중에 할게요','Maybe later'),'close','quiet')}`);}
 if(state.modal==='code') html=dialogFrame(t('내 기록을 여는 작은 열쇠','A little key to your records'),'',state.connected?codeCard():`<div class="notice"><p>${t('아직 서버에 연결되지 않았어요. 이 기기의 기록을 먼저 동기화해 주세요.','Not connected to the server yet. Sync this device’s records first.')}</p>${button(t('동기화 다시 시도','Retry sync'),'sync','primary')}</div>`);
 if(state.modal==='connect') html=connectionDialog();
 if(state.modal==='lost') html=dialogFrame(t('연결 코드를 잃어버렸나요?','Lost your connection code?'),'',`<ol class="checklist"><li>${t('기록이 남아 있는 다른 기기에서 내 공간을 열어보세요.','Open My space on a device that still has your records.')}</li><li>${t('저장해 둔 보관 카드나 개인 메모에서 코드를 찾아보세요.','Look for a saved recovery card or a private note with your code.')}</li></ol><div class="notice"><p>${t('코드와 연결된 기기를 모두 잃었다면 기록을 되찾을 수 없어요. 이메일이나 전화번호를 수집하지 않아 다른 복구 방법은 제공하지 않아요.','If you have lost both the code and every connected device, the records cannot be recovered. We do not collect email addresses or phone numbers for recovery.')}</p></div>`,button(t('알겠어요','Got it'),'close','primary'));
 if(state.modal==='publish') {const r=record(state.savedId);html=dialogFrame(t('이 기록을 함께 나눌까요?','Share this record with others?'),esc(titleName(title(r?.titleId))),`<div class="notice"><p>${t('작품과 메모가 함께 화면에 공개돼요. 장소·상황과 기록 연결 코드는 공개되지 않아요.','The title and note will appear in Together. Your place, occasion, and connection code stay private.')}</p></div><p id="publish-error" class="field-error" role="alert">${esc(state.publishError)}</p>${hasNote(r?.note)?`<blockquote class="publish-note">${esc(localized(r.note))}</blockquote>`:`<p class="publish-without-note" data-testid="publish-without-note">${t('메모 없이 작품만 나눠요.','Share the title without a note.')}</p>`}`,`${button(t('공개할게요','Share this record'),'confirm-publish','primary','data-testid="confirm-publish"')}${button(t('나만 볼게요','Keep it private'),'close','secondary')}`);}
 $('#dialog').innerHTML=html;
}
function connectionDialog() {
 const heading=t('내 기록 이어보기','Bring my records here');
 if(state.connectionStep==='input') return dialogFrame(heading,t('기록이 있는 기기의 내 공간에서 코드를 확인하세요.','Find the code in My space on the device with your records.'),`<form id="connection-form"><div class="field"><label for="connection-code">${t('기록 연결 코드','Record connection code')}</label><input id="connection-code" class="code-input" name="code" data-control="code" data-testid="connection-code" value="${esc(state.connectionInput)}" placeholder="ABCD EFGH" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="code-help code-error"><p id="code-help" class="hint">${t('8자리 영문·숫자예요. 복사한 코드를 그대로 붙여넣어도 돼요.','8 letters and numbers. You can paste the whole code.')}</p><p id="code-error" class="field-error" role="alert">${esc(state.connectionError)}</p></div>${button(t('내 기록 연결하기','Connect my records'),'submit-code','primary','data-testid="connect-submit"')}</form>${button(t('코드를 찾을 수 없어요','I cannot find my code'),'lost-code','quiet')}`);
 if(state.connectionStep==='pending') return dialogFrame(t('이 기기의 기록부터 보관해요.','Keep this device’s records first.'),'',`<div class="notice"><p>${t('아직 서버로 보내지 못한 기록이 있어요. 먼저 동기화를 마친 뒤 기록을 연결해 주세요.','Some records have not reached the server. Sync them before connecting your records.')}</p></div><p class="field-error" role="alert">${esc(state.connectionError)}</p>`,`${button(t('동기화하고 계속','Sync and continue'),'sync-connect','primary','data-testid="sync-before-merge"')}${button(t('나중에 연결하기','Connect later'),'close','secondary')}`);
 if(state.connectionStep==='merge') return dialogFrame(t('두 기기의 기록을 하나로 모을까요?','Bring both sets of records together?'),'',`<div class="merge-summary"><div><strong>${state.records.length}</strong><span>${t('이 기기의 기록',state.records.length===1?'record on this device':'records on this device')}</span></div>${icon('plus')}<div><strong>${(demoAccounts.get(state.connectionTarget)||[]).length}</strong><span>${t('연결할 기록',(demoAccounts.get(state.connectionTarget)||[]).length===1?'record to connect':'records to connect')}</span></div></div><ul class="checklist"><li>${t('같은 작품은 더 최근에 고친 기록이 남아요. 예전 내용 일부는 사라질 수 있어요.','For the same title, we keep the more recently edited record. Some earlier details may be lost.')}</li><li>${t('이 기기의 이전 연결 코드는 더 이상 사용할 수 없어요.','This device’s previous connection code will no longer work.')}</li><li>${t('이전 코드로 연결된 다른 기기는 새 코드로 다시 연결해야 해요.','Other devices using the previous code will need to reconnect with the new code.')}</li></ul><p class="hint">${t('한번 합친 기록은 다시 나눌 수 없어요.','Once merged, the records cannot be separated.')}</p>`,`${button(t('기록 합치고 이어보기','Merge and continue'),'confirm-merge','primary','data-testid="confirm-merge"')}${button(t('취소','Cancel'),'close','secondary')}`);
 if(state.connectionStep==='loading') return dialogFrame(t('기록을 불러오고 있어요.','Bringing your records here.'),'',`<div class="restore-loading" role="status"><span class="restore-spinner"></span><p>${t('연결된 기록을 확인하고 있어요.','Checking your connected records.')}</p></div>`);
 if(state.connectionStep==='error') return dialogFrame(t('연결됐지만, 기록을 다 불러오지 못했어요.','Connected, but not all records loaded.'),'',`<div class="notice error" role="alert"><p>${esc(state.connectionError)||t('기존 기록은 남아 있어요. 불러오기를 다시 시도해 주세요.','Your existing records are still here. Try loading them again.')}</p></div>`,`${button(t('불러오기 다시 시도','Retry loading'),'retry-restore','primary','data-testid="restore-retry"')}${button(t('나중에 할게요','Maybe later'),'close','secondary')}`);
 return dialogFrame(t('기록이 다시, 내 곁에.','Your records are here again.'),'',`<div class="save-confirmation"><span class="success-mark">${icon('check')}</span><h3>${t(`${state.records.length}개의 기록을 불러왔어요.`,`${state.records.length} ${state.records.length===1?'record is':'records are'} ready.`)}</h3><p>${t('앞으로 남기는 기록도 이 코드로 이어져요.','Future records will stay connected with this code.')}</p><div class="code-display">${groupedCode(state.ownCode)}</div></div>`,button(t('내 기록으로 가기','Open my records'),'connected-done','primary','data-testid="connected-done"'));
}

let toastTimer;
function toast(message) { const node=$('#toast');node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,4200); }
function go(route) { state.route=route;if(location.hash===`#${route}`){render();}else location.hash=route;window.scrollTo({top:0,behavior:'instant'}); }
function setModal(kind) { if($('#dialog').open){state.modal=kind;renderDialog();focusDialog();}else openModal(kind); }
function startRecord() {state.search='';state.searchType='all';state.selectedId=null;state.entryDraft=null;setModal('search');}
function beginConnect() {state.connectionStep='input';state.connectionInput='';state.connectionError='';setModal('connect');}
function commitConnection() {
 if(state.restorePending)return;
 const target=state.connectionTarget;
 const incoming=demoAccounts.get(target);
 if(!incoming)return;
 const sourceCode=state.ownCode;
 if(sourceCode!==target && state.records.length) {
  const source=newestRecords(demoAccounts.get(sourceCode)||[],state.records.filter(r=>r.syncStatus==='synced'));
  demoAccounts.set(target,newestRecords(source,incoming));
  demoAccounts.delete(sourceCode);
 }
 state.ownCode=target;state.connected=true;state.deviceCount=2;state.restorePending=true;
}
function finishRestoration() {
 state.records=clone(demoAccounts.get(state.connectionTarget)||[]);
 state.ownCode=state.connectionTarget;state.connected=true;state.deviceCount=2;state.restorePending=false;
}
function saveStatus(status) {
 if(!state.selectedId || state.busy) return;
 const existing=state.records.find(r=>r.titleId===state.selectedId);
 const context=readDraftContext(status,existing);if(!context)return;
 const now=new Date(Math.max(Date.now(),(Date.parse(existing?.updatedAt)||0)+1)).toISOString();
 const r={...(existing||{}),id:existing?.id||`local-${randomId()}`,titleId:state.selectedId,status,...context,createdAt:existing?.createdAt||existing?.watchedAt||now,updatedAt:now,note:existing?.note||{ko:'',en:''},rating:existing?.rating||null,syncStatus:savedSyncStatus()};
 if(existing)state.records=state.records.map(current=>current.id===existing.id?r:current);else state.records.unshift(r);
 state.savedId=r.id;persistSyncedRecords();render();setModal('saved');
}
function syncRecords(forConnection=false) {
 if(state.busy)return;
 if(!state.online) {
  const message=t('지금은 오프라인이에요. 연결을 복구한 뒤 다시 시도해 주세요.','You are offline. Reconnect, then try again.');
  if(forConnection){state.connectionError=message;renderDialog();}else toast(message);
  return;
 }
 const generation=++operationGeneration;
 state.busy=true;
 const trigger=document.activeElement;if(trigger instanceof HTMLButtonElement)trigger.disabled=true;
 setTimeout(()=>{
  if(generation!==operationGeneration)return;
  state.records=state.records.map(r=>({...r,syncStatus:'synced'}));persistSyncedRecords();state.busy=false;state.syncFailedOnce=true;render();
  if(forConnection && state.modal==='connect') {
   state.connectionError='';
   if(state.restorePending || !state.records.length)restoreRecords();
   else {state.connectionStep='merge';renderDialog();}
  } else {if(state.modal)renderDialog();toast(t('모든 기록이 서버와 동기화됐어요.','All records are now synced to the server.'));}
 },500);
}
function submitCode() {
 if(state.busy)return;
 const code=state.connectionInput.replace(/[\s-]/g,'').toUpperCase();state.connectionInput=groupedCode(code);state.connectionError='';
 if(code.length!==8 || !/^[A-Z2-9]{8}$/.test(code)){state.connectionError=t('영문·숫자 8자리를 확인해 주세요.','Check that your code has 8 letters and numbers.');renderDialog();$('#connection-code')?.focus();return;}
 if(!state.online){state.connectionError=t('오프라인에서는 코드를 확인할 수 없어요. 연결을 복구한 뒤 다시 시도해 주세요.','Codes cannot be checked offline. Reconnect, then try again.');renderDialog();$('#connection-code')?.focus();return;}
 if(!demoAccounts.has(code)){state.connectionError=t('코드를 찾지 못했어요. 입력한 코드를 다시 확인해 주세요.','We could not find that code. Please check it and try again.');renderDialog();$('#connection-code')?.focus();return;}
 if(state.restorePending && code!==state.connectionTarget){state.connectionError=t('먼저 연결된 기록의 불러오기를 마쳐 주세요.','Finish loading the connected records first.');renderDialog();return;}
 state.connectionTarget=code;
 if(state.connected && state.ownCode===code){if(state.restorePending)restoreRecords();else{state.connectionStep='done';renderDialog();}return;}
 if(pendingCount()){state.connectionStep='pending';renderDialog();return;}
 if(state.records.length){state.connectionStep='merge';renderDialog();return;}
 restoreRecords();
}
function restoreRecords() {
 if(state.busy)return;
 if(!state.online) {
  state.connectionError=t('오프라인에서는 기록을 불러올 수 없어요. 연결을 복구한 뒤 다시 시도해 주세요.','Records cannot be loaded offline. Reconnect, then retry.');
  state.connectionStep=state.restorePending?'error':'input';renderDialog();return;
 }
 if(!demoAccounts.has(state.connectionTarget)){state.connectionStep='input';state.connectionError=t('이 코드는 더 이상 연결할 수 없어요. 현재 기기의 코드를 확인해 주세요.','This code is no longer available. Check the code on your current device.');renderDialog();return;}
 const generation=++operationGeneration;
 // Pairing may commit a merge before local restoration. Retries keep this target and do not merge twice.
 commitConnection();
 state.busy=true;state.connectionStep='loading';state.connectionError='';render();renderDialog();
 setTimeout(()=>{
  if(generation!==operationGeneration)return;
  state.busy=false;
  if(state.scenario==='restore-error'&&!state.restoreFailedOnce){state.restoreFailedOnce=true;state.connectionStep='error';render();renderDialog();return;}
  finishRestoration();state.connectionStep='done';render();renderDialog();
 },850);
}
function download(blob,filename) {const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function canvasBase(height=700) { const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=height;const ctx=canvas.getContext('2d');ctx.fillStyle='#F8F6F2';ctx.fillRect(0,0,1080,height);ctx.fillStyle='#1E4D8C';ctx.font='700 64px sans-serif';ctx.fillText('ottline',70,110);ctx.fillStyle='#FF9933';ctx.font='600 18px sans-serif';ctx.fillText('ON THE TIMELINE',74,142);return{canvas,ctx}; }
function downloadCode(){
 const{canvas,ctx}=canvasBase();ctx.fillStyle='#0F0F0F';ctx.font='600 32px sans-serif';ctx.fillText(t('나의 기록 연결 코드','My record connection code'),70,240);ctx.font='600 82px monospace';ctx.fillText(groupedCode(state.ownCode),70,365);ctx.fillStyle='#4A4A4A';ctx.font='24px sans-serif';ctx.fillText(t('새 기기의 내 공간에서 이 코드를 입력하세요.','Enter this code in My space on a new device.'),70,450);ctx.fillText(t('이 코드를 아는 사람은 내 기록을 열 수 있어요.','Anyone with this code can open your records.'),70,500);ctx.fillText(t('나만 볼 수 있는 곳에 보관해 주세요.','Keep this card somewhere private.'),70,540);ctx.font='18px sans-serif';ctx.fillText(t('디자인 시안용 샘플 코드 · 실제 계정에는 쓸 수 없어요.','Design preview sample code · not a real account.'),70,640);
 canvas.toBlob(blob=>{if(blob){download(blob,'ottline-preview-recovery-card.png');state.codeSaved=true;render();if(state.modal)renderDialog();toast(t('보관 카드를 만들었어요. 다운로드한 이미지를 확인해 주세요.','Recovery card created. Check your downloaded image.'));}},'image/png');
}
async function downloadReport(){
 const records=clone(state.records), lang=state.lang;
 const tr=(ko,en)=>lang==='ko'?ko:en;
 const local=value=>typeof value==='object'&&value!==null?value[lang]||value.ko||value.en||'':value||'';
 await document.fonts.ready;
 const artwork=await Promise.all(records.slice(0,6).map(async r=>{
  const item=title(r.titleId), img=new Image();img.src=cover(item);
  try{await img.decode();return{r,item,img};}catch{return{r,item,img:null};}
 }));
 const {canvas,ctx}=canvasBase(1920);
 ctx.fillStyle='#0F0F0F';ctx.font='600 48px "Pretendard Variable", sans-serif';
 ctx.fillText(tr('나의 기록 돌아보기','My stories, revisited'),70,260);
 ctx.font='600 108px "Pretendard Variable", sans-serif';ctx.fillText(String(records.length),70,405);
 const countWidth=ctx.measureText(String(records.length)).width;
 ctx.fillStyle='#4A4A4A';ctx.font='28px "Pretendard Variable", sans-serif';ctx.fillText(tr('개의 소중한 기록',records.length===1?'moment kept':'moments kept'),90+countWidth,400);
 ctx.font='26px "Pretendard Variable", sans-serif';ctx.fillText(tr('보고, 읽고, 마음에 남겨둔 것들.','Watched, read, and kept close.'),70,467);
 const fit=(text,width)=>{let value=text;while(value&&ctx.measureText(value).width>width)value=value.slice(0,-1);return value===text?value:value.slice(0,-1)+'…';};
 artwork.forEach(({r,item,img},index)=>{
  const x=70+(index%3)*320,y=535+Math.floor(index/3)*570,w=288,h=432;
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,8);ctx.clip();ctx.fillStyle='#ECEBE9';ctx.fillRect(x,y,w,h);
  if(img){const scale=Math.max(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*scale)/2,y+(h-img.height*scale)/2,img.width*scale,img.height*scale);}
  ctx.restore();ctx.fillStyle='#0F0F0F';ctx.font='600 29px "Pretendard Variable", sans-serif';ctx.fillText(fit(local(item.title),w),x,y+h+45);
  ctx.fillStyle='#4A4A4A';ctx.font='23px "Pretendard Variable", sans-serif';
  const date=new Intl.DateTimeFormat(lang==='ko'?'ko-KR':'en-US',{month:'short',day:'numeric'}).format(asDate(recordDate(r)));
  ctx.fillText(r.watchedAt?date:`${tr('기록한 날 · ','Added ')}${date}`,x,y+h+82);
 });
 ctx.strokeStyle='#ECEBE9';ctx.beginPath();ctx.moveTo(70,1765);ctx.lineTo(1010,1765);ctx.stroke();
 ctx.fillStyle='#4A4A4A';ctx.font='21px "Pretendard Variable", sans-serif';
 ctx.fillText(tr('OTTLINE 2.0 시안 · 가상 작품과 샘플 기록','OTTLINE 2.0 preview · fictional titles and sample records'),70,1820);
 canvas.toBlob(blob=>{if(blob)download(blob,'ottline-preview-report.png');},'image/png');
}
function exportCSV(){const cell=v=>{const raw=String(v??'');const safe=/^[=+@\-\t\r]/.test(raw)?`'${raw}`:raw;return `"${safe.replaceAll('"','""')}"`;};const rows=[['title','type','status','date','place','occasion','note','rating'],...state.records.map(r=>[titleName(title(r.titleId)),title(r.titleId).type,r.status,r.watchedAt||'',r.place||'',r.occasion||'',localized(r.note),r.rating])];download(new Blob(['\uFEFF',rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),isDevelopment()?'ottline-development-records.csv':'ottline-preview-records.csv');}

async function handleAction(action,node) {
 if(isDevelopment()) {
  if(developmentHiddenActions.has(action)||['edit','select-title','record'].includes(action))return;
  if(action==='development-connect'){state.development.code='';state.development.error='';setModal('development-connect');return;}
  if(action==='development-submit'){
   if(state.development.phase==='loading')return;
   const code=state.development.code.replace(/\s/g,'').toUpperCase();
   if(!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)){state.development.error='INVALID_CODE';renderDialog();$('#development-code')?.focus();return;}
   await loadDevelopment({code});return;
  }
  if(action==='development-refresh'){await loadDevelopment();return;}
  if(action==='development-disconnect'){await disconnectDevelopment();return;}
 }
 switch(action) {
  case 'studio-toggle':state.studioExpanded=!state.studioExpanded;studio();$('[data-testid="studio-toggle"]')?.focus();break;
  case 'language':state.lang=state.lang==='ko'?'en':'ko';render();if(state.modal)renderDialog();break;
  case 'theme':state.theme=state.theme==='light'?'dark':'light';render();break;
  case 'reset':if($('#dialog').open)closeModal();initScenario({resetAccounts:true});render();toast(t('샘플을 처음 상태로 돌렸어요.','Sample data reset.'));break;
  case 'record':startRecord();break;
  case 'profile':setModal('profile');break;
  case 'save-profile':state.nickname=$('#nickname').value.trim().slice(0,32);closeModal();render();toast(t('내 프로필을 바꿨어요.','Your profile is updated.'));break;
  case 'close':closeModal();break;
  case 'space':go('space');break;
  case 'records':go('records');break;
  case 'detail':go(`title/${node.dataset.id}`);break;
  case 'edit':state.savedId=node.dataset.id;prepareDraft(record(state.savedId));setModal('edit');break;
  case 'edit-saved':prepareDraft(record(state.savedId));setModal('edit');break;
  case 'select-title':state.selectedId=node.dataset.id;prepareDraft(state.records.find(r=>r.titleId===state.selectedId));setModal('status');break;
  case 'save-status':saveStatus(node.dataset.value);break;
  case 'saved-done':closeModal();go('records');break;
  case 'save-edit':{
   const r=record(state.savedId);if(!r)break;const form=$('#edit-form');const note=form.elements.note.value.trim();const rating=Number(form.elements.rating.value)||null;const status=form.elements.status.value;
   const context=readDraftContext(status,r);if(!context)break;Object.assign(r,context);
   r.note=note;r.rating=rating;r.status=status;r.updatedAt=new Date(Math.max(Date.now(),(Date.parse(r.updatedAt)||0)+1)).toISOString();r.syncStatus=savedSyncStatus();persistSyncedRecords();closeModal();render();toast(t('그때의 마음을 더해두었어요.','Your note is kept with this moment.'));break;
  }
  case 'filter-type':state.type=node.dataset.value;render();break;
  case 'search-type':state.searchType=node.dataset.value;renderDialog();break;
  case 'connect':beginConnect();break;
  case 'resume-restore':state.connectionInput=state.connectionTarget||state.ownCode;state.connectionError='';state.connectionStep='error';setModal('connect');restoreRecords();break;
  case 'connectivity':{
   const wasBusy=state.busy;cancelOperation();state.online=!state.online;
   if(wasBusy && state.restorePending)state.connectionStep='error';
   render();if(state.modal)renderDialog();
   toast(state.online?t('시안을 온라인 상태로 바꿨어요. 남긴 기록의 동기화를 체험할 수 있어요.','The preview is now online. You can try syncing your records.'):t('시안을 오프라인 상태로 바꿨어요. 기록은 이 기기에 남아요.','The preview is now offline. Records stay on this device.'));break;
  }
  case 'submit-code':submitCode();break;
  case 'confirm-merge':case 'retry-restore':restoreRecords();break;
  case 'connected-done':closeModal();go('records');break;
  case 'sync':syncRecords();break;
  case 'sync-connect':syncRecords(true);break;
  case 'show-code':setModal('code');break;
  case 'copy-code':
   toast(await copyCode(state.ownCode)?t('연결 코드를 복사했어요.','Connection code copied.'):t('코드를 직접 선택해 복사해 주세요.','Select and copy the code manually.'));break;
  case 'download-code':downloadCode();break;
  case 'download-report':downloadReport();break;
  case 'export':exportCSV();break;
  case 'lost-code':setModal('lost');break;
  case 'publish':state.savedId=node.dataset.id;state.publishError='';setModal('publish');break;
  case 'confirm-publish':{
   if(!state.online){state.publishError=t('오프라인에서는 공개할 수 없어요. 기록은 그대로 남아 있으니 연결한 뒤 다시 시도해 주세요.','You cannot publish while offline. Your record is still here; reconnect and try again.');$('#publish-error').textContent=state.publishError;return;}
   const r=record(state.savedId);if(!r)break;const existing=state.publicPosts.find(p=>p.sourceRecordId===r.id);if(existing){existing.note=clone(r.note);existing.date=recordDate(r);}else state.publicPosts.unshift({id:`post-${randomId()}`,sourceRecordId:r.id,titleId:r.titleId,note:clone(r.note),date:recordDate(r),likes:0});closeModal();go('together');toast(t('이 기록을 함께 화면에 나눴어요.','You shared this record in Together.'));break;
  }
  case 'like':{const post=state.publicPosts.find(p=>p.id===node.dataset.id);if(post){post.liked=!post.liked;post.likes=(post.likes||0)+(post.liked?1:-1);render();}break;}
 }
}
document.addEventListener('error',event=>{
 const node=event.target;if(!isDevelopment()||!(node instanceof HTMLImageElement))return;
 const placeholder=document.createElement('span'),label=document.createElement('span');
 placeholder.className=`cover-placeholder ${node.className}`;placeholder.setAttribute('role','img');placeholder.setAttribute('aria-label',node.alt);label.textContent=node.alt;placeholder.append(label);node.replaceWith(placeholder);
},true);
document.addEventListener('click',event=>{if(event.target.closest('.skip-link')){event.preventDefault();$('#main')?.focus();$('#main')?.scrollIntoView();return;}const node=event.target.closest('[data-action]');if(!node||node.disabled)return;handleAction(node.dataset.action,node);});
document.addEventListener('input',event=>{
 const node=event.target;
 if(state.entryDraft){
  const field={'tpo-when':'when','tpo-place':'place','tpo-occasion':'occasion','edit-note':'note','edit-rating':'rating'}[node.dataset.control];
  if(field){state.entryDraft[field]=node.value;state.tpoError='';if($('#tpo-error'))$('#tpo-error').textContent='';}
 }
 if(node.dataset.control==='development-code'){state.development.code=node.value;state.development.error='';const error=$('#development-code-error');if(error)error.textContent='';}
 if(node.dataset.control==='title-search'){state.search=node.value;$('#search-results').innerHTML=searchResults();}
 if(node.dataset.control==='code'){state.connectionInput=node.value.toUpperCase();state.connectionError='';$('#code-error').textContent='';}
 if(node.dataset.control==='record-search'){
  state.query=node.value;const template=document.createElement('template');template.innerHTML=recordsPage();$('.timeline-list').replaceChildren(...template.content.querySelector('.timeline-list').childNodes);$('.results-summary').textContent=template.content.querySelector('.results-summary').textContent;
 }
});
document.addEventListener('change',event=>{
 const node=event.target;
 if(state.entryDraft){
  const field={'tpo-when':'when','tpo-place':'place','tpo-occasion':'occasion','edit-rating':'rating'}[node.dataset.control];
  if(field)state.entryDraft[field]=node.value;
  if(node.dataset.control==='edit-status'){state.entryDraft.status=node.value;renderDialog();$('#edit-status')?.focus();}
 }
 if(node.dataset.control==='data-source')switchDataSource(node.value);
 if(node.dataset.control==='scenario'&&!isDevelopment()){if($('#dialog').open)closeModal();state.scenario=node.value;initScenario();render();}
 if(node.dataset.control==='status'){state.status=node.value;render();}
});
document.addEventListener('submit',event=>{event.preventDefault();if(event.target.id==='connection-form'&&!isDevelopment())submitCode();if(event.target.id==='development-connection-form')handleAction('development-submit',event.target);});
$('#dialog').addEventListener('cancel',event=>{event.preventDefault();closeModal();});
$('#dialog').addEventListener('click',event=>{if(event.target===$('#dialog')){const box=$('#dialog').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom){closeModal();}}});
window.addEventListener('hashchange',()=>{if(location.hash==='#main'){updateURL();$('#main')?.focus();return;}state.route=location.hash.slice(1)||'home';render();$('#main').focus({preventScroll:true});});
if(isDevelopment()){clearDevelopmentRecords();state.route=location.hash==='#main'?'home':location.hash.slice(1)||'home';loadDevelopment();}else{initScenario({resetAccounts:true});state.route=location.hash==='#main'?'home':location.hash.slice(1)||'home';render();}
if(!isDevelopment()&&(params.has('quick')||params.has('capture_title')||params.has('capture_text'))){startRecord();state.search=params.get('capture_title')||params.get('capture_text')||'';renderDialog();}
