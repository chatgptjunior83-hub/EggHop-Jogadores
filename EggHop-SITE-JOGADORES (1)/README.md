# 01 — SITE DOS JOGADORES (EggHop)

Este é o site que você manda pelo TikTok. O visitante digita SOMENTE o nick Roblox e recebe um código de confirmação para te enviar junto do nick. Nenhuma senha Roblox é solicitada. Você aprova o pedido no outro site, o EggHop Admin.

## Publicação

1. Crie um repositório GitHub público SEPARADO, por exemplo `EggHop-Jogadores`, e envie **o conteúdo desta pasta** para a raiz do repositório.
2. Na Netlify, clique em **Add new project → Import from Git** e selecione esse repositório.
3. Em **Project configuration → Environment variables**, crie duas variáveis:
   - `SESSION_SECRET`: uma chave aleatória com 32 ou mais caracteres, exclusiva do site dos jogadores.
   - `ADMIN_BRIDGE_SECRET`: outra chave aleatória com 32 ou mais caracteres. **Copie exatamente a mesma chave na variável ADMIN_BRIDGE_SECRET do site do administrador.**
4. Faça um novo deploy e guarde o endereço HTTPS, como `https://egghop-jogadores.netlify.app`.
5. Use esse endereço em `PLAYER_SITE_URL` nas variáveis do site administrador.

O armazenamento de aprovações fica no **Netlify Blobs** deste site, não na máquina de quem acessa. O segundo site conversa com esse backend através de um segredo que nunca vai para o navegador. A lista de servidores públicos do Roblox só é consultada por pessoas autorizadas.

Avisos: abrir apenas o HTML no Edge não ativa os pedidos nem a busca. É preciso implantar via Git na Netlify com as funções. Um nick não comprova posse da conta Roblox. A liberação fica vinculada à sessão do navegador por cookie; quem apagar dados do navegador ou mudar de celular precisará de nova aprovação. Este produto não é afiliado ao Roblox. O Roblox pode impedir a entrada no servidor exato.

**Nunca compartilhe SESSION_SECRET ou ADMIN_BRIDGE_SECRET e não as coloque no GitHub.**
