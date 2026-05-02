/*
  Firebase placeholder - multiplayer preparado, mas nao ativo.

  Futuro caminho sugerido:
  1. Criar projeto no Firebase.
  2. Ativar Firestore ou Realtime Database.
  3. Substituir o objeto abaixo pelas credenciais reais.
  4. Importar Firebase SDK via CDN no index.html.
  5. Implementar em GameStateAdapter:
     - createGame(): cria documento/sala com FEN inicial.
     - joinGame(gameId): entra em uma sala existente.
     - sendMove(move): grava jogada no banco.
     - onGameUpdate(callback): escuta mudancas e sincroniza o tabuleiro.

  Exemplo comentado:

  window.firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "seu-projeto.firebaseapp.com",
    databaseURL: "https://seu-projeto.firebaseio.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "000000000",
    appId: "1:000000000:web:abcdef"
  };
*/
window.firebaseConfig = null;
