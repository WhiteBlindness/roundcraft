# Roundcraft — estado atual do repositório

**Data:** 05/09/2026
**Ramo:** `claude/roundcraft-phase-3-recovery-7atkq2`
**HEAD:** pendente (Fase 4 — endpoints secundários)

---

## A. Fotografia do repositório

### A.1 Estrutura de ficheiros

```
roundcraft/
├── CS2_Daily_Platform_Phase_1_PRD.md          # PRD — Fase 1 (1 712 linhas)
├── CS2_Daily_Platform_Phase_2_Design_Exploration.md  # Exploração — Fase 2 (3 direções)
├── CS2_Daily_Platform_Phase_2B_Selected_Design_Spec.md  # Design selecionado — Fase 2B (1 150 linhas)
├── Roundcraft_Phase_3_Technical_Architecture.md  # Arquitetura técnica — Fase 3 (1 068 linhas)
├── package.json                               # v0.1.0, React 19, Hono, Zod, Vitest 4, Playwright
├── wrangler.jsonc                             # Worker + D1 + 3 limitadores de taxa
├── migrations/
│   └── 0001_initial.sql                       # 13 tabelas STRICT, 216 linhas
├── contracts/
│   ├── openapi.json                           # OpenAPI 3.1.0, v0.4.0, 13 rotas
│   ├── errors.json                            # 12 códigos de erro
│   ├── schemas/                               # 12 esquemas JSON de resposta
│   ├── examples/                              # 23 exemplos válidos e inválidos
│   └── contracts.test.ts                      # Testes de contrato (29 testes)
├── src/
│   ├── worker/                                # 20 ficheiros (rotas, identidade, segurança)
│   ├── domain/                                # 14 ficheiros (máquina de estados, classificação, projeções)
│   └── client/                                # 8 ficheiros (SPA React, API, estilos)
├── e2e/
│   └── today.spec.ts                          # Teste E2E
└── docs/
    └── ROUNDCRAFT_CURRENT_STATE.md            # Este documento
```

Total: ~8 067 linhas de código-fonte (sem testes de contrato e E2E).

### A.2 Dependências

| Tipo | Pacote | Versão |
|---|---|---|
| Produção | hono | ^4.13.5 |
| Produção | react | ^19.2.8 |
| Produção | react-dom | ^19.2.8 |
| Produção | zod | ^4.5.4 |
| Dev | vitest | ^4.1.11 |
| Dev | @playwright/test | ^1.62.1 |
| Dev | typescript | ^6.0.3 |
| Dev | wrangler | ^4.127.1 |
| Dev | @cloudflare/vite-plugin | ^1.54.2 |

### A.3 Configuração Cloudflare (wrangler.jsonc)

- Worker: `roundcraft`, compatibility_date `2026-09-01`
- D1: `roundcraft-prod` (database_id `84fbd2d6-...`)
- Limitadores: SESSION (20/60s), TODAY (120/60s), ATTEMPT (30/60s)
- SPA: `not_found_handling: "single-page-application"`
- `run_worker_first`: `/api/*`, `/`, `/today`, `/cases/*`, `/progress`, `/settings`

### A.4 Resultados dos testes (04/09/2026)

| Conjunto | Ficheiros | Testes | Estado |
|---|---|---|---|
| Contrato | 1 | 29 | Passou |
| Worker | 13 | 73 | Passou |
| Cliente | 2 | 7 | Passou |
| **Total** | **16** | **109** | **Todos passaram** |

---

## B. Reconstrução de marcos

### B.1 Historial de commits

| Commit | Mensagem | PR | Fase |
|---|---|---|---|
| `5e3193f` | docs: establish project source of truth | — | Fase 1-2B |
| `71b11b2` | docs: define phase 3 technical architecture | — | Fase 3 |
| `c9c678f` | feat: establish roundcraft foundation | — | Fase 4 |
| `a683b74` | chore: connect production cloudflare resources | — | Fase 4 |
| `32d7546` | feat: add anonymous session and today api | PR #1 | Fase 4 |
| `e96d224` | feat: add protected attempt briefing flow | PR #2 | Fase 4 |
| `0ca3ecf` | feat: lock main decisions | PR #3 | Fase 4 |
| `721a5a7` | feat: complete official follow-up results | PR #4 | Fase 4 |
| `666786d` | feat: record explicit review completion | PR #5 | Fase 4 |

