# Review do Codebase: AListaProject

Após uma análise detalhada do código fonte, identifiquei vários pontos de atenção divididos em: **Bugs Críticos**, **Inconsistências Visuais/UX** e **Sugestões de Melhoria**.

## 🚨 1. Bugs Críticos e Lógica

### A. Séries "Finalizadas" Desaparecem
**Arquivo:** `src/screens/tabs/SeriesScreen.tsx`
**Problema:** A lógica de renderização filtra as séries em apenas dois estados: `active` e `waiting`.
```typescript
const active = enrichedItems.filter(i => i.computedStatus === 'active');
const waiting = enrichedItems.filter(i => i.computedStatus === 'waiting');
```
Se uma série está em dia (`isUpToDate`) E terminou (`isEnded`), o status calculado é `finished` (linha 133).
**Impacto:** Essas séries não entram em `active` nem em `waiting`. Elas **desaparecem completamente** da tela. O usuário perde o acesso à série para avaliá-la ou movê-la para o histórico, a menos que procure manualmente (o que não parece possível).
**Correção Sugerida:** Criar uma seção "Finalizadas" na tela ou incluí-las na seção "Aguardando" com um indicador visual de que acabou.

### B. Cálculo de Temporada/Episódio (Loop de Temporadas)
**Arquivo:** `src/screens/tabs/SeriesScreen.tsx` (função `getSeasonAndEpisode`)
**Problema:** O loop acumula `episode_count`. Se `tmdb` retornar dados inconsistentes ou se `last_episode_seen` incluir especiais (Season 0) que você tenta filtrar (linha 66), o cálculo visual de "T2 E1" pode ficar dessincronizado com o real.
**Risco:** Se o usuário assistir um especial, o contador absoluto sobe, mas o loop de exibição pula a temporada 0, fazendo parecer que ele assistiu um episódio da Temporada 1 a mais.

## 🎨 2. Inconsistências Visuais e de UX

### A. Tema (Claro vs Escuro)
**Problema:**
*   `SeriesScreen.tsx` força um fundo escuro (`#1a1a1a`) e textos brancos.
*   `WatchlistScreen.tsx` e `HistoryScreen.tsx` usam `useTheme()` do React Navigation.
**Impacto:** Se o celular do usuário estiver no **Modo Claro**, a Watchlist será branca com texto preto, mas ao mudar para a aba Séries, o app ficará preto. Essa transição é brusca e amadora.
**Sugestão:** Padronizar. Como é um app de filmes/séries, recomenda-se "Dark Mode" forçado ou suporte completo a temas em todas as telas.

### B. Headers Duplicados ou Inconsistentes
**Problema:**
*   Em `SeriesScreen`, você esconde o header padrão (`headerShown: false`) e cria um `View` customizado.
*   Em `HistoryScreen`, o header padrão da navegação é exibido (provavelmente), mas você *também* renderiza uma `View` com título "Histórico" (linha 101).
**Impacto:** Possibilidade de **duplo cabeçalho** no Histórico (um da navegação padrão e um do seu componente), ocupando espaço desnecessário.

### C. Loading Spinner Excessivo
**Problema:** O `fetchSeries` é chamado no `useFocusEffect` e o state `loading` inicia como `true`.
**Impacto:** Toda vez que o usuário troca de aba e volta para "Séries", ele vê uma tela preta com um spinner por alguns instantes, mesmo que já tenha dados carregados.
**Sugestão:** Implementar "stale-while-revalidate" (mostrar dados antigos enquanto busca novos) ou apenas não setar `loading(true)` se já houver dados.

## 🛠️ 3. Código e Estrutura

### A. Consultas ao Supabase
**Arquivo:** `SeriesScreen.tsx`
O código busca *todas* as séries da biblioteca (`in('status', ['watching', ...])`) toda vez. Conforme a biblioteca do usuário cresce (ex: 100+ séries), isso ficará lento.
**Sugestão:** A longo prazo, considerar paginação ou trazer apenas o necessário.

### B. Tratamento de Erro Genérico
Muitos `Alert.alert('Erro', 'Falha ao ...')`.
Considerar mostrar mensagens mais amigáveis (Toasts) que não interrompam o fluxo do usuário com um popup modal.

---

## 🚀 Plano de Ação Recomendado

1.  **Prioritário:** Corrigir o bug das séries "Ended" que somem (Exibir botão "Avaliar/Finalizar").
2.  **Visual:** Padronizar o tema (Recomendo forçar Dark Mode no `AppTabs` ou remover hardcoded colors).
3.  **UX:** Remover o header duplicado do Histórico e melhorar o loading da Home.
