# Traffic Lights — Plano de Upgrade Profissional

Diagnóstico e plano de ação em três fases para evoluir o protótipo atual
(`Traffic Lights .html`) para um jogo web profissional. Nenhuma fase parte o
jogo: cada etapa termina com o jogo funcional.

---

## Diagnóstico

### O que está bem
- Regras corretas e legíveis (`isValidMove`, `checkWinCondition` cobre linhas,
  colunas e as duas diagonais).
- Suporte touch com ghost element; modo 1 vs AI que ganha/bloqueia jogadas
  imediatas; ecrã de vitória com confetti e estatísticas.

### Problema estrutural
Protótipo monolítico: estado, regras, rendering, input e IA no mesmo scope
global. `renderBoard()`/`renderSourceStacks()` destroem e reconstroem todo o
DOM a cada jogada (`innerHTML = ''`), o que:
1. Impede animações de peças (o elemento a animar acabou de ser destruído);
2. Recria dezenas de event listeners por jogada;
3. Torna as regras impossíveis de testar sem browser.

### Bugs e dívidas encontradas

| Onde | Problema |
|---|---|
| Fim do ficheiro | ` ``` ` e ` ```eof ` depois de `</html>` — lixo de copy-paste Markdown |
| `handleAnalyzeGame` | `apiKey = ""` — chamada Gemini falha sempre; chave no cliente seria pública (precisa de proxy) |
| `animateConfetti` | `splice` dentro de `forEach` — salta partículas ao remover durante a iteração |
| `getAllPossibleMoves` | `.sort(() => Math.random() - 0.5)` é shuffle enviesado (usar Fisher–Yates) |
| `isWinningMove` | clone `JSON.parse(JSON.stringify(board))` por candidata — resolve-se com lógica pura |
| `<main id="game-board">` | `{/* ... */}` é comentário JSX, não HTML — fica texto literal no DOM |
| Nome do ficheiro | `Traffic Lights .html` tem espaço antes da extensão |
| Fonte | CSS pede `'Inter'` mas a fonte nunca é carregada |
| Tailwind | via CDN — não recomendado para produção pelo próprio Tailwind |

### Nota de game design
Traffic Lights 3×4 é um **jogo resolvido**: com jogo perfeito, o 1.º jogador
ganha. A longevidade tem de vir de IA por níveis, variantes e modos puzzle —
não do 1v1 repetido.

---

## Fase 1 — Refatoração

**Regra de ouro: a lógica do jogo não conhece o DOM.**

### 1.1 Estrutura (com Vite)

```
traffic-lights/
├── index.html
├── src/
│   ├── core/
│   │   ├── game.js        # regras puras: estado, jogadas, vitória
│   │   └── ai.js          # IA (só usa core/game.js)
│   ├── ui/
│   │   ├── render.js      # DOM: tabuleiro/stacks
│   │   ├── input.js       # drag & drop, touch, tap-to-place
│   │   └── effects.js     # confetti, animações, som
│   ├── store.js           # estado + subscribe (observer)
│   └── main.js            # controlador
└── styles/main.css
```

### 1.2 Lógica pura + store observável

```js
// core/game.js — zero referências ao DOM
export const GREEN = 1, YELLOW = 2, RED = 3;

export function createGame(rows = 3, cols = 4) {
  return {
    board: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => [])),
    pieces: { [GREEN]: 8, [YELLOW]: 8, [RED]: 8 },
    currentPlayer: 1,
    history: [],
    winner: null,
    winningLine: null,
  };
}

export function isValidMove(state, { row, col, color }) {
  if (state.winner || state.pieces[color] === 0) return false;
  const top = state.board[row][col].at(-1) ?? null;
  return (color === GREEN  && top === null)
      || (color === YELLOW && top === GREEN)
      || (color === RED    && top === YELLOW);
}

export function applyMove(state, move) {
  if (!isValidMove(state, move)) return state;
  const next = structuredClone(state);
  next.board[move.row][move.col].push(move.color);
  next.pieces[move.color]--;
  next.history.push({ ...move, player: state.currentPlayer });
  const line = findWinningLine(next.board);
  if (line) { next.winner = state.currentPlayer; next.winningLine = line; }
  else next.currentPlayer = 3 - state.currentPlayer;
  return next;
}
```

```js
// store.js
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  return {
    get: () => state,
    set(next) { const prev = state; state = next; listeners.forEach(l => l(state, prev)); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
```

Ganhos imediatos: testes unitários, undo/redo (guardar estados), IA que simula
sem clonar o mundo.

### 1.3 Event delegation

Um listener no tabuleiro, anexado uma vez:

```js
boardEl.addEventListener('drop', (e) => {
  const cell = e.target.closest('.game-cell');
  if (!cell) return;
  dispatch({ row: +cell.dataset.row, col: +cell.dataset.col, color: draggedColor });
});
```

### 1.4 Rendering incremental
No `subscribe`, comparar `state` com `prev` e só atualizar a célula que mudou.
É isto que desbloqueia as animações da Fase 2 (a peça nova é um elemento
adicionado, com classe `.just-placed`).

### 1.5 Testes (Vitest)

```js
test('vermelho só pode ir sobre amarelo', () => {
  let s = createGame();
  s = applyMove(s, { row: 0, col: 0, color: GREEN });
  expect(isValidMove(s, { row: 0, col: 0, color: RED })).toBe(false);
  s = applyMove(s, { row: 0, col: 0, color: YELLOW });
  expect(isValidMove(s, { row: 0, col: 0, color: RED })).toBe(true);
});
```