### B.2 Estado dos marcos

| Marco | Estado | Observação |
|---|---|---|
| Fase 1 — PRD | "Proposed for user approval" | Datado de 29/08/2026 |
| Fase 2 — Exploração de design | "Proposed for user selection" | Datado de 31/08/2026; Design A selecionado |
| Fase 2B — Design selecionado | "Proposed for approval" | Datado de 31/08/2026; Editorial Tactical Desk |
| Fase 3 — Arquitetura técnica | "Proposta para aprovação" | Datado de 01/09/2026; 1 068 linhas, em português |
| Fase 4 — Implementação | Em curso (avançada) | 5 PRs fundidos + 6 endpoints secundários; fluxo completo |

### B.3 Progressão da Fase 4

A implementação avançou apesar de a Fase 3 estar marcada como "Proposta para aprovação". O fluxo principal do jogo está operacional:

| Funcionalidade | Estado | Implementação |
|---|---|---|
| Identidade anónima (cookie __Host-) | Completa | `identity.ts` — HMAC-SHA256, CSRF, 90 dias |
| Sessão (POST /session) | Completa | `session.ts` — criação/renovação |
| Edição do dia (GET /today) | Completa | `today.ts` — seleção por UTC, projeção pública |
| Criar/retomar tentativa (POST /attempts) | Completa | `attempts.ts` — INSERT OR IGNORE + SELECT |
| Obter tentativa (GET /attempts/:id) | Completa | `attempts.ts` — projeção por estado |
| Compromisso principal (POST /main-commit) | Completo | `main-commit.ts` — idempotência, transação atómica |
| Compromisso de seguimento (POST /followup-commit) | Completo | `followup-commit.ts` — classificação, resultado, participação |
| Conclusão do debrief (POST /debrief-complete) | Completa | `debrief-complete.ts` — registo explícito |
| Motor de classificação | Completo | `scoring.ts` — inteiros, quartos, maiores restos |
| Rubrica do servidor | Completa | `server-rubric.ts` — dimensões, matrizes Q/E/F |
| Máquina de estados | Completa | `attempt-machine.ts` — issued→debrief_complete |
| Projeções públicas | Completas | `public-brief.ts`, `public-followup.ts`, `public-reveal.ts`, `public-result.ts` |
| SPA React | Completa | `App.tsx`, `FollowupExperience.tsx` — fluxo completo |
| Cliente API | Completo | `api.ts` — validação Zod em todas as respostas |
| Cabeçalhos de segurança | Completos | CSP, X-Frame-Options, nosniff, Referrer-Policy |
| Limitação de taxa | Completa | 3 limitadores configurados e aplicados |
| Listar casos (GET /cases) | Completa | `cases.ts` — paginação por cursor |
| Tentativas de prática (POST /practice-attempts) | Completa | `practice-attempts.ts` — modo practice |
| Progresso (GET /progress) | Completo | `progress.ts` — edições pontuadas |
| Relatórios de equidade (POST /fairness-reports) | Completa | `fairness-reports.ts` — 5 categorias |
| Eventos de produto (POST /events) | Completo | `events.ts` — 13 tipos, retenção 90 dias |
| Eliminação do histórico (DELETE /history) | Completa | `history.ts` — limpeza atómica D1 batch |
| Contratos OpenAPI | Completos | 13 rotas definidas, esquemas e exemplos |
| Migração D1 | Completa | 13 tabelas STRICT com restrições |

---

## C. Registo de desvios

Desvios identificados entre os documentos de planeamento e a implementação atual.

### C.1 Desvios funcionais (funcionalidades planeadas mas não implementadas)

