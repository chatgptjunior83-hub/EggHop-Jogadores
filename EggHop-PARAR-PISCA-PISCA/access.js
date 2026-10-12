(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const panels=['gateLoading','requestForm','pendingPanel','blockedPanel','configPanel'];
  let lastStatus='';let timer=null;let currentNick='';let currentCode='';let statusBusy=false;
  function show(id){for(const p of panels)$(p).hidden=p!==id;}
  function message(t,ok=false){$('accessNotice').textContent=t;$('accessNotice').className='access-notice'+(ok?' good':'');}
  function unlocked(nick){$('accessGate').hidden=true;document.body.classList.remove('is-locked');$('accountBar').hidden=false;$('activeAccount').textContent=nick;window.eggHopUnlock?.();}
  function locked(){if(!document.body.classList.contains('is-locked'))window.eggHopClear?.();document.body.classList.add('is-locked');$('accessGate').hidden=false;$('accountBar').hidden=true;}
  async function api(endpoint,opts={}){let res;try{res=await fetch('/.netlify/functions/api?route='+encodeURIComponent(endpoint),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(opts.body?{'Content-Type':'application/json'}:{})},...opts});}catch{throw Error('Sem conexão. Confira sua internet.');}
    const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||'Não foi possível consultar o serviço.');return data;}
  function draw(s){
    if(s.status==='approved'){if(lastStatus!=='approved')unlocked(s.nick);lastStatus='approved';return;}
    locked();lastStatus=s.status||'new';
    if(s.status==='pending'){$('pendingNick').textContent=s.nick;currentNick=s.nick;currentCode=s.code;$('pendingCode').textContent=s.code;show('pendingPanel');}
    else if(s.status==='blocked')show('blockedPanel');
    else show('requestForm');
  }
  async function status(){
    // Nao troca de tela por erro temporario de rede se ja houve aprovacao.
    // A API continua exigindo aprovacao real para consultar servidores.
    if(statusBusy)return;
    statusBusy=true;
    try{const r=await api('status');draw(r);message('');}
    catch(e){
      if(lastStatus==='approved'){console.warn('[EggHop] Erro temporario de status:',e.message);return;}
      locked();show('configPanel');message(e.message);
    }finally{statusBusy=false;}
  }
  $('requestForm').addEventListener('submit',async e=>{e.preventDefault();let nick=$('robloxNick').value.trim();if(!/^[A-Za-z0-9_]{3,20}$/.test(nick)){message('Digite um nick válido (3 a 20 letras, números ou _).');return;}
    const b=$('requestBtn');b.disabled=true;message('Enviando pedido...');try{const data=await api('request',{method:'POST',body:JSON.stringify({nick})});draw(data);message('Pedido enviado! Agora envie seu código pelo TikTok.',true);}catch(err){message(err.message);}finally{b.disabled=false;}});
  $('copyPending').addEventListener('click',async()=>{const t=`Meu nick no Roblox: ${currentNick}\nCódigo EggHop: ${currentCode}`;try{await navigator.clipboard.writeText(t);message('Copiado! Envie ao dono pelo TikTok.',true);}catch{message('Copie manualmente o nick e o código acima.');}});
  $('manualRefresh').addEventListener('click',status);
  $('accessExit').addEventListener('click',()=>alert('Seu acesso fica vinculado a este navegador. Não apague os cookies, pois poderá perder a aprovação. Para revogar seu acesso, fale com o administrador pelo TikTok.'));
  timer=setInterval(()=>{if(lastStatus==='pending'||lastStatus==='approved')status();},12000);
  status();
})();
