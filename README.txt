=====================================================================
  PARA ELA — site de aniversário
  HTML + CSS + JavaScript puro. Sem servidor, sem instalação.
=====================================================================

COMO ABRIR
----------
Dê dois cliques em  index.html  (Chrome, Edge, Firefox, Safari).
Para o computador ou o celular dela ver, você pode:
  - enviar a pasta inteira compactada, ou
  - publicar de graça em Netlify Drop, GitHub Pages, Vercel etc.
    (arraste a pasta "aniversario" inteira; o site abre pelo index.html).

IMPORTANTE: mantenha as pastas css/, js/ e assets/ junto com os .html.
As fontes bonitas (Cormorant Garamond, Cinzel e Dancing Script) são
carregadas do Google Fonts; é preciso internet na primeira abertura.
Sem internet o site funciona normalmente com fontes de reserva.


O QUE VOCÊ PRECISA PERSONALIZAR (5 minutos)
-------------------------------------------
1) js/main.js  -> bloco "PERSONALIZAÇÃO", logo no topo:

   girlfriendName     Nome dela (opcional). Enquanto for "NOME DELA",
                      o site usa palavras carinhosas no lugar.
   relationshipStart  Data em que vocês começaram, no formato
                      "ANO-MÊS-DIA", ex.: "2024-05-10"
                      (ou com hora: "2024-05-10 20:30").
                      >>> ENQUANTO ESTIVER "202X-XX-XX", O CONTADOR DA
                      >>> PÁGINA INICIAL MOSTRA UM AVISO. TROQUE ANTES
                      >>> DE ENVIAR!
   birthdayMessage    Frase principal ("Feliz aniversário, meu amor.").
                      A vírgula quebra a linha; a última palavra brilha.
   secretMessage      Frase da tela secreta.
   backgroundMusic    Caminho da música (veja abaixo).
   loveMessages       Frases que aparecem ao tocar no coração flutuante.

2) js/cartas.js  -> lista  const letters = [ { title, text }, ... ]
   Edite os títulos e textos. Para separar parágrafos, deixe uma linha
   em branco (\n\n). Pode adicionar ou remover cartas.
   A assinatura das cartas está em  letterSignature.

3) index.html  -> textos das seções "Por que você?" e "Pequenas
   memórias". Procure os comentários e troque pelas memórias reais de
   vocês (quanto mais específico, melhor).

4) js/universo.js  -> no topo: universeFinalMessage e cosmosLines
   (as três frases do "pequeno universo").

5) js/jogo.js  -> no topo: heartsToCollect (quantos corações no jogo).
   Os textos da tela final estão em jogo.html.

6) Foto: assets/ela.jpg. Para trocar, substitua o arquivo mantendo o
   mesmo nome. Se o rosto ficar cortado na moldura, ajuste a linha
   "object-position" em .portrait-photo img no css/style.css.


MÚSICA (opcional)
-----------------
Coloque um arquivo chamado  musica.mp3  dentro da pasta assets/.
A música NUNCA toca sozinha: só depois que ela clicar no botão ♫ do
topo. Se o arquivo não existir, o botão avisa e o site segue normal.
Use uma música que você tenha direito de usar/compartilhar.


SEGREDOS E DETALHES
-------------------
- Clique 5 vezes no coração ♡ ao lado do logo "Para Ela": aparece a
  tela secreta. (Esc fecha.)
- O botão flutuante de coração (canto da tela) solta corações e uma frase.
- A abertura da página inicial toca uma vez por visita. Para rever:
  abra index.html?intro
- Reino Encantado: WASD ou setas no computador; joystick na tela no
  celular. Colete todos os corações para ver a mensagem final.
- Nosso Universo: toque/clique 4 vezes no céu para as duas luzes se
  encontrarem. Mais abaixo, "Um pequeno universo para você".
- Quem usa "reduzir movimento" no sistema recebe uma versão com menos
  animação, sem perder o conteúdo.


ESTRUTURA DOS ARQUIVOS
----------------------
aniversario/
  index.html      Página inicial
  cartas.html     Cartas em envelopes
  universo.html   Nosso Universo (céu + pequeno universo)
  jogo.html       Reino Encantado
  css/style.css   Todo o visual
  js/main.js      Recursos comuns + PERSONALIZAÇÃO
  js/cartas.js    Cartas
  js/universo.js  Céu estrelado e experiência do coração de estrelas
  js/jogo.js      Mini-jogo
  assets/ela.jpg  Foto dela
  assets/musica.mp3  (opcional, você adiciona)

Feito com carinho. Boa festa! ♡