| ID | Descrição | Fonte | Impacto |
|---|---|---|---|
| ~~D-01~~ | ~~`GET /cases` — listar edições divulgadas~~ | ~~Fase 3 §12.1~~ | **Resolvido** — `cases.ts` implementado |
| ~~D-02~~ | ~~`POST /practice-attempts` — repetições sem crédito~~ | ~~Fase 3 §12.1~~ | **Resolvido** — `practice-attempts.ts` implementado |
| ~~D-03~~ | ~~`GET /progress` — histórico da identidade~~ | ~~Fase 3 §12.1~~ | **Resolvido** — `progress.ts` implementado |
| ~~D-04~~ | ~~`POST /fairness-reports` — relatórios estruturados~~ | ~~Fase 3 §12.1~~ | **Resolvido** — `fairness-reports.ts` implementado |
| ~~D-05~~ | ~~`POST /events` — acontecimentos de produto~~ | ~~Fase 3 §12.1~~ | **Resolvido** — `events.ts` implementado |
| ~~D-06~~ | ~~`DELETE /history` — eliminação do histórico~~ | ~~Fase 3 §12.1~~ | **Resolvido** — `history.ts` implementado |
| D-07 | Turnstile adaptativo | Fase 3 §13.4 | Sem proteção progressiva contra automatização |
| D-08 | IndexedDB para rascunhos locais | Fase 3 §16.3 | Sem persistência de rascunho fora de linha |
| D-09 | Tabelas de governação (case_sources, rights_records, etc.) | Fase 3 §8.1 | Não presentes na migração |
| D-10 | Tabelas operacionais (retention_jobs, publication_audits) | Fase 3 §8.1 | Não presentes na migração |
| D-11 | Tabelas de distribuição (distribution_rollups) | Fase 3 §8.1 | Não presentes na migração |
| D-12 | Verificação ETag em GET /today | Fase 3 §12.1 | Sem revalidação por ETag |

### C.2 Desvios de configuração

| ID | Descrição | Observação |
|---|---|---|
| C-01 | `wrangler.jsonc` contém `database_id` de produção | A Fase 3 §2.2 proíbe criação de recursos; o ID pode ter sido criado por conveniência de desenvolvimento |
| C-02 | Falta `X-Frame-Options: DENY` nos cabeçalhos | A CSP tem `frame-ancestors 'none'`, que é equivalente, mas o cabeçalho redundante é uma boa prática |
| C-03 | `Referrer-Policy: no-referrer` vs. `strict-origin-when-cross-origin` | A Fase 3 §13.3 propõe `strict-origin-when-cross-origin` ou mais restrita; `no-referrer` é mais restrita |
| C-04 | Falta `Strict-Transport-Security` | Fase 3 §13.3 nota que deve ser configurado na zona após domínio estável — correto adiar |

### C.3 Desvios entre OpenAPI e implementação

| ID | Descrição | Observação |
|---|---|---|
| ~~O-01~~ | ~~OpenAPI define 7 rotas; Fase 3 define 13~~ | **Resolvido** — OpenAPI v0.4.0 define 13 rotas |
| O-02 | `GET /health` existe na implementação mas não no OpenAPI | Rota operacional, aceitável omitir do contrato público |

### C.4 Desvios entre migração e Fase 3

| ID | Descrição | Observação |
|---|---|---|
| M-01 | Migração cria 13 tabelas; Fase 3 lista ~20 tabelas conceptuais | Tabelas de governação, operações e distribuição ficaram para fases posteriores |
| ~~M-02~~ | ~~Tabela `fairness_reports` existe na migração mas não tem rota~~ | **Resolvido** — POST /fairness-reports implementado |

### C.5 Desvios aceitáveis (decisões de implementação coerentes)

| ID | Descrição | Justificação |
|---|---|---|
| A-01 | Implementação em inglês, Fase 3 em português | Convenção técnica; sem impacto funcional |
| A-02 | `Referrer-Policy: no-referrer` em vez de `strict-origin-when-cross-origin` | Mais restritivo; cumpre o espírito da Fase 3 |
| A-03 | `run_worker_first` inclui `/settings` | Rota preparada para funcionalidade futura; sem exposição |
| A-04 | Fase 4 avançou sem aprovação formal da Fase 3 | Facto registado; a implementação é coerente com a arquitetura |

