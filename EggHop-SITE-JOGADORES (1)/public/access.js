/* EggHop 3.0 — proteção contra alternância de telas
   A segurança do acesso continua sendo validada pela função Netlify.
   Esta camada apenas evita piscar por falhas temporárias e por erros da busca.
*/
(() => {
  'use strict';
  window.EGGHOP_FIX_VERSION = 'acesso-estavel-3.0';
  const $ = (id) => document.getElementById(id);
  const panels = ['gateLoading', 'requestForm', 'pendingPanel', 'blockedPanel', 'configPanel'];
  const API = '/.netlify/functions/api?route=';
  let currentStatus = 'checking';
  let currentNick = '';
  let currentCode = '';
  let checking = false;
  let lastCheckAt = 0;
  let missingCookieCount = 0;
  let followupTimer = null;

  function show(id) {
    for (const panel of panels) {
      const el = $(panel);
      if (el) el.hidden = panel !== id;
    }
  }
  function message(text, ok = false) {
    const el = $('accessNotice');
    if (!el) return;
    el.textContent = text;
    el.className = 'access-notice' + (ok ? ' good' : '');
  }
  function unlock(nick) {
    const gate = $('accessGate');
    const bar = $('accountBar');
    const wasLocked = !gate.hidden || document.body.classList.contains('is-locked');
    gate.hidden = true;
    document.body.classList.remove('is-locked');
    bar.hidden = false;
    $('activeAccount').textContent = nick;
    // Só busca servidores quando sai do bloqueio, nunca em cada verificação periódica.
    if (wasLocked) window.eggHopUnlock?.();
  }
  function lock() {
    const gate = $('accessGate');
    const wasUnlocked = gate.hidden && !document.body.classList.contains('is-locked');
    document.body.classList.add('is-locked');
    gate.hidden = false;
    $('accountBar').hidden = true;
    if (wasUnlocked) window.eggHopClear?.();
  }
  async function api(route, options = {}) {
    let response;
    try {
      response = await fetch(API + encodeURIComponent(route), {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
        ...options
      });
    } catch {
      throw Error('Sem conexão. Confira sua internet.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(payload.error || `Falha na verificação (${response.status}).`);
    return payload;
  }
  function renderStatus(result) {
    const next = result && typeof result.status === 'string' ? result.status : 'new';
    if (next === 'approved') {
      missingCookieCount = 0;
      clearTimeout(followupTimer);
      currentStatus = 'approved';
      currentNick = String(result.nick || currentNick);
      unlock(currentNick);
      return;
    }
    if (currentStatus === 'approved' && next === 'new') {
      // Um único 'new' pode ser erro momentâneo de cookie/rede. Não derrube a UI.
      missingCookieCount++;
      if (missingCookieCount < 2) {
        clearTimeout(followupTimer);
        followupTimer = setTimeout(() => checkStatus(), 1800);
        console.warn('[EggHop] Status inconsistente, verificando novamente.');
        return;
      }
    }
    // Revogação explícita é aplicada imediatamente. Ação 'new' exige 2 confirmações.
    missingCookieCount = 0;
    clearTimeout(followupTimer);
    currentStatus = next;
    lock();
    if (next === 'pending') {
      currentNick = String(result.nick || '');
      currentCode = String(result.code || '');
      $('pendingNick').textContent = currentNick;
      $('pendingCode').textContent = currentCode;
      show('pendingPanel');
    } else if (next === 'blocked') {
      show('blockedPanel');
    } else {
      show('requestForm');
    }
  }
  async function checkStatus() {
    if (checking) return;
    checking = true;
    lastCheckAt = Date.now();
    try {
      const state = await api('status');
      renderStatus(state);
      if (currentStatus !== 'approved') message('');
    } catch (err) {
      // Uma falha de conexão nunca deve causar pisca-pisca em usuário aprovado.
      if (currentStatus === 'approved') {
        console.warn('[EggHop] Verificação temporariamente indisponível:', err.message);
      } else {
        lock();
        show('configPanel');
        message(err.message);
      }
    } finally {
      checking = false;
    }
  }

  $('requestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const nick = $('robloxNick').value.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(nick)) {
      message('Digite um nick válido (3 a 20 letras, números ou _).');
      return;
    }
    const button = $('requestBtn');
    button.disabled = true;
    message('Enviando pedido...');
    try {
      const result = await api('request', {method: 'POST', body: JSON.stringify({nick})});
      renderStatus(result);
      message('Pedido enviado! Envie seu código pelo TikTok.', true);
    } catch (err) {
      message(err.message);
    } finally {
      button.disabled = false;
    }
  });
  $('copyPending').addEventListener('click', async () => {
    const text = `Meu nick no Roblox: ${currentNick}\nCódigo EggHop: ${currentCode}`;
    try {
      await navigator.clipboard.writeText(text);
      message('Copiado! Envie ao dono pelo TikTok.', true);
    } catch {
      message('Copie manualmente o nick e o código acima.');
    }
  });
  $('manualRefresh').addEventListener('click', checkStatus);
  $('accessExit').addEventListener('click', () => alert('O acesso está associado a este navegador. Não apague os cookies. Para desvincular, fale com o administrador.'));

  // Compatibilidade com versões antigas de app.js que disparam egghop:lock
  // ao receber 403 de servidores: confirme o status real, nunca feche a tela aqui.
  window.addEventListener('egghop:lock', () => {
    if (!checking && Date.now() - lastCheckAt > 3000) checkStatus();
  });
  setInterval(() => {
    if (currentStatus === 'approved' || currentStatus === 'pending') checkStatus();
  }, 12000);
  checkStatus();
})();
