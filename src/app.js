const CONFIG = window.COUPLE_SUPABASE || {};
const USERS = window.COUPLE_LOCAL_USERS || [
  { role:'wang', name:'小王同学', password:'20040624', avatar:'assets/avatars/wang.webp' },
  { role:'han', name:'小韩同学', password:'20040519', avatar:'assets/avatars/han.webp' }
];

const HERO_PHOTO = 'assets/daily/day_01.webp';
const HIDDEN_FINAL = 'assets/hidden_final.webp';
const CATS = ['约会','旅行','日常','美食','纪念日','成长','惊喜','其他'];
const STATUS_TIPS = ['想你','开心','贴贴','期待','加油','抱抱','想见你','很幸福'];
const QUESTIONS = ['今天最想对TA说什么？','最近哪一刻最让你开心？','下次见面最想一起做什么？','今天用三个词形容TA。','如果给TA准备一个小奖励，会是什么？','下一张合照想在哪里拍？','今天有什么小事想被TA记住？'];

let sb = null;
let currentRole = sessionStorage.getItem('couple99_role') || '';
let state = { wishes: [], messages: [], records: [], images: [], daily: [], activities: [], appState: {} };
let tab = 'home';
let filters = { status:'all', author:'all', category:'all', keyword:'' };
let filtersOpen = false;
let cal = new Date(); cal.setDate(1);
let hiddenClicks = 0;

init();

async function init(){
  document.getElementById('app').innerHTML = '<div class="loading">正在打开你们的小世界…</div>';
  if(!CONFIG.url || !CONFIG.anonKey || CONFIG.url.includes('YOUR_PROJECT_ID')){
    document.getElementById('app').innerHTML = configView();
    return;
  }
  sb = window.supabase.createClient(CONFIG.url, CONFIG.anonKey);
  if(currentRole){
    await loadAll();
  }
  render();
}

function configView(){
  return `<div class="center-shell"><section class="login-card">
    <img class="login-hero" src="${HERO_PHOTO}" alt="我们的卡通合照">
    <div class="brand">情侣99件事</div>
    <p class="sub">请先打开 <b>supabase-config.js</b>，填入 Supabase Project URL 和 anon public key。</p>
    <p class="hint">密码已经写在前端，登录后数据会写入 Supabase。</p>
  </section></div>`;
}

function loginView(){
  const first = USERS[0];
  return `<div class="center-shell"><section class="login-card">
    <img class="login-hero" src="${HERO_PHOTO}" alt="我们的卡通合照">
    <div class="brand">情侣99件事</div>
    <p class="sub">登录后一起记录 99 件想做、正在做和已经完成的小事。</p>
    <div class="field"><label>选择身份</label><div class="identity-grid">
      ${USERS.map((u,i)=>`<div id="pick_${u.role}" class="identity-card ${i===0?'active':''}" onclick="pickUser('${u.role}')"><img src="${u.avatar}"><div><b>${esc(u.name)}</b></div></div>`).join('')}
    </div><select id="loginRole" style="display:none">${USERS.map(u=>`<option value="${u.role}">${esc(u.name)}</option>`).join('')}</select></div>
    <div class="field"><label>密码</label><input id="loginPwd" class="input" type="password" placeholder="输入密码" onkeydown="if(event.key==='Enter')doLogin()"></div>
    <button class="btn full" onclick="doLogin()">进入我们的小世界 ❤️</button>
  </section></div>`;
}

function pickUser(role){
  document.getElementById('loginRole').value = role;
  USERS.forEach(u => document.getElementById('pick_'+u.role)?.classList.toggle('active', u.role === role));
}

async function doLogin(){
  const role = document.getElementById('loginRole').value;
  const pwd = document.getElementById('loginPwd').value;
  const u = USERS.find(x => x.role === role);
  if(!u || u.password !== pwd) return toast('密码不对哦');
  currentRole = role;
  sessionStorage.setItem('couple99_role', role);
  await loadAll();
  await logActivity(`${roleName(currentRole)} 回来了`);
  render();
}

function logout(){
  currentRole = '';
  sessionStorage.removeItem('couple99_role');
  state = { wishes: [], messages: [], records: [], images: [], daily: [], activities: [], appState: {} };
  render();
}

async function loadAll(){
  const [wishes, messages, records, images, daily, activities, appState] = await Promise.all([
    sb.from('couple_wishes').select('*').order('slot'),
    sb.from('couple_wish_messages').select('*').order('created_at'),
    sb.from('couple_wish_records').select('*').order('created_at'),
    sb.from('couple_wish_images').select('*').order('created_at'),
    sb.from('couple_daily_entries').select('*').order('day'),
    sb.from('couple_activities').select('*').order('created_at', { ascending:false }).limit(120),
    sb.from('couple_app_state').select('*')
  ]);
  for(const r of [wishes,messages,records,images,daily,activities,appState]){
    if(r.error) throwAndShow(r.error);
  }
  state.wishes = (wishes.data || []).map(fromDbWish);
  state.messages = messages.data || [];
  state.records = records.data || [];
  state.images = await withImageUrls(images.data || []);
  state.daily = daily.data || [];
  state.activities = activities.data || [];
  const eggRow = (appState.data || []).find(x => x.id === 'egg');
  state.appState.egg = eggRow?.value || { wang:false, han:false, finalAt:null };
}

function fromDbWish(w){
  return {
    id: w.id, slot: w.slot, title: w.title || '', desc: w.description || '', category: w.category || '日常',
    status: w.status || 'todo', timeMode: w.time_mode || 'unsure', date: w.plan_date || '',
    startDate: w.start_date || '', endDate: w.end_date || '', deadline: w.deadline || '',
    addedBy: w.added_by, surprise: w.surprise || {}, memory: w.memory || {},
    createdAt: w.created_at, updatedAt: w.updated_at, completedAt: w.completed_at
  };
}