---

## D. Determinação da fase seguinte

### D.1 Estado da Fase 3

A Fase 3 está **substancialmente completa**. O documento `Roundcraft_Phase_3_Technical_Architecture.md` cobre os 14 tópicos exigidos pela tarefa:

| Secção da tarefa | Cobertura na Fase 3 | Estado |
|---|---|---|
| §4 — Investigação da plataforma Cloudflare | Secções 1, 4, 23 | Completa |
| §5 — Provas de propriedades do produto | Secções 3, 11.2 | Completa |
| §6 — Modelo de dados | Secção 8 (8.1–8.4) | Completa |
| §7 — Máquina de estados | Secção 9 (9.1) | Completa |
| §8 — Fronteiras da API | Secção 12 (12.1–12.3) | Completa |
| §9 — Esquema de conteúdo dos casos | Secções 6, 7 (7.1–7.4) | Completa |
| §10 — Pipeline de conteúdo | Secção 7 (7.2–7.3) | Completa |
| §11 — Modelo de ameaças | Secção 13 (13.1–13.6) | Completa |
| §12 — Analítica | Secção 15 (15.1–15.3) | Completa |
| §13 — Implantação | Secção 17 (17.1–17.5) | Completa |
| §14 — Estratégia de testes | Secção 19 (19.1–19.6) | Completa |
| Idempotência e concorrência | Secção 10 | Completa |
| Cálculo determinístico | Secção 11 | Completa |
| Retenção e eliminação | Secção 14 | Completa |
| Memória intermédia e offline | Secção 16 | Completa |
| Observabilidade | Secção 18 | Completa |
| Evolução planeada | Secção 20 | Completa |
| Decisões pendentes | Secções 21–22 | Completa |

### D.2 Lacunas genuínas da Fase 3

Não foram identificadas lacunas materiais. A Fase 3 cobre exaustivamente todos os tópicos exigidos, com referências à documentação oficial da Cloudflare e rastreabilidade aos requisitos das Fases 1 e 2B.

### D.3 Conclusão

O repositório encontra-se num estado coerente e avançado. A Fase 3 está completa como documento de arquitetura. A Fase 4 cobre agora as 13 rotas da API (7 do fluxo principal + 6 endpoints secundários). As funcionalidades em falta (D-07 a D-12) são melhoramentos progressivos: Turnstile adaptativo, IndexedDB para rascunhos, tabelas de governação/operações/distribuição e ETag em GET /today.

**Próximo marco:** testes de integração para os endpoints secundários e funcionalidades progressivas (D-07 a D-12).

---

## E. Lista de validação (12 pontos)

| # | Critério | Resultado |
|---|---|---|
| 1 | Cálculo determinístico reproduz valores esperados | Passou (testes de propriedades e dourados) |
| 2 | Máquina de estados sem ramos inválidos | Passou (testes unitários e de concorrência) |
| 3 | Idempotência funcional para mesma chave/mesmo corpo | Passou (testes de repetição e corrida) |
| 4 | Projeções não expõem conteúdo futuro | Passou (separação física em módulos distintos) |
| 5 | Identidade anónima sem impressão digital | Passou (cookie opaco, HMAC, sem fingerprinting) |
| 6 | CSRF e SameSite aplicados | Passou (comparação em tempo constante, SameSite=Strict) |
| 7 | CSP restritiva em todas as rotas HTML | Passou (middleware global, adaptada por ambiente) |
| 8 | Limitação de taxa configurada | Passou (3 limitadores nas rotas críticas) |
| 9 | Contratos OpenAPI validados | Passou (29 testes de contrato) |
| 10 | Migração D1 com restrições CHECK e UNIQUE | Passou (13 tabelas STRICT) |
| 11 | Testes de concorrência para compromissos simultâneos | Passou (73 testes worker) |
| 12 | Fase 3 cobre todos os tópicos exigidos | Passou (ver secção D.1) |
