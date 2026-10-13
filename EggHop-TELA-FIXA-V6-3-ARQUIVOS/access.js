/* EggHop - TELA-FIXA-V6 (13-10-2026)
   Apenas a API de status confirma autorizacao. Apos approved, a tela de
   verificacao nao e mais exibida nesta aba. A API continua protegendo os
   endpoints de servidores, inclusive depois de bloqueio administrativo. */
(() => {
  'use strict';
  if (window.EGGHOP_GATE_V6_LOADED) return;
  window.EGGHOP_GATE_V6_LOADED = true;
  window.EGGHOP_ACCESS_VERSION = 'TELA-FIXA-V6';

  const $ = id => document.getElementById(id);
  const panels = ['gateLoading','requestForm','pendingPanel','blockedPanel','configPanel'];
  const API = '/.netlify/functions/api?route=';
  let approved = false;
  let nick = '';
  let code = '';
  let currentStatus = 'checking';
  let inflight = null;
  let generation = 0;
  let triggeredUnlock = false;

  function showPanel(which) {
    panels.forEach(id => { const el=$(id); if(el) el.hidden = id !== which; });
  }
  function message(text, ok=false) {
    const el=$('accessNotice'); if(!el) return;
    el.textContent=text;
    el.className='access-notice'+(ok?' good':'');
  }
  function allow(user) {
    if (approved) return;
    approved=true;
    currentStatus='approved';
    nick=String(user||nick);
    const gate=$('accessGate');
    if (gate) gate.hidden=true;
    document.body.classList.remove('is-locked');
    $('accountBar').hidden=false;
    $('activeAccount').textContent=nick;
    message('');
    if(!triggeredUnlock) {
      triggeredUnlock=true;
      // A listagem de servidores so e iniciada na primeira aprovacao.
      // Erros posteriores da listagem nao podem reabrir a tela de entrada.
      window.eggHopUnlock?.();
    }
  }
  function deny() {
    if (approved) return; // never flicker after approval in the same tab
    document.body.classList.add('is-locked');
    $('accountBar').hidden=true;
    $('accessGate').hidden=false;
  }
  function update(data) {
    if(approved) return; // immutable UI state once approved in this tab
    const next=data && typeof data.status==='string'?data.status:'invalid';
    if(next==='approved') { allow(data.nick); return; }
    currentStatus=next;
    deny();
    if(next==='pending') {
      nick=String(data.nick||''); code=String(data.code||'');
      $('pendingNick').textContent=nick;
      $('pendingCode').textContent=code;
      showPanel('pendingPanel');
    } else if(next==='blocked') {
      showPanel('blockedPanel');
    } else if(next==='new') {
      showPanel('requestForm');
    } else {
      showPanel('configPanel');
      message('O servidor respondeu de forma inesperada. Tente recarregar.');
    }
  }
  async function api(route, options={}) {
    let response;
    try {
      response=await fetch(API+encodeURIComponent(route),{
        credentials:'same-origin', cache:'no-store',
        headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},
        ...options
      });
    } catch {
      throw new Error('Não foi possível consultar o acesso. Confira sua conexão.');
    }
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||`Falha na verificação (${response.status}).`);
    return data;
  }
  function check() {
    if(approved) return Promise.resolve();
    if(inflight) return inflight;
    const cycle=++generation;
    inflight=api('status').then(data=>{
      if(!approved && generation===cycle) { update(data); message(''); }
    }).catch(err=>{
      if(approved || generation!==cycle) return;
      // A falha nunca alterna telas: conserva a tela pendente.
      if(currentStatus==='pending') message('Não foi possível verificar agora. Use “Verificar novamente”.');
      else { deny();showPanel('configPanel');message(err.message); }
    }).finally(()=>{inflight=null;});
    return inflight;
  }
  $('requestForm').addEventListener('submit',async event=>{
    event.preventDefault();
    if(approved) return;
    const requested=$('robloxNick').value.trim();
    if(!/^[A-Za-z0-9_]{3,20}$/.test(requested)){
      message('Digite um nick válido (3 a 20 caracteres).'); return;
    }
    const btn=$('requestBtn');btn.disabled=true;
    ++generation; // impede resposta antiga sobrescrever o novo pedido
    message('Enviando pedido...');
    try {
      const data=await api('request',{method:'POST',body:JSON.stringify({nick:requested})});
      update(data);
      if(!approved) message('Pedido registrado. Envie o código pelo TikTok.',true);
    } catch(err) {message(err.message);} finally {btn.disabled=false;}
  });
  $('copyPending').addEventListener('click',async()=>{
    const text=`Meu nick no Roblox: ${nick}\nCódigo EggHop: ${code}`;
    try {await navigator.clipboard.writeText(text);message('Copiado! Envie ao dono pelo TikTok.',true);}
    catch {message('Copie manualmente o nick e o código.');}
  });
  $('manualRefresh').addEventListener('click',check);
  $('accessExit').addEventListener('click',()=>alert('O acesso está vinculado a este navegador. Se você for bloqueado, a API impede novas consultas mesmo com a tela aberta. Atualize para verificar novamente.'));

  // Compatibilidade: app.js antigo disparava este evento durante erros 401/403.
  // Nunca reabrir gate automaticamente: a API protege a busca.
  window.addEventListener('egghop:lock',()=>{
    console.warn('[EggHop TELA-FIXA-V6] Ignorando pedido de bloquear a interface.');
  });
  // Só verifica automaticamente enquanto o pedido está pendente.
  // Após approved nenhum setInterval nem erro de busca muda esta tela.
  setInterval(()=>{
    if(!approved && currentStatus==='pending') check();
  },12000);
  check();
})();
