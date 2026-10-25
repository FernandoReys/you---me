# You & Me — projeto nativo de chamadas

**Estado: desenvolvimento. Não ativado nos celulares. Não há APK/IPA assinado nem validação em aparelho real.**

Esta pasta preserva o site por WebView, mas transporta áudio/vídeo de chamadas pelo SDK WebRTC nativo. Isso evita depender de JavaScript de uma página suspensa para manter o áudio na tela bloqueada. CallKeep integra CallKit no iPhone e ConnectionService no Android; PushKit reporta a chamada ao sistema antes da inicialização do React Native. Firebase Messaging trata o aviso de chamada no Android.

## Bloqueios atuais

- Firebase ainda não instalado/conectado nesta sessão; não há projeto mobile configurado nem `google-services.json`.
- Sem conta/assinatura Apple Developer, arquivo de configuração APNs, entitlement válido ou perfil de provisionamento.
- Sem Android SDK/adb e sem Xcode neste ambiente. TypeScript e testes de contratos podem rodar, mas não substituem a compilação nativa.
- TURN real ainda não configurado no servidor. Chamadas entre redes móveis/restritas precisam de relay para confiabilidade.
- Versão React Native 0.82.1 escolhida para esta base; compatibilidade das dependências nativas e versões atuais dos SDKs ainda requer compilação/teste.

## O que foi preparado

- Projetos Android/iOS, microfone/câmera, modos de áudio/VoIP, processamento de push e tela de chamada nativa.
- PushKit no AppDelegate reporta CallKit imediatamente; Android recebe dados FCM de alta prioridade.
- Sessão HTTP em Keychain/Keystore, preenchida a partir dos cookies do site sem expor a senha ao JavaScript da página.
- Motor de mídia WebRTC nativo, resposta/recusa, silenciar, vídeo local/remoto e sinalização compatível com o servidor existente.
- Endpoints autenticados `/api/native/config`, `/api/native/devices`, `/api/native/calls/:uuid`. O servidor verifica destinatário, par, expiração e fim da chamada.
- Provedores FCM HTTP v1 e APNs HTTP/2; somente metadados de chamada vão no push, nunca o SDP nem credenciais da conta.
- Flags desligadas em `src/config.ts` e `ios/YouMeMobile/Info.plist`; elas só devem ser ligadas depois de concluir os passos abaixo.

## Configurar e validar

1. Instalar/conectar Firebase e criar um app Android com identificador provisório `com.fernandoreys.youme`. Baixar a configuração para `android/app/google-services.json`. Nunca versionar credenciais de serviço.
2. Na Apple Developer, confirmar o Bundle ID disponível, habilitar Push Notifications e VoIP, configurar assinatura, chave APNs e perfis. Ajustar o identificador nos dois projetos caso necessário.
3. No servidor, definir `FCM_SERVICE_ACCOUNT_JSON`; no iPhone, `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID` e `APNS_ENVIRONMENT=sandbox|production`. Esses são segredos de servidor, não entram no app. Configurar TURN.
4. Testar/aplicar `../migrations/004_native_calls.sql` em uma branch do banco antes de produção. O arquivo de configuração da plataforma e a migração não foram aplicados automaticamente a produção.
5. `npm ci`, `npm run typecheck`, `npm run test:contracts`. No Mac, `bundle install` e `bundle exec pod install` dentro de `ios` antes de compilar. Para Firebase estático, o Podfile já usa frameworks estáticos.
6. Ativar ambas as flags nativas somente no build de teste configurado; instalar o app real. Android solicita permissões/conta de chamadas; isso não é possível ativar remotamente em nome do usuário.
7. Validar chamadas em ambos os sentidos: tela apagada/bloqueada, app em segundo plano, inicialização a frio, aceitar/recusar, microfone, Bluetooth/fone, câmera, rede Wi-Fi e 4G/5G, timeout, logout e duas contas. Confirmar eventos CallKit anteriores ao JavaScript. Não confundir um push aceito pelo provedor com uma chamada funcional.
8. Gerar builds assinados para distribuição. Android pode ser distribuído por APK; iPhone exige assinatura/distribuição autorizada (por exemplo TestFlight). O release Android não usa a chave de debug.

## Comandos

```sh
npm ci
npm run typecheck
npm run test:contracts
npm run android
npm run ios
```

O helper gera a chave **somente de debug** local ao executar Android, se necessário. A chave de release deve ser criada e guardada pelo proprietário.

## Limitações que ainda precisam de teste nativo

A rota de áudio CallKit/WebRTC, sessões a frio, permissões de foreground service/conta telefônica no Android e comportamento do WebView nas versões dos aparelhos não foram compilados nem testados aqui. Não distribuir como versão pronta. Revise também o pacote de cookies (dependência marcada como obsoleta pelo fornecedor) antes de lançamento; o teste nativo deve validar a transferência segura da sessão ao Keychain/Keystore.

Referências: https://github.com/react-native-webrtc/react-native-callkeep · https://github.com/react-native-webrtc/react-native-voip-push-notification · https://github.com/react-native-webrtc/react-native-webrtc · https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit
