/* EggHop - acesso estavel 4.0
   A API da Netlify continua sendo a autoridade sobre quem pode acessar.
   Uma falha temporaria da rede ou da consulta de servidores nao deve
   derrubar a tela de um usuario ja aprovado.
*/
(() => {
  'use strict';
  window.EGGHOP_FIX_VERSION = 'acesso-estavel-4.0';

  const $ = (id) => document.getElementById(id);
  const panels = ['gateLoading', 'requestForm', 'pendingPanel', 'blockedPanel', 'configPanel'];
  const API = '/.netlify/functions/api?route=';
  let currentStatus = 'checking';
  let currentNick = '';
  let currentCode = '';
  let statusPromise = null;
  let lastCheckAt = 0;
  let tentativeRevocation = null;

  function show(id) {
    for (const name of panels) {
      const panel = $(name);
      if (panel) panel.hidden = name !== id;
    }
  }

  function message(text, ok = false) {
    const notice = $('accessNotice');
    if (!notice) return;
    notice.textContent = text;
    notice.className = 'access-notice' + (ok ? ' good' : '');
  }

  function unlock(nick) {
    const gate = $('accessGate');
    const wasLocked = !gate.hidden || document.body.classList.contains('is-locked');
    gate.hidden = true;
    document.body.classList.remove('is-locked');
    $('accountBar').hidden = false;
    $('activeAccount').textContent = nick;
    // Consultar servidores somente na primeira liberacao, e nao em cada polling.
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

  async function api(endpoint, options = {}) {
    let response;
    try {
      response = await fetch(API + encodeURIComponent(endpoint), {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {})
        },
        ...options
      });
    } catch {
      throw new Error('Sem conexao. Confira sua internet.');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Erro na verificacao (${response.status}).`);
    return body;
  }

  function draw(result) {
    const next = result && typeof result.status === 'string' ? result.status : 'new';

    if (next === 'approved') {
      tentativeRevocation = null;
      currentStatus = 'approved';
      currentNick = String(result.nick || currentNick);
      unlock(currentNick);
      return;
    }

    // Um status 'new'/'pending' isolado depois de aprovado pode ocorrer
    // quando ha uma falha transitoria de sessao. Peça uma segunda confirmacao.
    // Um bloqueio explicito do administrador e aplicado imediatamente.
    if (currentStatus === 'approved' && next !== 'blocked') {
      if (!tentativeRevocation || tentativeRevocation.status !== next) {
        tentativeRevocation = { status: next, at: Date.now() };
        return;
      }
      if (Date.now() - tentativeRevocation.at < 2500) return;
    }

    tentativeRevocation = null;
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

  function checkStatus() {
    // Impede requisicoes concorrentes que poderiam chegar fora de ordem.
    if (statusPromise) return statusPromise;
    lastCheckAt = Date.now();
    statusPromise = (async () => {
      try {
        const data = await api('status');
        draw(data);
        if (currentStatus !== 'approved') message('');
      } catch (error) {
        if (currentStatus === 'approved') {
          // Mantenha a interface visivel, mas nunca contorne a validacao do backend.
          console.warn('[EggHop] Falha temporaria de acesso:', error.message);
        } else {
          lock();
          show('configPanel');
          message(error.message);
        }
      }
    })().finally(() => { statusPromise = null; });
    return statusPromise;
  }

  $('requestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const nick = $('robloxNick').value.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(nick)) {
      message('Digite um nick valido (3 a 20 letras, numeros ou _).');
      return;
    }
    const button = $('requestBtn');
    button.disabled = true;
    message('Enviando pedido...');
    try {
      const data = await api('request', {method: 'POST', body: JSON.stringify({nick})});
      draw(data);
      message('Pedido enviado! Envie seu codigo pelo TikTok.', true);
    } catch (error) {
      message(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $('copyPending').addEventListener('click', async () => {
    const text = `Meu nick no Roblox: ${currentNick}\nCodigo EggHop: ${currentCode}`;
    try {
      await navigator.clipboard.writeText(text);
      message('Copiado! Envie ao dono pelo TikTok.', true);
    } catch {
      message('Copie manualmente o nick e o codigo acima.');
    }
  });

  $('manualRefresh').addEventListener('click', checkStatus);
  $('accessExit').addEventListener('click', () => alert(
    'Seu acesso esta vinculado a este navegador. Nao apague os cookies. Para desvincular, fale com o administrador pelo TikTok.'
  ));

  // O app de servidores pode disparar este evento quando a consulta falha.
  // NUNCA esconda a interface aqui. Apenas confirme o status com a API.
  window.addEventListener('egghop:lock', () => {
    if (Date.now() - lastCheckAt > 2000) checkStatus();
  });

  setInterval(() => {
    if (currentStatus === 'pending' || currentStatus === 'approved') checkStatus();
  }, 12000);
  checkStatus();
})();
