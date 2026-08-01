export const ADMIN_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Resin Free Proxy Sync</title>
  <style>
    :root{color-scheme:light;--bg:#f4f6f8;--surface:#fff;--text:#182026;--muted:#66727d;--line:#dce2e7;--accent:#156f5a;--accent2:#0d5746;--danger:#b42318;--warn:#a15c00;--ok:#157347;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box;letter-spacing:0}body{margin:0;background:var(--bg);color:var(--text);font-size:14px}button,input,select{font:inherit}button{border:1px solid var(--line);background:#fff;color:var(--text);height:36px;padding:0 14px;border-radius:6px;cursor:pointer}button:hover{border-color:#aab5bd}button.primary{background:var(--accent);border-color:var(--accent);color:#fff}button.primary:hover{background:var(--accent2)}button:disabled{opacity:.55;cursor:not-allowed}.topbar{background:#fff;border-bottom:1px solid var(--line);padding:18px max(20px,calc((100vw - 1180px)/2));display:flex;align-items:center;justify-content:space-between;gap:20px;position:sticky;top:0;z-index:5}.brand h1{font-size:20px;margin:0 0 3px}.brand p{margin:0;color:var(--muted);font-size:12px}.auth{display:flex;gap:8px;align-items:center}.auth input{width:270px}.wrap{max-width:1180px;margin:0 auto;padding:22px 20px 50px}.status-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:#fff;border:1px solid var(--line);border-radius:6px;margin-bottom:18px}.metric{padding:14px 16px;border-right:1px solid var(--line);min-width:0}.metric:last-child{border-right:0}.metric span{display:block;color:var(--muted);font-size:12px;margin-bottom:4px}.metric strong{font-size:15px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.section{background:#fff;border:1px solid var(--line);border-radius:6px;margin-top:16px}.section-head{padding:15px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}.section-head h2{font-size:15px;margin:0}.section-body{padding:18px}.form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.field{display:flex;flex-direction:column;gap:6px;min-width:0}.field label,.group-label{font-size:12px;color:var(--muted)}input,select{height:36px;border:1px solid var(--line);border-radius:5px;padding:0 10px;background:#fff;color:var(--text);min-width:0}.toggle{display:flex;align-items:center;gap:8px;height:36px}.toggle input,.source input,.protocol input{width:16px;height:16px}.protocols{display:flex;gap:16px;align-items:center;height:36px;flex-wrap:wrap}.protocol{display:flex;align-items:center;gap:6px}.sources{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--line);border-radius:5px;overflow:hidden}.source{display:flex;align-items:center;gap:9px;padding:10px 12px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);min-width:0}.source span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.muted{color:var(--muted)}.ok{color:var(--ok)}.bad{color:var(--danger)}.warn{color:var(--warn)}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;color:var(--muted);font-weight:600;background:#fafbfc}.table-wrap{overflow:auto}.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.pill{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:999px;background:#edf2f4;font-size:12px}.notice{padding:11px 12px;background:#fff8e8;border:1px solid #f0d59a;border-radius:5px;color:#744300;margin-bottom:16px;display:none}.notice.show{display:block}.empty{padding:24px;text-align:center;color:var(--muted)}@media(max-width:850px){.topbar{align-items:flex-start;flex-direction:column}.auth{width:100%}.auth input{flex:1;width:auto}.status-strip{grid-template-columns:1fr 1fr}.metric{border-bottom:1px solid var(--line)}.form-grid{grid-template-columns:1fr 1fr}.sources{grid-template-columns:1fr 1fr}}@media(max-width:560px){.wrap{padding:14px 10px 40px}.form-grid,.sources,.status-strip{grid-template-columns:1fr}.metric,.source{border-right:0}.auth{flex-wrap:wrap}.auth input{width:100%;flex-basis:100%}.section-body{padding:14px}}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand"><h1>Resin Free Proxy Sync</h1><p>Cloudflare Worker</p></div>
    <div class="auth">
      <input id="admin-token" type="password" autocomplete="off" placeholder="Admin Token">
      <button id="connect">连接</button>
      <button id="save" class="primary" disabled>保存</button>
      <button id="run" disabled>立即同步</button>
    </div>
  </header>
  <main class="wrap">
    <div id="notice" class="notice"></div>
    <div class="status-strip">
      <div class="metric"><span>运行状态</span><strong id="status">未连接</strong></div>
      <div class="metric"><span>代理快照</span><strong id="proxy-count">-</strong></div>
      <div class="metric"><span>上次运行</span><strong id="last-run">-</strong></div>
      <div class="metric"><span>Resin 订阅</span><strong id="resin-status">-</strong></div>
      <div class="metric"><span>环境</span><strong id="env-status">-</strong></div>
    </div>

    <section class="section">
      <div class="section-head"><h2>自动任务</h2><span class="muted">Cron 每 5 分钟检查一次配置时间</span></div>
      <div class="section-body form-grid">
        <div class="field"><span class="group-label">启用</span><label class="toggle"><input id="enabled" type="checkbox">每日自动同步</label></div>
        <div class="field"><label for="daily-time">执行时间</label><input id="daily-time" type="time" step="300"></div>
        <div class="field"><label for="timezone">时区</label><input id="timezone" value="Asia/Shanghai"></div>
        <div class="field"><label for="limit">每来源上限</label><input id="limit" type="number" min="1" max="5000"></div>
        <div class="field"><label for="sub-name">Resin 订阅名</label><input id="sub-name"></div>
        <div class="field"><label for="interval">Resin 更新间隔</label><select id="interval"><option value="30m">30m</option><option value="1h">1h</option><option value="6h">6h</option><option value="12h">12h</option><option value="24h">24h</option></select></div>
        <div class="field" style="grid-column:span 2"><span class="group-label">协议</span><div class="protocols"><label class="protocol"><input type="checkbox" name="protocol" value="http">HTTP</label><label class="protocol"><input type="checkbox" name="protocol" value="https">HTTPS</label><label class="protocol"><input type="checkbox" name="protocol" value="socks5">SOCKS5</label></div></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>免费代理来源</h2><span id="source-meta" class="muted">-</span></div>
      <div class="section-body"><div id="sources" class="sources"></div></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>最近一次来源结果</h2><span id="run-error" class="bad"></span></div>
      <div class="table-wrap"><table><thead><tr><th>来源</th><th>结果</th><th>数量</th><th>耗时</th></tr></thead><tbody id="source-results"><tr><td colspan="4" class="empty">暂无运行记录</td></tr></tbody></table></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>运行历史</h2><span class="muted">保留最近 20 次</span></div>
      <div class="table-wrap"><table><thead><tr><th>时间</th><th>触发</th><th>状态</th><th>代理</th><th>Resin</th><th>耗时</th></tr></thead><tbody id="history"><tr><td colspan="6" class="empty">暂无运行记录</td></tr></tbody></table></div>
    </section>
  </main>
  <script>
    const tokenInput=document.getElementById('admin-token');const connectBtn=document.getElementById('connect');const saveBtn=document.getElementById('save');const runBtn=document.getElementById('run');const notice=document.getElementById('notice');let model=null;tokenInput.value=sessionStorage.getItem('resin-sync-token')||'';
    function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
    function showNotice(message,bad=false){notice.textContent=message;notice.className='notice show'+(bad?' bad':'');setTimeout(()=>notice.classList.remove('show'),5000)}
    async function api(path,options={}){const token=tokenInput.value.trim();const response=await fetch(path,{...options,headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}});const text=await response.text();let data={};try{data=JSON.parse(text)}catch{data={error:text}}if(!response.ok)throw new Error(data.error||data.detail||('HTTP '+response.status));return data}
    function checked(name){return [...document.querySelectorAll('input[name="'+name+'"]:checked')].map(el=>el.value)}
    function render(data){model=data;const s=data.settings;document.getElementById('enabled').checked=s.enabled;document.getElementById('daily-time').value=s.dailyTime;document.getElementById('timezone').value=s.timezone;document.getElementById('limit').value=s.perSourceLimit;document.getElementById('sub-name').value=s.resinSubscriptionName;document.getElementById('interval').value=s.resinUpdateInterval;document.querySelectorAll('input[name="protocol"]').forEach(el=>el.checked=s.protocols.includes(el.value));document.getElementById('sources').innerHTML=data.sources.map(src=>'<label class="source" title="'+esc(src.id)+'"><input type="checkbox" name="source" value="'+esc(src.id)+'" '+(s.sourceIds.includes(src.id)?'checked':'')+'><span>'+esc(src.name)+'</span></label>').join('');document.getElementById('source-meta').textContent=s.sourceIds.length+' / '+data.sources.length+' 已选';const state=data.state||{};document.getElementById('status').textContent=state.running?('运行中 · '+state.stage):(state.lastResult?state.lastResult.status:'空闲');document.getElementById('status').className=state.running?'warn':(state.lastResult?.status==='failed'?'bad':'ok');document.getElementById('proxy-count').textContent=data.snapshot?data.snapshot.count+' 条':'0 条';document.getElementById('last-run').textContent=state.lastResult?new Date(state.lastResult.finishedAt).toLocaleString():'-';document.getElementById('resin-status').textContent=state.lastResult?.resin?(state.lastResult.resin.action+' · '+state.lastResult.resin.subscriptionId.slice(0,8)):'-';document.getElementById('env-status').textContent=data.environment.ready?'就绪':'缺少配置';document.getElementById('env-status').className=data.environment.ready?'ok':'bad';document.getElementById('run-error').textContent=state.lastResult?.error||'';const results=state.lastResult?.sourceResults||[];document.getElementById('source-results').innerHTML=results.length?results.map(item=>'<tr><td>'+esc(item.name)+'</td><td class="'+(item.error?'bad':'ok')+'">'+(item.error?esc(item.error):'成功')+'</td><td>'+item.count+'</td><td>'+item.elapsedMs+' ms</td></tr>').join(''):'<tr><td colspan="4" class="empty">暂无运行记录</td></tr>';const history=state.history||[];document.getElementById('history').innerHTML=history.length?history.map(item=>'<tr><td>'+new Date(item.finishedAt).toLocaleString()+'</td><td>'+esc(item.reason)+'</td><td class="'+(item.status==='completed'?'ok':'bad')+'">'+esc(item.status)+'</td><td>'+item.proxyCount+'</td><td>'+(item.resin?esc(item.resin.action):'-')+'</td><td>'+Math.round(item.durationMs/1000)+'s</td></tr>').join(''):'<tr><td colspan="6" class="empty">暂无运行记录</td></tr>';saveBtn.disabled=false;runBtn.disabled=state.running}
    async function load(){try{sessionStorage.setItem('resin-sync-token',tokenInput.value.trim());render(await api('/api/status'));}catch(error){saveBtn.disabled=true;runBtn.disabled=true;showNotice(error.message,true)}}
    connectBtn.onclick=load;saveBtn.onclick=async()=>{try{const body={enabled:document.getElementById('enabled').checked,dailyTime:document.getElementById('daily-time').value,timezone:document.getElementById('timezone').value,perSourceLimit:Number(document.getElementById('limit').value),resinSubscriptionName:document.getElementById('sub-name').value,resinUpdateInterval:document.getElementById('interval').value,protocols:checked('protocol'),sourceIds:checked('source')};await api('/api/settings',{method:'PUT',body:JSON.stringify(body)});showNotice('设置已保存');await load()}catch(error){showNotice(error.message,true)}};runBtn.onclick=async()=>{try{runBtn.disabled=true;const result=await api('/api/run',{method:'POST',body:'{}'});showNotice('任务已启动: '+result.runId);setTimeout(load,1200)}catch(error){runBtn.disabled=false;showNotice(error.message,true)}};setInterval(()=>{if(tokenInput.value.trim()&&model?.state?.running)load()},3000);if(tokenInput.value.trim())load();
  </script>
</body>
</html>`;