function toDbWish(w){
  return {
    slot: w.slot, title: w.title, description: w.desc, category: w.category, status: w.status,
    time_mode: w.timeMode, plan_date: w.date || null, start_date: w.startDate || null,
    end_date: w.endDate || null, deadline: w.deadline || null, added_by: w.addedBy || currentRole,
    surprise: w.surprise || {}, memory: w.memory || {}, completed_at: w.completedAt || null,
    updated_at: new Date().toISOString()
  };
}

async function withImageUrls(rows){
  const bucket = CONFIG.bucket || 'couple-photos';
  const out = [];
  for(const row of rows){
    let src = row.public_url || '';
    if(!src && row.file_path){
      const { data } = await sb.storage.from(bucket).createSignedUrl(row.file_path, 60 * 60);
      src = data?.signedUrl || '';
    }
    out.push({ ...row, src });
  }
  return out;
}

function render(){ document.getElementById('app').innerHTML = currentRole ? layout() : loginView(); }

function layout(){
  const pct = Math.min(100, completed()/99*100).toFixed(1);
  return `<div class="shell">
    <section class="topbar"><div class="toprow"><div class="title-wrap"><h1 onclick="secretClick()">情侣99件事 💞</h1><p>今天也要把喜欢悄悄记下来。当前登录：<b>${esc(roleName(currentRole))}</b></p></div><div class="user-chip">${avatar(currentRole)}<b>${esc(roleName(currentRole))}</b><button class="btn small secondary" onclick="logout()">退出</button></div></div><div class="progress-wrap"><div class="progress-line"><div class="progress-fill" style="width:${pct}%"></div></div><b>${completed()} / 99</b></div></section>
    <nav class="nav">${nav('home','首页')}${nav('grid','99格')}${nav('calendar','日历')}${nav('timeline','时间轴')}${nav('memory','回忆墙')}${nav('stats','统计/设置')}</nav>
    <main>${tabView()}</main>
  </div>`;
}

function nav(id,t){return `<button class="${tab===id?'active':''}" onclick="tab='${id}';render()">${t}</button>`}
function tabView(){return tab==='home'?home():tab==='grid'?grid():tab==='calendar'?calendar():tab==='timeline'?timeline():tab==='memory'?memory():stats()}

function home(){
  const d = today();
  const daMine = dailyFor(d, currentRole);
  const daOther = dailyFor(d, otherRole());
  const recent = [...state.wishes].sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)).slice(0,4);
  const q = questionText(d);
  return `<div class="grid3">
    <section class="card daily-card"><div class="daily-copy"><span class="daily-tag">📷 我们的封面</span><h2>把今天，也放进我们的清单里。</h2><p>这里记录想一起做的事，也记录已经完成的小瞬间。慢慢写，慢慢做，慢慢变成只属于你们的回忆。</p><div class="badge-list"><span class="badge on">${completed()} / 99 已完成</span><span class="badge">💗 心动值 ${heartScore()}</span></div></div><img class="daily-photo" src="${HERO_PHOTO}" alt="我们的卡通合照"></section>
    <section class="card stat"><div class="icon">💗</div><div><div class="num">${heartScore()}</div><div class="label">心动值</div></div></section>
    <section class="card stat"><div class="icon">📸</div><div><div class="num">${state.images.length}</div><div class="label">照片</div></div></section>
    <section class="card stat"><div class="icon">💬</div><div><div class="num">${state.messages.length}</div><div class="label">留言</div></div></section>
    <section class="card"><div class="section-title"><h2>今日状态</h2><span class="badge">${d}</span></div><p class="hint">用 5 个字以内，给今天留一个小小标记。保存后也可以随时修改。</p><input id="todayStatus" class="input" maxlength="5" placeholder="5个字以内" value="${esc(daMine?.status_text||'')}"><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${STATUS_TIPS.map(s=>`<button class="chip" onclick="document.getElementById('todayStatus').value='${s}'">${s}</button>`).join('')}</div><button class="btn full" style="margin-top:10px" onclick="saveStatus()">${daMine?.status_text?'修改今日状态':'保存今日状态'}</button>${daOther?.status_text?`<div class="message"><b>${esc(roleName(otherRole()))} 的状态</b><p>${esc(daOther.status_text)}</p></div>`:`<p class="hint">TA 今天还没有标记状态。</p>`}</section>
    <section class="card"><div class="section-title"><h2>今日情侣问题</h2><span class="badge">今日一问</span></div><p><b>${esc(q)}</b></p><textarea id="todayAnswer" class="textarea" placeholder="写下今天想说的话">${esc(daMine?.answer||'')}</textarea><button class="btn full" style="margin-top:10px" onclick="saveQuestion()">${daMine?.answer?'修改今日回答':'保存今日回答'}</button>${daOther?.answer?`<div class="message"><b>${esc(roleName(otherRole()))} 的回答</b><p>${esc(daOther.answer)}</p></div>`:`<p class="hint">TA 今天还没有回答。</p>`}</section>
    <section class="card"><div class="section-title"><h2>今日挑战</h2><button class="btn small" onclick="randomWish()">抽一件</button></div><div id="challengeBox" class="empty-state">点击抽一件，让今天有个小目标。</div></section>
    <section class="card activity-card"><div class="section-title"><h2>动态小窗</h2><span class="badge">${state.activities.length}</span></div><div class="list activity-scroll">${state.activities.slice(0,60).map(chat).join('')||'<div class="empty-state">还没有动态。</div>'}</div></section>
    <section class="card full-row" style="grid-column:1/-1"><div class="section-title"><h2>最近心愿</h2><button class="btn small secondary" onclick="tab='grid';render()">去99格</button></div><div class="grid2">${recent.map(w=>smallWish(w)).join('')||'<div class="empty-state">先写下第一件想一起做的事吧。</div>'}</div></section>
  </div>`;
}