**Também na Fase 1:** corrigir os bugs da tabela, renomear o ficheiro,
substituir Tailwind CDN por build ou CSS puro com custom properties.

---

## Fase 2 — UX/UI e Game Feel

**Princípio:** cada ação do jogador merece reação em < 100 ms. Momentos-chave:
pegar na peça, largar, jogada inválida, vitória.

### 2.1 Tap-to-place (maior impacto UX)
Tocar na pilha seleciona → células legais acendem → tocar na célula joga.
Resolve mobile, acessibilidade e ensina as regras visualmente. O mesmo
highlight aparece no `dragstart` em desktop.

```js
function selectColor(color) {
  selectedColor = color;
  for (const cell of boardEl.querySelectorAll('.game-cell')) {
    const move = { row: +cell.dataset.row, col: +cell.dataset.col, color };
    cell.classList.toggle('legal-target', isValidMove(store.get(), move));
  }
}
```

### 2.2 Animações de peça

```css
.piece-on-board.just-placed {
  animation: drop-in .28s cubic-bezier(.34, 1.56, .64, 1); /* overshoot = bounce */
}
@keyframes drop-in {
  from { transform: translate(-50%, -80%) scale(1.15); opacity: 0; }
  to   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
.shake { animation: shake .3s; } /* jogada inválida */
@keyframes shake {
  25% { transform: translateX(-5px); } 75% { transform: translateX(5px); }
}
@media (prefers-reduced-motion: reduce) {
  .just-placed, .shake { animation: none; }
}
```

### 2.3 Sequência de vitória em camadas
1. As 3 células vencedoras pulsam em stagger (`animation-delay: i * 100ms`);
2. Traço SVG desenha-se sobre a linha (`stroke-dashoffset` animado);
3. Micro screen-shake no tabuleiro (~200 ms, subtil);
4. `navigator.vibrate?.(80)` no mobile;
5. Só então o modal com confetti.

### 2.4 Som
Web Audio API com blips sintetizados (sem assets): pitch sobe
verde→amarelo→vermelho (reforça a hierarquia), buzz grave em jogada inválida,
arpejo na vitória. Toggle de mute em `localStorage`.

### 2.5 Interface
- Indicador de vez forte (cartões dos jogadores, ativo em destaque) e marcador
  da última jogada (essencial no 1 vs AI);
- Dark mode via custom properties + `prefers-color-scheme`;
- Botão Undo (grátis com o histórico de estados; no vs AI desfaz o par);
- i18n PT/EN com objeto de strings.

---

## Fase 3 — Mecânicas e Longevidade

**Filosofia:** num jogo abstrato, a longevidade vem de escada de desafio +
variantes + objetivos diários — não de power-ups aleatórios.

### 3.1 IA por níveis (curva de dificuldade principal)

```js
// core/ai.js — minimax com poda alfa-beta (tabuleiro pequeno = viável)
function minimax(state, depth, alpha, beta, maximizing) {
  if (state.winner) return maximizing ? -1000 - depth : 1000 + depth;
  if (depth === 0) return evaluate(state); // pares em linha, vermelhos fixos, paridade
  for (const move of getLegalMoves(state)) {
    const score = minimax(applyMove(state, move), depth - 1, alpha, beta, !maximizing);
    if (maximizing) { alpha = Math.max(alpha, score); }
    else            { beta  = Math.min(beta, score); }
    if (beta <= alpha) break;
  }
  return maximizing ? alpha : beta;
}
```

Escada: **Fácil** (aleatório) → **Médio** (ganha/bloqueia — a IA atual) →
**Difícil** (minimax prof. 3–4) → **Perfeito** (prof. alta; a IA joga em 2.º,
vencê-la é o troféu final). Cada nível ensina um conceito: colocar, bloquear,
forks (duplas ameaças), paridade dos vermelhos. Curva justa = perder aponta
sempre para a competência em falta.

### 3.2 Puzzle / Desafio Diário (retenção)
"Vitória em 2 jogadas" a partir de posições geradas por self-play e validadas
com minimax. Um por dia + streak (padrão Wordle).

### 3.3 Variantes desbloqueáveis
- **Misère:** quem faz linha de 3 perde (zero código novo nas regras);
- **4×4 / 3×5** com mais peças (Fase 1 já parametrizou rows/cols);
- **Blitz:** 10 s por jogada;
- **Quatro em linha** no tabuleiro maior.

### 3.4 Progressão e cosméticos
Perfil local (`localStorage`): vitórias por nível, streaks, conquistas
("Vence sem vermelhos", "Vence em ≤ 6 jogadas", "Bate a IA Perfeita").
Desbloqueios cosméticos: temas de peças (planetas Earth/Moon/Sun — já
insinuado no código —, semáforos, gemas). Recompensas cosméticas mantêm o
jogo justo.

### 3.5 Análise da partida
Substituir a chamada Gemini por **análise local com o minimax**: avaliar a
posição após cada jogada do histórico; a inversão de sinal é o turning point,
a maior queda do vencido é "o erro do jogo". Sem API, sem custos, e permite
um mini-gráfico da avaliação. (Alternativa: proxy serverless para a Gemini —
a chave nunca pode viver no cliente.)

---

## Ordem de execução

| Etapa | Entrega |
|---|---|
| 1a | Corrigir bugs + renomear ficheiro + Vite |
| 1b | Extrair `core/game.js` puro + store + testes |
| 1c | Render incremental + event delegation |
| 2a | Tap-to-place + highlight de células legais |
| 2b | Animações, sequência de vitória, som |
| 3a | IA minimax + níveis |
| 3b | Análise local da partida (substitui Gemini) |
| 3c | Puzzle diário, variantes, conquistas |
