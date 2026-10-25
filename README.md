# Entre Nós ♡

Espaço privado para um casal: contas individuais, conexão por convite, chat em tempo real, fotos compartilhadas, filmes e séries, metas e chamadas de voz WebRTC. Interface em português e adaptada ao celular.

## Desenvolvimento

Requer Node.js 24 ou superior. Use o checkout existente; não é necessário criar worktree.

```sh
npm ci --cache /workspace/.npm-cache
npm test
npm run dev
```

O servidor usa a porta 3000 (substituível por `PORT`). Para iniciar sem observar alterações, use `npm start`. Crie duas contas, copie o código exibido na primeira e conecte a segunda. Não existem contas ou dados fictícios pré-cadastrados.

Dados persistem em `data/app.sqlite` e fotos em `data/uploads`, ambos ignorados pelo Git. `DATA_DIR` permite alterar o diretório. Faça backup consistente do SQLite e das fotos; não coloque essa pasta em um diretório público. Cada casal acessa somente seus próprios dados. As senhas usam scrypt e as sessões usam cookies HttpOnly, com expiração de 30 dias. Não há recuperação de senha por e-mail nesta versão.

## Publicação e chamadas

Sirva o app por HTTPS com proxy reverso que suporte WebSocket e defina `NODE_ENV=production` (cookies Secure). Execute apenas uma instância; a base SQLite e uploads precisam de volume persistente. O site não foi publicado automaticamente.

As chamadas implementam sinalização autenticada e áudio WebRTC com atender, recusar/encerrar e silenciar. O navegador exige HTTPS e autorização de microfone (localhost é exceção). O STUN padrão é `stun:stun.l.google.com:19302`. Para chamadas confiáveis entre redes diferentes, configure um servidor TURN e estas variáveis no servidor:

- `TURN_URL`: URI `turn:` ou `turns:` do seu provedor.
- `TURN_USERNAME` e `TURN_PASSWORD`: credenciais TURN, inseridas de forma segura no serviço de hospedagem.

As credenciais TURN são entregues ao navegador autenticado, conforme necessário para WebRTC; prefira credenciais temporárias em uma evolução de produção. Não salve segredos no Git. Teste a ligação entre dois aparelhos e redes distintas antes do uso real. Os testes automatizados validam a sinalização, mas não comprovam captura de microfone nem transporte de áudio entre redes reais.

## Escopo

Esta é a primeira versão web funcional. A versão instalável (PWA), notificações em segundo plano, recuperação de senha e vídeo ficam para a próxima etapa. Não há criptografia de ponta a ponta no armazenamento das mensagens ou fotos; o administrador do servidor tem acesso ao banco e aos arquivos. O áudio usa a criptografia do WebRTC.

## Validação realizada neste ambiente

`npm test` passou com cenários reais de API, WebSocket, isolamento entre contas, upload e reinício do banco. Uma verificação adicional com Chromium passou nos fluxos de cadastro, pareamento, mensagens, fotos, metas e filmes em desktop e celular, sem erros JavaScript ou overflow horizontal. A oferta/resposta WebRTC foi negociada com microfones simulados. O áudio não conectou: o Chromium gerenciado possui a política `WebRtcIPHandling=disable_non_proxied_udp` e não há TURN configurado. Isso limita a validação de chamadas neste ambiente; não foi comprovada uma ligação de áudio real.

As fontes DM Sans e Lora são servidas localmente, com licenças em `public/fonts/`.
