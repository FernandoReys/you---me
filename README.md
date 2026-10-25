# You & Me

Chat privado de casal com contas individuais, conexão por convite, fotos, filmes e séries, metas e chamadas WebRTC de áudio e vídeo. A tela principal é a conversa. Layout escuro adaptado para iOS, Android e computador.

## Estado desta versão

- Implementado: cadastro/login com e-mail e senha, sessões HttpOnly, isolamento por casal, chat, galeria, listas, metas e presença por sessão/aparelho.
- Implementado: áudio e vídeo com atender, encerrar, silenciar microfone, ligar/desligar câmera e reprodução inline no iPhone.
- Implementado: sinalização persistente por HTTP, compatível com funções do Vercel. Atualizações e presença são consultadas a cada 2 segundos, sem servidor Socket.IO.
- Preparado: publicação no Vercel e armazenamento persistente em PostgreSQL.
- PostgreSQL provisionado no Neon, tabelas iniciais criadas e DATABASE_URL configurada nos projetos Vercel `you-me` e `youme`. O banco é exclusivo deste app.
- Pendente: configurar um servidor TURN real. Sem TURN, chamadas usam conexão direta e podem falhar em redes móveis ou restritas.
- Pendente: teste de captura de câmera/microfone e transporte de áudio/vídeo entre dois aparelhos e redes reais. Testes de API não comprovam esse transporte.
- Os projetos `you-me` e `youme` existentes foram localizados e usam a mesma base. Não é necessário criar outro projeto.

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

O menu da conta oferece Web Push por aparelho, incluindo app fechado e tela bloqueada nos sistemas compatíveis. Não há chamada VoIP nativa em segundo plano, recuperação de senha por e-mail ou verificação de e-mail nesta versão. O e-mail é um identificador de conta e não implica endereço verificado. As mensagens/fotos não têm criptografia de ponta a ponta no armazenamento.

Senhas usam scrypt; tokens de sessão são armazenados como hash SHA-256 e enviados em cookies HttpOnly/SameSite=Strict/Secure na produção. Tentativas de login são limitadas no banco; cada rota autoriza a conta e o casal. Configure autenticação gerenciada e entrega de e-mail antes de ampliar o uso além do piloto do casal.

## Validação

`npm test` cobre contas, login, sessões independentes, presença em vários aparelhos, isolamento, convite, mensagens, fotos privadas, filmes/metas, sinalização de vídeo, credenciais TURN temporárias e persistência após reinício local. `npm run build` verifica sintaxe e manifest. Notificações no sistema operacional e chamadas em aparelhos reais continuam sem validação. O esquema PostgreSQL foi aplicado e conferido via conexão Neon; valide `/api/health` após cada publicação.

Fontes DM Sans e Lora são servidas localmente; licenças em `public/fonts/`.

## Integração com o site da Fofinha

Os arquivos de `FernandoReys/site-para-minha-fofinha` foram incorporados em `public/memorias`, preservando as 40 fotos originais, a carta/surpresa, Nossa História, Nosso Tempo e o jogo com seus sprites. O app oferece a aba Nossa História, um álbum original separado das novas fotos do banco e imagens na entrada. Não são links remotos para imagens: os arquivos fazem parte do You & Me. A cópia não sincroniza edições futuras automaticamente.

O link do jogo foi corrigido para `memorias/jogo/index.html` e a referência inexistente `foto39.jpeg` usa o arquivo original `39.jpeg`. A data de início do contador foi preservada do original (04/04/2026). O arquivo `LICENSE-original.txt` mantém a licença de origem. As fotos e páginas copiadas continuam sendo arquivos estáticos públicos, como já eram no repositório original; as novas fotos enviadas pelo app seguem privadas por casal no banco.

### Aparência e experiência no celular

A paleta do casal usa #0E1B48, #C18DB4, #E2CAD8, #87A7D0, #27425D e #0E1F2F. A galeria apresenta 34 momentos, agrupando seis variações semelhantes e preservando os 40 arquivos originais. As miniaturas exibem a foto inteira. Nossa História usa capítulos nativos em rolagem vertical, com carta, contador e surpresas, sem uma página incorporada dentro da tela.

O jogo está em Nossa História → Nosso jogo, com opção de tela cheia. A física usa passos fixos de 60 Hz, colisão por cruzamento do topo das plataformas, salto de cerca de 209 pixels, tolerância curta na borda e memória do comando de pulo antes de aterrissar. As coordenadas da fase são estáveis ao redimensionar a tela.

### Perfil e personalização

O chat começa no tema escuro Meia-noite. Perfil → Temas & conversa (ou a paleta no cabeçalho) permite escolher Entre nós, Crimson Velvet, Obsidian Glow e Maré serena; os balões podem ser Clássico, Suave, Corações, Gatinho ou Fantasma. Cores, balões e intensidade do fundo são salvos em `user_settings` por conta. Fotos de perfil e fundos são comprimidos no navegador e guardados em `profile_media`: somente o titular e seu par podem acessar o avatar; somente o titular pode acessar o fundo. Não são arquivos públicos do repositório.