async function saveStatus(){
  const val = document.getElementById('todayStatus').value.trim().slice(0,5);
  await upsertDaily({ status_text: val || null });
  await logActivity(`${roleName(currentRole)} ${val?'更新了今日状态':'清空了今日状态'}`);
  await loadAll(); render();
}

async function saveQuestion(){
  const val = document.getElementById('todayAnswer').value.trim();
  if(!val) return toast('先写一句再保存嘛');
  await upsertDaily({ question: questionText(today()), answer: val });
  await logActivity(`${roleName(currentRole)} 回答了今日情侣问题`);
  await loadAll(); render();
}

async function upsertDaily(patch){
  const existing = dailyFor(today(), currentRole);
  const payload = { day: today(), by_role: currentRole, question: questionText(today()), ...patch, updated_at: new Date().toISOString() };
  if(existing){
    const { error } = await sb.from('couple_daily_entries').update(payload).eq('id', existing.id);
    if(error) return throwAndShow(error);
  }else{
    const { error } = await sb.from('couple_daily_entries').insert(payload);
    if(error) return throwAndShow(error);
  }
}

function grid(){
  const wishes=filteredWishes(), visible=new Set(wishes.map(w=>w.id));
  return `<section class="card"><div class="section-title"><h2>99格心愿</h2><button class="btn" onclick="openWish(nextSlot())">新增心愿</button></div>
    <div class="filter-head"><button class="btn small secondary" onclick="toggleFilters()">${filtersOpen?'收起筛选':'展开筛选'}</button><div class="filter-summary">${filterSummary()}</div></div>
    <div class="filter-panel ${filtersOpen?'':'collapsed'}">
      <div class="filter-row"><span class="filter-label">状态</span>${['all:全部','todo:未完成','done:已完成','surprise:惊喜','long:长期'].map(x=>{let[a,b]=x.split(':');return `<button class="chip ${filters.status===a?'active':''}" onclick="filters.status='${a}';render()">${b}</button>`}).join('')}</div>
      <div class="filter-row"><span class="filter-label">发起人</span>${['all:全部','wang:小王','han:小韩'].map(x=>{let[a,b]=x.split(':');return `<button class="chip ${filters.author===a?'active':''}" onclick="filters.author='${a}';render()">${b}</button>`}).join('')}</div>
      <div class="filter-row"><span class="filter-label">分类</span><button class="chip ${filters.category==='all'?'active':''}" onclick="filters.category='all';render()">全部</button>${CATS.map(c=>`<button class="chip ${filters.category===c?'active':''}" onclick="filters.category='${c}';render()">${c}</button>`).join('')}</div>
      <div class="filter-row"><input class="input" style="max-width:260px" placeholder="搜索心愿" value="${esc(filters.keyword)}" oninput="filters.keyword=this.value;render()"><button class="chip" onclick="filters={status:'all',author:'all',category:'all',keyword:''};filtersOpen=false;render()">清空筛选</button></div>
    </div>
    <div class="wish-grid">${Array.from({length:99},(_,i)=>card(i+1,state.wishes.find(w=>w.slot===i+1),visible)).join('')}</div></section>`;
}

function toggleFilters(){filtersOpen=!filtersOpen;render()}
function filterSummary(){
  let arr=[];
  if(filters.status!=='all') arr.push({todo:'未完成',done:'已完成',surprise:'惊喜',long:'长期'}[filters.status]||filters.status);
  if(filters.author!=='all') arr.push(filters.author==='wang'?'小王':'小韩');
  if(filters.category!=='all') arr.push(filters.category);
  if(filters.keyword) arr.push('搜索：'+filters.keyword);
  if(!arr.length) return '<span class="hint">当前显示全部心愿</span>';
  return arr.map(x=>`<span class="filter-pill">${esc(x)}</span>`).join('');
}

function filteredWishes(){
  return state.wishes.filter(w=>{
    if(filters.status==='todo' && w.status==='completed') return false;
    if(filters.status==='done' && w.status!=='completed') return false;
    if(filters.status==='surprise' && !w.surprise?.enabled) return false;
    if(filters.status==='long' && w.timeMode!=='long' && w.timeMode!=='range') return false;
    if(filters.author!=='all' && w.addedBy!==filters.author) return false;
    if(filters.category!=='all' && w.category!==filters.category) return false;
    if(filters.keyword && !((w.title+w.desc).includes(filters.keyword))) return false;
    return true;
  });
}

function card(slot,w,visible){
  if(w && visible && !visible.has(w.id)) return `<div class="wish-card empty" style="opacity:.32"><div>#${slot}</div><small>未匹配</small></div>`;
  if(!w) return `<div class="wish-card empty" onclick="openWish(${slot})"><div>#${slot}</div><b>＋</b></div>`;
  let l=locked(w);
  return `<div class="wish-card ${w.status==='completed'?'completed':''} ${l?'locked':''}" onclick="openWish(${slot})"><button class="quick" onclick="event.stopPropagation();toggleDone('${w.id}')">${w.status==='completed'?'✓':'○'}</button><div><div class="slot">#${slot}</div><div class="wish-title">${l?'神秘惊喜盒子':esc(w.title)}</div></div><div class="meta"><span class="tag">${esc(roleName(w.addedBy))}</span><span class="tag">${esc(w.category||'其他')}</span><span class="tag">${timeLabel(w)}</span></div></div>`;
}

