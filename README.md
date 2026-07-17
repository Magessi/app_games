# app_games

## Traffic Lights

Jogo de estratégia para 2 jogadores (ou contra a IA): faz uma linha de 3
peças da mesma cor. Verde joga-se em casas vazias, Amarelo sobre Verde,
Vermelho sobre Amarelo — e o Vermelho fica fixo.

**Jogar já:** abre `traffic-lights/dist/traffic-lights.html` no browser
(ficheiro único, sem dependências).

### Funcionalidades

- 1 vs 1, 1 vs IA (4 níveis: Fácil, Médio, Difícil, Mestre — minimax com
  poda alfa-beta) e Puzzle do dia (posição gerada por semente da data,
  "vence em 2 jogadas")
- Variantes: tabuleiro 3×4 ou 4×4, Misère (quem faz a linha perde),
  Blitz (10 s por jogada)
- Análise da partida local (ponto de viragem, maior erro, gráfico de
  avaliação) — sem APIs externas
- Tap-to-place com realce das jogadas legais + drag & drop, undo,
  som sintetizado, dark mode, PT/EN, conquistas e estatísticas locais

### Desenvolvimento

```bash
cd traffic-lights
npm install        # só esbuild
npm test           # testes do núcleo (node --test)
npm run build      # gera dist/traffic-lights.html (ficheiro único)
npm run dev        # servidor local em http://127.0.0.1:8000
```

Arquitetura: `src/core/` é lógica pura (regras, IA, análise, puzzle — sem
DOM, testável em Node), `src/ui/` é rendering incremental e efeitos,
`src/main.js` liga tudo através de um store observável (`src/store.js`).
Ver `UPGRADE_PLAN.md` para o plano completo.
