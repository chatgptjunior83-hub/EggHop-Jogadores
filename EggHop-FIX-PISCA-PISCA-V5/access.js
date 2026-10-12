/* EggHop - correcao de tela piscando V5
 * O frontend nunca confunde erro da busca de servidores com revogacao de acesso.
 * A API de acesso continua exigindo a sessao aprovada.
 */
(() => {
  'use strict';
  window.EGGHOP_ACCESS_VERSION = 'egghop-fix-v5';
  const $ = (id) => document.getElementById(id);
  const panels = ['gateLoading','requestForm','pendingPanel','blockedPanel','configPanel'];
  const API = '/.netlify/functions/api?route=';
  let status = 'checking';
  let nick = '';
  let code = '';
  let activeCheck = null;
  let missingCount = 0;
  let lastMismatch = 0;
  let approvalEventFired = false;

  function showPanel(id) {
    for (const panel of panels) {
      const node = $(panel);
      if (node) node.hidden = panel !== id;
    }
  }
  function message(text, ok = false) {
    const node = $('accessNotice');
    if (!node) return;
    node.textContent = text;
    node.className = 'access-notice' + (ok ? ' good' : '');
  }
  function showApproved(userNick) {
    const previouslyApproved = status === 'approved' && approvalEventFired;
    const gate = $('accessGate');
    status = 'approved';
    nick = String(userNick || nick);
    missingCount = 0;
    lastMismatch = 0;
    gate.hidden = true;
    document.body.classList.remove('is-locked');
    $('accountBar').hidden = false;
    $('activeAccount').textContent = nick;
    if (!previouslyApproved) {
      approvalEventFired = true;
      // Esta funcao carrega os servidores UMA UNICA VEZ por liberacao.
      window.eggHopUnlock?.();
    }
  }
  function showLocked() {
    const wasVisible = !$('accessGate').hidden;
    status = 'locked';
    document.body.classList.add('is-locked');
    $('accessGate').hidden = false;
    $('accountBar').hidden = true;
    if (!wasVisible || approvalEventFired) window.eggHopClear?.();
    approvalEventFired = false;
  }
  async function api(route, options = {}) {
    let response;
    try {
      response = await fetch(API + encodeURIComponent(route), {
        credentials: 'same-origin', cache: 'no-store',
        headers: {Accept:'application/json', ...(options.body ? {'Content-Type':'application/json'} : {})},
        ...options
      });
    } catch (error) {
      throw new Error('Sem conexao. Verifique sua internet.');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Erro na verificacao (' + response.status + ').');
    return result;
  }
  function apply(data) {
    const next = typeof data?.status === 'string' ? data.status : 'invalid';
    if (next === 'approved') {
      showApproved(data.nick);
      message('');
      return;
    }
    if (next === 'blocked') {
      // Bloqueio real confirmado pela API: manter a seguranca.
      showLocked();
      status = 'blocked';
      showPanel('blockedPanel');
      return;
    }
    if (status === 'approved') {
      // Se o status oscilar momentaneamente entre new/pending e approved,
      // nao fazemos o navegador piscar. Uma revogacao permanente de sessao
      // exige 3 respostas consecutivas separadas por tempo; o backend
      // sempre protege os dados do Server Hop durante esse intervalo.
      const now = Date.now();
      if (lastMismatch && now - lastMismatch < 4000) return;
      lastMismatch = now;
      missingCount++;
      console.warn('[EggHop V5] Verificacao inconsistente:', next, '(' + missingCount + '/3)');
      if (missingCount < 3) return;
    }
    showLocked();
    status = next;
    if (next === 'pending') {
      nick = String(data.nick || '');
      code = String(data.code || '');
      $('pendingNick').textContent = nick;
      $('pendingCode').textContent = code;
      showPanel('pendingPanel');
    } else if (next === 'new') {
      showPanel('requestForm');
    } else {
      showPanel('configPanel');
      message('Resposta inesperada da verificacao. Tente atualizar.');
    }
  }
  function check() {
    if (activeCheck) return activeCheck;
    activeCheck = api('status')
      .then(apply)
      .catch((err) => {
        console.warn('[EggHop V5] Falha de verificacao:', err.message);
        // Se ja estava autorizado, a interface permanece estavel.
        // A consulta a servidores segue protegida pela API no servidor.
        if (status !== 'approved') {
          showLocked();
          showPanel('configPanel');
          message(err.message);
        }
      })
      .finally(() => { activeCheck = null; });
    return activeCheck;
  }
  $('requestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const requestedNick = $('robloxNick').value.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(requestedNick)) {
      message('Digite um nick valido (3 a 20 letras, numeros ou _).');
      return;
    }
    const button = $('requestBtn');
    button.disabled = true;
    message('Enviando pedido...');
    try {
      const data = await api('request', {method:'POST',body:JSON.stringify({nick:requestedNick})});
      apply(data);
      message('Pedido enviado! Envie seu codigo pelo TikTok.', true);
    } catch(err) { message(err.message); }
    finally { button.disabled = false; }
  });
  $('copyPending').addEventListener('click', async () => {
    const text = `Meu nick no Roblox: ${nick}\nCodigo EggHop: ${code}`;
    try { await navigator.clipboard.writeText(text); message('Copiado! Envie ao dono pelo TikTok.',true); }
    catch { message('Copie manualmente o nick e o codigo acima.'); }
  });
  $('manualRefresh').addEventListener('click', check);
  $('accessExit').addEventListener('click', () => alert('Seu acesso e vinculado a este navegador. Nao apague seus cookies. Para revogar o acesso, fale com o administrador.'));

  // O app de servidores nunca pode bloquear a interface por erro de busca.
  // Compatibilidade com versoes antigas que ainda disparam este evento:
  window.addEventListener('egghop:lock', () => {
    console.warn('[EggHop V5] Evento antigo ignorado; acesso verificado separadamente.');
  });
  setInterval(() => {
    if (status === 'approved' || status === 'pending') check();
  }, 12000);
  check();
})();