function nextSlot(){for(let i=1;i<=99;i++)if(!state.wishes.some(w=>w.slot===i))return i;return 99}
function makeWish(slot){return{id:'',slot,title:'',desc:'',category:'日常',status:'todo',timeMode:'unsure',date:'',startDate:'',endDate:'',deadline:'',addedBy:currentRole,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),surprise:{enabled:false,type:'password',password:'',hint:'',unlockAt:'',both:{wang:false,han:false},unlocked:false},memory:{}}}
function messagesFor(wid){return state.messages.filter(m=>m.wish_id===wid)}
function recordsFor(wid){return state.records.filter(r=>r.wish_id===wid)}
function imagesFor(wid){return state.images.filter(i=>i.wish_id===wid)}
function openWish(slot){let w=state.wishes.find(x=>x.slot===slot)||makeWish(slot);if(w.id&&locked(w))return showLocked(w);showEdit(w,!w.id)}
function locked(w){return w.surprise?.enabled && !w.surprise.unlocked && w.addedBy!==currentRole}

function showEdit(w,isNew=false){
  const msgs = w.id ? messagesFor(w.id) : [];
  const recs = w.id ? recordsFor(w.id) : [];
  const imgs = w.id ? imagesFor(w.id) : [];
  showModal(`<div class="modal-head"><h2>${isNew?'新增心愿':'心愿详情'} #${w.slot}</h2><button class="close-btn" onclick="closeModal()">×</button></div>
  <div class="form-grid"><div class="field full-row"><label>标题</label><input id="title" class="input" value="${esc(w.title)}"></div><div class="field full-row"><label>描述</label><textarea id="desc" class="textarea">${esc(w.desc)}</textarea></div><div class="field"><label>分类</label><select id="cat" class="select">${CATS.map(c=>`<option ${w.category===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label>状态</label><select id="status" class="select"><option value="todo" ${w.status!=='completed'?'selected':''}>未完成</option><option value="completed" ${w.status==='completed'?'selected':''}>已完成</option></select></div>
  <div class="field"><label>时间类型</label><select id="timeMode" class="select" onchange="refreshTimeFields()"><option value="unsure" ${w.timeMode==='unsure'?'selected':''}>未确定</option><option value="single" ${w.timeMode==='single'?'selected':''}>单日计划</option><option value="range" ${w.timeMode==='range'?'selected':''}>时间范围/多日</option><option value="deadline" ${w.timeMode==='deadline'?'selected':''}>仅截止日期</option><option value="long" ${w.timeMode==='long'?'selected':''}>长期心愿</option></select></div>
  <div class="field t-single"><label>计划日期</label><input id="date" class="input" type="date" value="${esc(w.date)}"></div><div class="field t-range"><label>开始日期</label><input id="startDate" class="input" type="date" value="${esc(w.startDate)}"></div><div class="field t-range"><label>结束日期</label><input id="endDate" class="input" type="date" value="${esc(w.endDate)}"></div><div class="field t-deadline"><label>截止日期</label><input id="deadline" class="input" type="date" value="${esc(w.deadline)}"></div>
  <label class="switch-line full-row"><input id="surpriseEnabled" type="checkbox" ${w.surprise?.enabled?'checked':''} onchange="refreshSurprise()"><span>设置为惊喜盒子</span></label>
  <div id="surpriseBox" class="full-row" style="display:none"><div class="field"><label>解锁方式</label><select id="surpriseType" class="select" onchange="refreshSurprise()"><option value="password" ${w.surprise?.type==='password'?'selected':''}>暗号解锁</option><option value="date" ${w.surprise?.type==='date'?'selected':''}>定时解锁</option><option value="both" ${w.surprise?.type==='both'?'selected':''}>双方确认</option></select></div><div class="field s-password"><label>暗号</label><input id="spass" class="input" value="${esc(w.surprise?.password||'')}"></div><div class="field s-password"><label>提示</label><input id="shint" class="input" value="${esc(w.surprise?.hint||'')}"></div><div class="field s-date"><label>解锁时间</label><input id="unlockAt" class="input" type="datetime-local" value="${toLocal(w.surprise?.unlockAt)}"></div></div></div>
  <div class="divider"></div><h3>照片</h3><div class="image-list">${imgs.map(im=>`<div class="thumb"><img src="${im.src}"><button onclick="removeImage('${im.id}','${im.file_path}')">×</button></div>`).join('')}</div>${w.id?`<input type="file" accept="image/*" multiple onchange="uploadImages(event,'${w.id}')">`:'<p class="hint">保存心愿后可以上传照片。</p>'}
  <div class="divider"></div><h3>长期/多日记录</h3>${w.id?`<textarea id="recordText" class="textarea" placeholder="例如：Day 1 出发啦、今天完成了一小步……"></textarea><button class="btn small secondary" onclick="addRecord('${w.id}')">添加阶段记录</button>`:'<p class="hint">保存心愿后可以添加阶段记录。</p>'}${recs.map(r=>`<div class="message"><b>${esc(roleName(r.by_role))}</b><p>${esc(r.text)}</p><small>${fmtTime(r.created_at)}</small></div>`).join('')}
  <div class="divider"></div><h3>留言</h3>${msgs.map(m=>renderMessage(m)).join('')}${w.id?`<textarea id="msgText" class="textarea" placeholder="写留言给TA"></textarea><button class="btn small secondary" onclick="addMsg('${w.id}')">发送留言</button>`:'<p class="hint">保存心愿后可以留言。</p>'}
  <div class="divider"></div><h3>完成后的回忆</h3><textarea id="memory" class="textarea" placeholder="这件事完成后，写一句属于你的回忆。">${esc((w.memory||{})[currentRole]||'')}</textarea>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn" onclick="saveWish('${w.id}',${w.slot})">保存</button>${!isNew?`<button class="btn good" onclick="toggleDone('${w.id}',true)">${w.status==='completed'?'取消完成':'标记完成'}</button><button class="btn danger" onclick="deleteWish('${w.id}')">删除</button>`:''}<button class="btn ghost" onclick="closeModal()">关闭</button></div>`);
  refreshTimeFields(); refreshSurprise();
}

function refreshTimeFields(){let t=document.getElementById('timeMode')?.value;document.querySelectorAll('.t-single,.t-range,.t-deadline').forEach(e=>e.style.display='none');if(t==='single')document.querySelectorAll('.t-single').forEach(e=>e.style.display='block');if(t==='range'||t==='long')document.querySelectorAll('.t-range').forEach(e=>e.style.display='block');if(t==='deadline')document.querySelectorAll('.t-deadline').forEach(e=>e.style.display='block')}
function refreshSurprise(){let on=document.getElementById('surpriseEnabled')?.checked,t=document.getElementById('surpriseType')?.value;let b=document.getElementById('surpriseBox');if(b)b.style.display=on?'block':'none';document.querySelectorAll('.s-password,.s-date').forEach(e=>e.style.display='none');if(on&&t==='password')document.querySelectorAll('.s-password').forEach(e=>e.style.display='block');if(on&&t==='date')document.querySelectorAll('.s-date').forEach(e=>e.style.display='block')}
function toLocal(v){if(!v)return '';let d=new Date(v);if(isNaN(d))return '';let p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function fromLocal(v){return v?new Date(v).toISOString():''}

async function saveWish(id,slot){
  let old = id ? state.wishes.find(x=>x.id===id) : null;
  let w = old || makeWish(slot);
  w.title=document.getElementById('title').value.trim()||'未命名心愿';
  w.desc=document.getElementById('desc').value.trim();
  w.category=document.getElementById('cat').value;
  w.status=document.getElementById('status').value;
  w.timeMode=document.getElementById('timeMode').value;
  w.date=document.getElementById('date')?.value||'';
  w.startDate=document.getElementById('startDate')?.value||'';
  w.endDate=document.getElementById('endDate')?.value||'';
  w.deadline=document.getElementById('deadline')?.value||'';
  w.memory=w.memory||{};
  w.memory[currentRole]=document.getElementById('memory').value.trim();
  w.surprise.enabled=document.getElementById('surpriseEnabled').checked;
  w.surprise.type=document.getElementById('surpriseType')?.value||'password';
  w.surprise.password=document.getElementById('spass')?.value.trim()||'';
  w.surprise.hint=document.getElementById('shint')?.value.trim()||'';
  w.surprise.unlockAt=fromLocal(document.getElementById('unlockAt')?.value||'');
  if(w.status==='completed' && !w.completedAt) w.completedAt = new Date().toISOString();
  const payload = toDbWish(w);
  let result;
  if(old) result = await sb.from('couple_wishes').update(payload).eq('id', id).select().single();
  else result = await sb.from('couple_wishes').insert(payload).select().single();
  if(result.error) return throwAndShow(result.error);
  await logActivity(`${roleName(currentRole)} ${old?'更新了':'新增了'}心愿「${w.title}」`);
  await loadAll(); closeModal(); render(); toast('已经记下来了');
}

async function toggleDone(id, stay=false){
  const w = state.wishes.find(x=>x.id===id);
  const newStatus = w.status==='completed'?'todo':'completed';
  const { error } = await sb.from('couple_wishes').update({
    status: newStatus,
    completed_at: newStatus==='completed' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if(error) return throwAndShow(error);
  await logActivity(`${roleName(currentRole)} ${newStatus==='completed'?'完成了':'取消完成'}「${w.title}」`);
  await loadAll();
  if(stay) showEdit(state.wishes.find(x=>x.id===id)); else render();
}

async function deleteWish(id){
  if(!confirm('确定删除这件心愿吗？')) return;
  const { error } = await sb.from('couple_wishes').delete().eq('id', id);
  if(error) return throwAndShow(error);
  await loadAll(); closeModal(); render();
}

function renderMessage(m){return `<div class="message"><div class="message-top"><span class="message-user">${avatar(m.by_role)}<span>${esc(roleName(m.by_role))}</span></span><span>${fmtTime(m.created_at)}</span></div><p>${esc(m.text)}</p></div>`}

async function addMsg(wishId){
  const t=document.getElementById('msgText').value.trim();
  if(!t) return toast('先写一句再发送嘛');
  const { error } = await sb.from('couple_wish_messages').insert({ wish_id:wishId, by_role:currentRole, text:t });
  if(error) return throwAndShow(error);
  const w=state.wishes.find(x=>x.id===wishId);
  await logActivity(`${roleName(currentRole)} 给「${w?.title||'心愿'}」留言了`);
  await loadAll(); showEdit(state.wishes.find(x=>x.id===wishId));
}

async function addRecord(wishId){
  const t=document.getElementById('recordText').value.trim();
  if(!t) return toast('先写一条记录');
  const { error } = await sb.from('couple_wish_records').insert({ wish_id:wishId, by_role:currentRole, text:t });
  if(error) return throwAndShow(error);
  const w=state.wishes.find(x=>x.id===wishId);
  await logActivity(`${roleName(currentRole)} 给「${w?.title||'心愿'}」添加了阶段记录`);
  await loadAll(); showEdit(state.wishes.find(x=>x.id===wishId));
}

async function uploadImages(e,wishId){
  const files=[...e.target.files];
  if(!files.length) return;
  const bucket = CONFIG.bucket || 'couple-photos';
  for(const file of files){
    const compressed = await compressBlob(file);
    const path = `${wishId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const { error: upErr } = await sb.storage.from(bucket).upload(path, compressed, { contentType:'image/jpeg', upsert:false });
    if(upErr) return throwAndShow(upErr);
    const { error } = await sb.from('couple_wish_images').insert({ wish_id:wishId, by_role:currentRole, file_path:path });
    if(error) return throwAndShow(error);
  }
  const w=state.wishes.find(x=>x.id===wishId);
  await logActivity(`${roleName(currentRole)} 给「${w?.title||'心愿'}」上传了照片`);
  await loadAll(); showEdit(state.wishes.find(x=>x.id===wishId));
}

function compressBlob(file){
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=ev=>{
      const im=new Image();
      im.onload=()=>{
        const max=1400, s=Math.min(1,max/Math.max(im.width,im.height));
        const c=document.createElement('canvas');
        c.width=im.width*s; c.height=im.height*s;
        c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        c.toBlob(blob=>res(blob),'image/jpeg',.8);
      };
      im.src=ev.target.result;
    };
    r.readAsDataURL(file);
  });
}

async function removeImage(id,filePath){
  if(!confirm('删除这张照片吗？')) return;
  const bucket = CONFIG.bucket || 'couple-photos';
  await sb.storage.from(bucket).remove([filePath]);
  const { error } = await sb.from('couple_wish_images').delete().eq('id', id);
  if(error) return throwAndShow(error);
  await loadAll(); render();
}

function showLocked(w){
  const s=w.surprise||{};
  let body='<div class="modal-head"><h2>🎁 惊喜盒子</h2><button class="close-btn" onclick="closeModal()">×</button></div><div class="empty-state"><h3>这是TA给你准备的惊喜</h3>';
  if(s.type==='password') body+=`<p>${esc(s.hint||'输入暗号才能打开')}</p><input id="unlockPwd" class="input" placeholder="输入暗号"><button class="btn" onclick="tryUnlock('${w.id}')">打开惊喜</button>`;
  else if(s.type==='date') body+=`<p>还没到打开的时间。</p><button class="btn" onclick="tryAutoUnlock('${w.id}')">看看能不能打开</button>`;
  else body+=`<p>需要两个人都准备好。</p><button class="btn" onclick="confirmUnlock('${w.id}')">我准备好了</button><p class="hint">小王：${s.both?.wang?'已确认':'未确认'} · 小韩：${s.both?.han?'已确认':'未确认'}</p>`;
  body+='</div>'; showModal(body);
}

async function tryUnlock(id){
  const w=state.wishes.find(x=>x.id===id);
  const v=document.getElementById('unlockPwd').value.trim();
  if(v!==w.surprise.password) return toast('暗号不对哦');
  w.surprise.unlocked=true; w.surprise.unlockedAt=new Date().toISOString();
  const { error } = await sb.from('couple_wishes').update({ surprise:w.surprise, updated_at:new Date().toISOString() }).eq('id', id);
  if(error) return throwAndShow(error);
  await logActivity(`${roleName(currentRole)} 打开了一个惊喜盒子`);
  await loadAll(); showEdit(state.wishes.find(x=>x.id===id));
}

async function tryAutoUnlock(id){
  const w=state.wishes.find(x=>x.id===id);
  if(w.surprise.type==='date' && w.surprise.unlockAt && new Date(w.surprise.unlockAt)<=new Date()){
    w.surprise.unlocked=true;
    const { error } = await sb.from('couple_wishes').update({ surprise:w.surprise, updated_at:new Date().toISOString() }).eq('id', id);
    if(error) return throwAndShow(error);
    await loadAll(); showEdit(state.wishes.find(x=>x.id===id));
  }else toast('它还想再等等你');
}

async function confirmUnlock(id){
  const w=state.wishes.find(x=>x.id===id);
  w.surprise.both=w.surprise.both||{wang:false,han:false};
  w.surprise.both[currentRole]=true;
  if(w.surprise.both.wang&&w.surprise.both.han) w.surprise.unlocked=true;
  const { error } = await sb.from('couple_wishes').update({ surprise:w.surprise, updated_at:new Date().toISOString() }).eq('id', id);
  if(error) return throwAndShow(error);
  await loadAll();
  w.surprise.unlocked ? showEdit(state.wishes.find(x=>x.id===id)) : showLocked(state.wishes.find(x=>x.id===id));
}

function randomWish(){
  const arr=state.wishes.filter(w=>w.status!=='completed'&&!locked(w));
  const b=document.getElementById('challengeBox');
  if(!arr.length) return b.textContent='现在没有可以抽取的未完成心愿。';
  const w=arr[Math.floor(Math.random()*arr.length)];
  b.innerHTML=`<div class="message"><b>${esc(w.title)}</b><p class="hint">${esc(w.desc||'打开详情补一句描述吧。')}</p><button class="btn small" onclick="openWish(${w.slot})">查看</button></div>`;
}

function calendar(){
  const y=cal.getFullYear(),m=cal.getMonth(),first=new Date(y,m,1),start=new Date(first);
  start.setDate(1-((first.getDay()+6)%7));
  const days=Array.from({length:42},(_,i)=>{let d=new Date(start);d.setDate(start.getDate()+i);return d});
  return `<section class="card"><div class="calendar-head"><button class="btn secondary" onclick="cal.setMonth(cal.getMonth()-1);render()">上个月</button><h2>${y}年${m+1}月</h2><button class="btn secondary" onclick="cal.setMonth(cal.getMonth()+1);render()">下个月</button></div><div class="calendar-scroll"><div class="calendar-grid">${['一','二','三','四','五','六','日'].map(x=>`<div class="day-name">周${x}</div>`).join('')}${days.map(d=>dayCell(d,m)).join('')}</div></div><p class="hint" style="margin-top:10px">手机上可左右滑动日历；点击某一天可查看当天心愿、状态、问答和互动。</p></section>`;
}

function dayCell(d,month){
  const key=d.toISOString().slice(0,10);
  const items=state.wishes.filter(w=>wishOnDate(w,key));
  const note=state.daily.find(x=>x.day===key && x.status_text)?.status_text || '';
  return `<div class="day ${d.getMonth()!==month?'muted':''} ${key===today()?'today':''}" onclick="openDayDetail('${key}')"><b>${d.getDate()}</b>${items.map(w=>`<div class="mini-wish" onclick="event.stopPropagation();openWish(${w.slot})">${locked(w)?'🎁 惊喜':(w.status==='completed'?'✅ ':'💌 ')+esc(w.title)}</div>`).join('')}${!items.length&&note?`<div class="mini-note">${esc(note)}</div>`:''}</div>`;
}


function openDayDetail(key){
  const items=state.wishes.filter(w=>wishOnDate(w,key));
  const dayEntries=state.daily.filter(x=>x.day===key);
  const acts=state.activities.filter(a=>(a.created_at||'').slice(0,10)===key);
  const q=questionText(key);
  const statusBlock=USERS.map(u=>{
    const d=dayEntries.find(x=>x.by_role===u.role);
    return `<div class="message"><div class="message-top"><span class="message-user">${avatar(u.role)}<span>${esc(u.name)}</span></span><span>${esc(d?.status_text||'未标记')}</span></div>${d?.answer?`<p><b>问答：</b>${esc(d.answer)}</p>`:'<p class="hint">还没有回答今日问题。</p>'}</div>`;
  }).join('');
  const wishBlock=items.length?items.map(w=>`<div class="feed" onclick="closeModal();openWish(${w.slot})">${locked(w)?'<div style="font-size:30px">🎁</div>':avatar(w.addedBy)}<div><p><b>${locked(w)?'神秘惊喜盒子':esc(w.title)}</b></p><small>${esc(roleName(w.addedBy))} · ${esc(w.category||'其他')} · ${timeLabel(w)}</small></div></div>`).join(''):'<div class="empty-state">这一天没有安排心愿。</div>';
  const actBlock=acts.length?acts.map(chat).join(''):'<div class="empty-state">这一天还没有互动记录。</div>';
  showModal(`<div class="modal-head"><h2>${esc(key)} 的记录</h2><button class="close-btn" onclick="closeModal()">×</button></div>
    <section><h3>当天心愿</h3><div class="list">${wishBlock}</div></section>
    <div class="divider"></div>
    <section><h3>今日状态与情侣问题</h3><p class="hint"><b>今日问题：</b>${esc(q)}</p>${statusBlock}</section>
    <div class="divider"></div>
    <section><h3>当天互动</h3><div class="list activity-scroll" style="max-height:260px">${actBlock}</div></section>`);
}

function wishOnDate(w,k){if(w.timeMode==='single')return w.date===k;if(w.timeMode==='deadline')return w.deadline===k;if(w.timeMode==='range'||w.timeMode==='long')return w.startDate&&w.endDate&&k>=w.startDate&&k<=w.endDate;return false}
function timeline(){let list=[...state.wishes].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));return `<section class="card"><h2>时间轴</h2><div class="timeline">${list.map(w=>`<div class="timeline-item" onclick="openWish(${w.slot})"><b>#${w.slot} ${locked(w)?'神秘惊喜盒子':esc(w.title)}</b><p class="hint">${timeLabel(w)} · ${esc(roleName(w.addedBy))} · ${w.status==='completed'?'已完成':'未完成'}</p></div>`).join('')||'<div class="empty-state">还没有时间轴。</div>'}</div></section>`}
function memory(){
  const arr=state.wishes.filter(w=>w.status==='completed'||imagesFor(w.id).length||recordsFor(w.id).length);
  return `<section class="card"><h2>回忆墙</h2><div class="gallery">${arr.map(w=>{let im=imagesFor(w.id)[0]?.src||HERO_PHOTO;return `<div class="memory" onclick="openWish(${w.slot})"><img src="${im}"><div class="body"><b>${locked(w)?'神秘惊喜盒子':esc(w.title)}</b><p class="hint">#${w.slot} · ${timeLabel(w)}</p></div></div>`}).join('')||'<div class="empty-state">完成心愿、上传照片或添加阶段记录后，这里会慢慢变成回忆墙。</div>'}</div></section>`;
}

function stats(){
  const ach=achievements();
  return `<div class="grid2"><section class="card"><h2>统计</h2><div class="list"><div class="feed">${avatar('wang')}<p>小王同学发起 ${state.wishes.filter(w=>w.addedBy==='wang').length} 件</p></div><div class="feed">${avatar('han')}<p>小韩同学发起 ${state.wishes.filter(w=>w.addedBy==='han').length} 件</p></div><div class="feed"><div style="font-size:28px">✅</div><p>已完成 ${completed()} / 99 件</p></div></div></section><section class="card"><h2>成就徽章</h2><div class="badge-list">${ach.map(a=>`<span class="badge ${a.ok?'on':''}">${a.ok?'🏅':'🔒'} ${esc(a.name)}</span>`).join('')}</div></section><section class="card"><h2>数据备份</h2><p class="hint">云端版本会自动同步。也可以导出一份 JSON 留作备份。</p><button class="btn" onclick="exportData()">导出备份</button></section></div>`;
}

function achievements(){
  const c=completed(), wc=state.wishes.length, ic=state.images.length, mc=state.messages.length, sp=state.wishes.filter(w=>w.surprise?.enabled).length, rg=state.wishes.filter(w=>w.timeMode==='range'||w.timeMode==='long').length;
  return [
    {name:'第一件小事',ok:wc>=1},{name:'愿望起步',ok:wc>=10},{name:'心愿收藏家',ok:wc>=30},{name:'半本清单',ok:wc>=50},{name:'九十九格',ok:wc>=99},
    {name:'第一次完成',ok:c>=1},{name:'甜蜜十连',ok:c>=10},{name:'二十五件纪念',ok:c>=25},{name:'半程纪念',ok:c>=50},{name:'九十件坚持',ok:c>=90},
    {name:'照片收藏家',ok:ic>=1},{name:'相册慢慢长大',ok:ic>=10},{name:'回忆写手',ok:state.wishes.filter(w=>Object.values(w.memory||{}).some(Boolean)).length>=5},
    {name:'留言达人',ok:mc>=20},{name:'话很多也很爱',ok:mc>=50},{name:'惊喜制造者',ok:sp>=1},{name:'惊喜收藏家',ok:sp>=5},{name:'拆开惊喜',ok:state.wishes.some(w=>w.surprise?.unlocked)},
    {name:'旅行计划家',ok:state.wishes.filter(w=>w.category==='旅行').length>=3},{name:'一起出发',ok:rg>=1},{name:'长期陪伴',ok:state.wishes.some(w=>w.timeMode==='long')},
    {name:'阶段记录员',ok:state.records.length>=5},{name:'美食搭子',ok:state.wishes.filter(w=>w.category==='美食').length>=5},{name:'约会安排师',ok:state.wishes.filter(w=>w.category==='约会').length>=5},{name:'心动破千',ok:heartScore()>=1000}
  ];
}

async function logActivity(text){
  if(!currentRole) return;
  await sb.from('couple_activities').insert({ by_role: currentRole, text });
}

function chat(a){const mine=a.by_role===currentRole;return `<div class="feed ${mine?'mine':'other'}">${avatar(a.by_role)}<div><p>${esc(a.text)}</p><small>${esc(roleName(a.by_role))} · ${fmtTime(a.created_at)}</small></div></div>`}
function smallWish(w){return `<div class="feed" onclick="openWish(${w.slot})">${locked(w)?'<div style="font-size:30px">🎁</div>':avatar(w.addedBy)}<div><p><b>${locked(w)?'一个神秘惊喜盒子':esc(w.title)}</b></p><small>${esc(roleName(w.addedBy))} · ${timeLabel(w)}</small></div></div>`}
function timeLabel(w){if(w.timeMode==='single')return fmt(w.date);if(w.timeMode==='range'||w.timeMode==='long')return `${fmt(w.startDate)}-${fmt(w.endDate)}`;if(w.timeMode==='deadline')return '截止 '+fmt(w.deadline);return '时间未定'}
function completed(){return state.wishes.filter(w=>w.status==='completed').length}
function heartScore(){return state.wishes.length*5+completed()*10+state.images.length*5+state.messages.length*2+state.wishes.filter(w=>w.surprise?.unlocked).length*15}
function dailyFor(day,role){return state.daily.find(x=>x.day===day && x.by_role===role)}
function otherRole(){return currentRole==='wang'?'han':'wang'}
function roleName(role){return USERS.find(u=>u.role===role)?.name || 'TA'}
function avatar(role){const u=USERS.find(x=>x.role===role)||USERS[0];return `<img class="avatar" src="${u.avatar}" alt="${esc(u.name)}">`}
function today(){return new Date().toISOString().slice(0,10)}
function questionText(d=today()){let n=0;for(let c of d)n+=c.charCodeAt(0);return QUESTIONS[n%QUESTIONS.length]}
function fmt(v){if(!v)return '未定';let d=new Date(v);return isNaN(d)?v:d.toLocaleDateString('zh-CN',{month:'short',day:'numeric'})}
function fmtTime(v){if(!v)return '';let d=new Date(v);return isNaN(d)?v:d.toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function esc(s=''){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function showModal(html){document.getElementById('modal').innerHTML=html;document.getElementById('modalBackdrop').classList.add('show')}
function closeModal(){document.getElementById('modalBackdrop').classList.remove('show')}
function backdropClose(e){if(e.target.id==='modalBackdrop')closeModal()}
function toast(t){let w=document.getElementById('toastWrap'),d=document.createElement('div');d.className='toast';d.textContent=t;w.appendChild(d);setTimeout(()=>d.remove(),3000)}
function throwAndShow(error){console.error(error);toast(error.message || '操作失败');throw error}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='情侣99件事云端备份_'+today()+'.json';a.click();URL.revokeObjectURL(a.href)}
function secretClick(){hiddenClicks++;setTimeout(()=>hiddenClicks=0,1800);if(hiddenClicks>=7){hiddenClicks=0;if(completed()>=99)showEgg();else toast('还有一些小事，等你们一起完成。')}}
async function showEgg(){let egg=state.appState.egg||{wang:false,han:false,finalAt:null};let e=document.getElementById('egg');e.innerHTML=`<div class="egg-card"><img src="${HIDDEN_FINAL}"><h1>我们结婚吧！</h1><p class="sub">99件小事之后，是更长的一生。</p><div class="list"><div class="feed">${avatar('wang')}<p>小王同学：${egg.wang?'我愿意 ❤️':'等待确认 🤍'}</p></div><div class="feed">${avatar('han')}<p>小韩同学：${egg.han?'我愿意 ❤️':'等待确认 🤍'}</p></div></div>${egg.finalAt?`<p><b>${fmtTime(egg.finalAt)}</b></p>`:`<button class="btn purple" onclick="confirmEgg()">${esc(roleName(currentRole))}：我愿意</button>`}<button class="btn secondary" onclick="document.getElementById('egg').classList.remove('show')">回到页面</button></div>`;e.classList.add('show')}
async function confirmEgg(){let egg=state.appState.egg||{wang:false,han:false,finalAt:null};egg[currentRole]=true;if(egg.wang&&egg.han&&!egg.finalAt){egg.finalAt=new Date().toISOString();await logActivity('你们一起确认了隐藏终章')}await sb.from('couple_app_state').upsert({id:'egg',value:egg,updated_at:new Date().toISOString()});await loadAll();showEgg()}
