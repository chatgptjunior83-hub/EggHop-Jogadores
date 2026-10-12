/* EggHop - tela fixa apos aprovacao - egghop-tela-fixa-1
 * Depois de confirmada a aprovacao, a tela de entrada some ate recarregar a pagina.
 * A permissao verdadeira continua sendo checada pelo backend da Netlify.
 */
(()=>{
  'use strict';
  window.EGGHOP_ACCESS_VERSION = 'egghop-tela-fixa-1';
  const $ = id => document.getElementById(id);
  const panels = ['gateLoading','requestForm','pendingPanel','blockedPanel','configPanel'];
  let lastStatus = '';
  let timer = null;
  let currentNick = '';
  let currentCode = '';
  let approvedOnThisPage = false;

  function show(id) {
    for (const p of panels) {
      const node = $(p);
      if (node) node.hidden = p !== id;
    }
  }
  function message(text, ok = false) {
    const node = $('accessNotice');
    if (!node) return;
    node.textContent = text;
    node.className = 'access-notice' + (ok ? ' good' : '');
  }
  function unlocked(nick) {
    // Uma vez aprovado, nao reabrir a tela de verificacao nesta pagina.
    if (approvedOnThisPage) return;
    approvedOnThisPage = true;
    lastStatus = 'approved';
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    $('accessGate').hidden = true;
    document.body.classList.remove('is-locked');
    $('accountBar').hidden = false;
    $('activeAccount').textContent = nick || currentNick;
    window.eggHopUnlock?.();
  }
  function locked() {
    if (approvedOnThisPage) return;
    if (!document.body.classList.contains('is-locked')) window.eggHopClear?.();
    document.body.classList.add('is-locked');
    $('accessGate').hidden = false;
    $('accountBar').hidden = true;
  }
  async function api(endpoint, opts = {}) {
    let res;
    try {
      res = await fetch('/.netlify/functions/api?route=' + encodeURIComponent(endpoint), {
        credentials:'same-origin',cache:'no-store',
        headers:{Accept:'application/json',...(opts.body?{'Content-Type':'application/json'}:{})},
        ...opts
      });
    } catch {
      throw Error('Sem conexao. Confira sua internet.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(data.error || 'Nao foi possivel consultar o servico.');
    return data;
  }
  function draw(s) {
    if (approvedOnThisPage) return;
    if (s.status === 'approved') {
      unlocked(s.nick);
      message('');
      return;
    }
    locked();
    lastStatus = s.status || 'new';
    if (s.status === 'pending') {
      $('pendingNick').textContent = s.nick;
      currentNick = s.nick;
      currentCode = s.code;
      $('pendingCode').textContent = s.code;
      show('pendingPanel');
    } else if (s.status === 'blocked') {
      show('blockedPanel');
    } else {
      show('requestForm');
    }
  }
  async function status() {
    if (approvedOnThisPage) return;
    try {
      const result = await api('status');
      draw(result);
      if (!approvedOnThisPage) message('');
    } catch (e) {
      if (approvedOnThisPage) return; // Nunca piscar por erro temporario.
      locked();
      show('configPanel');
      message(e.message);
    }
  }
  $('requestForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (approvedOnThisPage) return;
    const nick = $('robloxNick').value.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(nick)) {
      message('Digite um nick valido (3 a 20 letras, numeros ou _).');
      return;
    }
    const btn = $('requestBtn');
    btn.disabled = true;
    message('Enviando pedido...');
    try {
      const result = await api('request', {method:'POST',body:JSON.stringify({nick})});
      draw(result);
      if (!approvedOnThisPage) message('Pedido enviado! Envie seu codigo pelo TikTok.', true);
    } catch(err) {
      if (!approvedOnThisPage) message(err.message);
    } finally {
      btn.disabled = false;
    }
  });
  $('copyPending').addEventListener('click', async () => {
    const text = `Meu nick no Roblox: ${currentNick}\nCodigo EggHop: ${currentCode}`;
    try { await navigator.clipboard.writeText(text); message('Copiado! Envie ao dono pelo TikTok.',true); }
    catch { message('Copie manualmente o nick e o codigo acima.'); }
  });
  $('manualRefresh').addEventListener('click', status);
  $('accessExit').addEventListener('click', () => alert('Seu acesso fica vinculado a este navegador. Nao apague seus cookies, pois podera perder a aprovacao. Para revogar seu acesso, fale com o administrador pelo TikTok.'));
  // Versoes antigas de app.js podem disparar este evento ao falhar a busca.
  // Falha de busca NAO significa revogacao de acesso.
  window.addEventListener('egghop:lock', () => {
    if (!approvedOnThisPage) status();
  });
  // Somente quem ainda espera aprovacao e verificado automaticamente.
  timer = setInterval(() => {
    if (!approvedOnThisPage && lastStatus === 'pending') status();
  }, 12000);
  status(); // Na abertura/recarregamento, a API decide se o acesso existe.
})();
