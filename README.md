# You & Me

Chat privado de casal com contas individuais, conexão por convite, fotos, filmes e séries, metas e chamadas WebRTC de áudio e vídeo. A tela principal é a conversa. Layout escuro adaptado para iOS, Android e computador.

## Estado desta versão

- Implementado: cadastro/login com e-mail e senha, sessões HttpOnly, isolamento por casal, chat, galeria, listas, metas e presença por sessão/aparelho.
- Implementado: áudio e vídeo com atender, encerrar, silenciar microfone, ligar/desligar câmera e reprodução inline no iPhone.
- Implementado: sinalização persistente por HTTP, compatível com funções do Vercel. Atualizações e presença são consultadas a cada 2 segundos, sem servidor Socket.IO.
- Preparado: publicação no Vercel e armazenamento persistente em PostgreSQL.
- Pendente: configurar PostgreSQL no ambiente do Vercel, aplicar a migração e configurar um servidor TURN real. Sem TURN, chamadas usam conexão direta e podem falhar em redes móveis ou restritas.
- Pendente: teste de captura de câmera/microfone e transporte de áudio/vídeo entre dois aparelhos e redes reais. Testes de API não comprovam esse transporte.
- O deploy pelo conector foi recusado com HTTP 403 por falta de permissão para criar o projeto na equipe fernando-8621. Não há URL nova do Vercel validada.

## Desenvolvimento local

Requer Node.js 24 ou superior.

```sh
npm ci
npm test
npm start
```

Abra `http://localhost:3000`. Crie duas contas com senha de pelo menos 10 caracteres e conecte usando o código de convite. Não há contas de exemplo. Sem `DATABASE_URL`, o desenvolvimento usa `data/app-v2.sqlite`; nenhum dado de aplicação é gravado no Git. O arquivo SQLite anterior `data/app.sqlite`, caso exista, permanece intacto e não é migrado automaticamente.

## Vercel e banco persistente

1. Importe `FernandoReys/you---me` na equipe desejada do Vercel. `vercel.json` contém as rotas da função Node e a configuração dos arquivos estáticos.
2. Crie um banco PostgreSQL separado para este app (por exemplo, Neon). Copie `.env.example` para `.env.local` e preencha `DATABASE_URL` (conexão pooled) e `DATABASE_URL_UNPOOLED` (conexão direta). Não reutilize tabelas de outros projetos.
3. Aplique o esquema uma vez ao banco correto:

```sh
npm run db:migrate
```

4. Configure `DATABASE_URL` no Vercel como variável secreta de produção. A conexão direta de migração não precisa ser exposta ao runtime. Faça o deploy da branch `main` para produção.
5. Verifique `/api/health`, cadastro, login, pareamento, envio/recebimento e persistência após uma nova publicação. A API recusa inicializar SQLite no Vercel: evita aparentar persistência usando disco temporário.

As fotos são armazenadas em uma tabela privada com bytes binários no mesmo banco e só são servidas após autenticação e autorização do casal. O limite é 3 MB por foto para respeitar o limite de requisição das funções. A lista de mensagens/galeria retorna apenas metadados, nunca os bytes das fotos. Para uma galeria grande, migre os bytes para um serviço de objetos privado.

## Áudio e vídeo

O app exige HTTPS, permissão do microfone/câmera e as duas pessoas com o app aberto. Inclua TURN sobre TLS/TCP na porta 443 para redes restritas. Configure no Vercel:

- `TURN_URL`: um ou mais endereços reais `turn:`/`turns:`, separados por vírgula.
- `TURN_SHARED_SECRET`: segredo do seu coturn para gerar credenciais temporárias por usuário (preferível).
- Alternativa ao segredo compartilhado: `TURN_USERNAME` e `TURN_PASSWORD` do seu provedor.

Não use contas públicas de relay nem publique segredos. As credenciais temporárias necessárias ao WebRTC são retornadas apenas a usuários autenticados, com validade de uma hora. Sem configuração real, `/api/rtc` informa `relayConfigured: false`.

Os sinais de chamada têm ID próprio para evitar misturar chamadas antigas. Candidatos ICE são enfileirados até a oferta/resposta ser enviada. Há timeout de 60 segundos, tratamento de ocupado, câmera local silenciosa e um botão para liberar reprodução se o navegador bloquear o áudio.

## Presença e celular

O cabeçalho identifica a conta em uso; a conversa mostra o nome do par, online/offline e último acesso. A presença usa heartbeat por sessão: ocultar uma aba não derruba o status de outra sessão ativa. Sem heartbeat por 20 segundos, o usuário é considerado offline. Fechar o app sem rede pode levar até esse tempo para refletir o status.

O manifest e os ícones permitem adicionar à Tela de Início quando suportado pelo navegador. No iPhone: Safari → Compartilhar → Adicionar à Tela de Início. No Android: menu do Chrome → Instalar app/Adicionar à tela inicial. O chat precisa de internet.

## Alertas e autenticação

O menu da conta oferece alertas opcionais do navegador enquanto o app está aberto. Não há serviço de push com o app fechado, chamada de fundo, recuperação de senha por e-mail ou verificação de e-mail nesta versão. O e-mail é um identificador de conta e não implica endereço verificado. As mensagens/fotos não têm criptografia de ponta a ponta no armazenamento.

Senhas usam scrypt; tokens de sessão são armazenados como hash SHA-256 e enviados em cookies HttpOnly/SameSite=Strict/Secure na produção. Tentativas de login são limitadas no banco; cada rota autoriza a conta e o casal. Configure autenticação gerenciada e entrega de e-mail antes de ampliar o uso além do piloto do casal.

## Validação

`npm test` cobre contas, login, sessões independentes, presença em vários aparelhos, isolamento, convite, mensagens, fotos privadas, filmes/metas, sinalização de vídeo, credenciais TURN temporárias e persistência após reinício local. `npm run build` verifica sintaxe e manifest. Não foram validados PostgreSQL de produção, publicação no Vercel, notificações no sistema operacional ou chamadas em aparelhos reais.

Fontes DM Sans e Lora são servidas localmente; licenças em `public/fonts/`.