Aplique `002_personalization.sql` antes de publicar esta versão (o comando `npm run db:migrate` aplica ambas as migrações). A mudança é aditiva e preserva contas, mensagens, fotos e pareamentos. Os testes cobrem isolamento, rejeição de formatos inválidos e persistência.

A tela de chamadas tem foto do contato, fundo desfocado, vídeo imersivo, duração após conexão e controles de microfone, câmera e troca de lente. O transporte continua sendo WebRTC; a nova interface não substitui a necessidade de TURN em redes que exigem relay. Ofertas de chamada geram um alerta para abrir o app; não há integração com CallKit nem atendimento com o app fechado.

Arte `public/assets/ghost-bubble.webp`: criada com image_gen a partir da referência de balão fantasma enviada, com fundo transparente, sem texto nem dados da captura. Prompt: “Isolate and reinterpret only the small white ghost message bubble as a friendly white ghost with oval eyes, curved tail, lavender edge shadow and transparent background; no screenshot, user content, people, logos or text.”

### App instalável e notificações em segundo plano

A versão PWA é instalável no iPhone e no Android. Perfil → Instalar You & Me mostra as instruções e usa o convite de instalação do Chrome quando disponível. No iPhone/iPad, o Web Push requer iOS/iPadOS 16.4+, app adicionado à Tela de Início e permissão solicitada por toque do usuário. No Android, use Chrome atualizado e permita notificações. O modo Foco, configurações do sistema, bloqueio de notificações, ausência de internet e encerramento forçado do navegador podem impedir ou atrasar a entrega.

Após instalar, entre na conta e use Perfil → Ativar notificações → Testar notificação. O botão de teste envia push pelo servidor para a inscrição atual; não é uma notificação local simulada. Para validar a tela bloqueada, bloqueie o aparelho receptor e envie uma mensagem pela conta pareada em outro aparelho. Não confundir inscrição aceita pelo provedor com confirmação de exibição física na tela. O teste automatizado usa um transporte substituto e verifica o envelope criptografado, direcionamento ao par, exclusão de endpoints 410 e revogação no logout.

Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no servidor. A chave pública é distribuída ao cliente; a privada nunca é enviada ao navegador nem versionada. Gere as chaves uma única vez com `web-push.generateVAPIDKeys()` e mantenha o par estável. Aplique `003_web_push.sql` antes do deploy. O script de migração aplica 001, 002 e 003. `/api/health` informa `pushConfigured` sem revelar chaves.

As inscrições ficam em `push_subscriptions`, ligadas à conta e à sessão daquele aparelho; sair da conta remove o vínculo, e sessões vencidas não recebem envios. Limite de dez inscrições por conta. O servidor valida os domínios dos serviços de push e o formato das chaves, envia payload criptografado (Web Push aes128gcm/VAPID), usa timeout e remove endpoints expirados (404/410). Por solicitação do usuário, os alertas mostram nome e prévia (até 180 caracteres); fotos usam legenda e chamadas identificam áudio/vídeo. O payload inclui a URL privada do avatar, sem tornar o arquivo público. O worker confirma a conta atual antes de mostrar conteúdo, busca o avatar com credenciais sem cache e usa um ícone em memória nos sistemas compatíveis. Após logout/troca de conta ou se a verificação falhar, o alerta usa texto genérico. iOS Web Push pode manter o ícone do app em vez da foto, por limitação do sistema. Falhas no transporte não apagam a mensagem salva. O worker não mantém o chat aberto nem faz polling em segundo plano.

Os temas são individuais: `user_settings.user_id` é a chave, o par não recebe preferências de aparência e cada login restaura somente suas escolhas. Testes verificam duas contas usando temas distintos e persistência ao entrar novamente.

Esta entrega é uma PWA, sem APK/IPA e sem publicação nas lojas. Uma versão nativa para App Store/Google Play exige projetos nativos, assinatura, contas de desenvolvedor e push nativo APNs/FCM. Não embalar esta página em um WebView e presumir que o Web Push funcionará nele. A aplicação precisa de conexão para conversar e fazer chamadas; a página offline informa isso sem guardar dados privados em cache.

### Teclado e prévias de mensagens

`public/viewport.js` acompanha resize e scroll de VisualViewport, altura antes do teclado e offset da tela. O chat no celular ocupa a área visível, usa uma única lista flexível com rolagem e mantém o campo de envio no limite inferior. O fechamento do teclado ignora offsets obsoletos; zoom manual e teclado físico não são tratados como teclado virtual. Testes cobrem Safari, resize do Android, fechamento e zoom; uma simulação a 390×420 verificou o campo em y=420 sem espaço vazio nem rolagem horizontal. A validação final em iPhone real continua necessária.

Novas mensagens com o app visível exibem um banner com nome, foto e prévia. No sistema, nome e prévia aparecem conforme as preferências de notificações/privacidade do aparelho. iOS PWA não oferece a mesma interface de chamada de CallKit; o alerta de ligação abre o app para atender.
