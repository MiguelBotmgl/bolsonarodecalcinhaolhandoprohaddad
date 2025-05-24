// disable-back.js
(function () {
  'use strict';

  // Garante que o código só rode no ambiente do navegador e que a API de histórico esteja disponível.
  if (typeof window === 'undefined' || typeof window.history === 'undefined' || typeof window.history.pushState === 'undefined') {
    console.warn("API de Histórico do Navegador não suportada ou não disponível.");
    return;
  }

  // 1. Adiciona uma entrada inicial no histórico.
  // Quando a página carrega, nós "empurramos" um estado para o histórico que representa a própria página atual.
  // Isso é feito para que a primeira tentativa de "voltar" do usuário seja para este estado que controlamos.
  // Usamos um objeto simples como estado, mas poderia ser null.
  // O título e URL são da página atual.
  window.history.pushState({ noBackPlease: true }, document.title, window.location.href);

  // 2. Escuta o evento 'popstate'.
  // Este evento é disparado quando a entrada ativa do histórico de sessão muda.
  // Isso acontece quando o usuário clica no botão "Voltar" ou "Avançar" do navegador,
  // ou quando history.back(), history.forward(), history.go() são chamados em JavaScript.
  window.addEventListener('popstate', function (event) {
    // Quando o evento 'popstate' ocorre (usuário tentou voltar),
    // nós imediatamente empurramos o estado da página atual de volta para o topo do histórico.
    // Isso efetivamente "cancela" a ação de voltar, fazendo com que o usuário permaneça na página atual.
    // É importante usar o estado que definimos ({ noBackPlease: true }) para ter um marcador,
    // embora neste script simples, estamos sempre empurrando o estado atual de volta.
    window.history.pushState({ noBackPlease: true }, document.title, window.location.href);

    // Log para depuração (opcional, remova em produção)
    // console.log("Tentativa de voltar interceptada. Permanecendo na página atual.");

    // IMPORTANTE: Esta abordagem pode ser frustrante para o usuário, pois cria um "loop"
    // se ele tentar voltar repetidamente. O botão voltar parecerá não funcionar.
  });

})();
