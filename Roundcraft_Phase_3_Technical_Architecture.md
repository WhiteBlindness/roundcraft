# Roundcraft — Fase 3: investigação técnica e arquitetura

**Estado:** Proposta para aprovação<br>
**Data:** 01/09/2026<br>
**Nome de trabalho:** Roundcraft<br>
**Fontes de verdade herdadas:** PRD da Fase 1, exploração de design da Fase 2 e especificação de design selecionada da Fase 2B<br>
**Âmbito:** arquitetura, contratos, modelo de dados, segurança, validação e plano de implantação. Sem código de aplicação, recursos Cloudflare, credenciais, domínio ou conteúdo de produção.

---

## 1. Decisão executiva

O MVP deve usar um **monólito modular na periferia**:

```text
Navegador
├── React + TypeScript
├── rascunho local em IndexedDB
└── pedidos no mesmo domínio
        │
        ▼
Cloudflare Worker
├── recursos estáticos da aplicação
├── API /api/v1
├── validação e máquina de estados
├── cálculo determinístico
├── controlo de divulgação por fase
└── retenção, correções e observabilidade
        │
        ▼
Cloudflare D1
├── edições e projeções imutáveis dos casos
├── identidades pseudónimas
├── tentativas e recibos idempotentes
├── resultados e participação
├── relatórios de equidade
└── eventos mínimos de produto
```

A aplicação e a API são implantadas como uma unidade. Os recursos estáticos com nome baseado no conteúdo são servidos sem executar o Worker quando há uma correspondência. `/api/*` e todas as rotas de navegação que devolvem o HTML da aplicação usam `assets.run_worker_first`, para o Worker acrescentar os cabeçalhos de segurança antes de pedir o HTML à ligação `ASSETS`. A lista de rotas HTML é explícita e faz parte dos testes; não pode surgir uma nova rota sem a atualizar. A Cloudflare documenta esta composição em [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) e o encaminhamento de aplicações de página única em [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).

O D1 é a única autoridade de dados do MVP. Restrições únicas, atualizações condicionais e transações atómicas asseguram que a primeira resposta válida vence. `batch()` executa instruções sequencialmente numa transação e reverte o lote completo se uma delas falhar, conforme a [API do D1](https://developers.cloudflare.com/d1/worker-api/d1-database/).

### 1.1 Serviços incluídos no MVP

| Capacidade | Escolha | Justificação |
|---|---|---|
| Interface e API | Um Cloudflare Worker com Static Assets | Mesmo domínio, política de segurança simples e uma implantação |
| Dados oficiais | Um D1 por ambiente | Modelo relacional, transações, índices e recuperação temporal |
| Rascunhos | IndexedDB no navegador | Recuperação local sem autoridade oficial |
| Limitação de taxa | Ligação de Rate Limiting e regras da zona | Defesa por rota; nunca substitui a unicidade no D1 |
| Proteção contra automatização | Turnstile adaptativo | Só após risco medido ou em ações de abuso elevado |
| Observabilidade | Workers Logs, métricas e rastreios amostrados | Diagnóstico com dados reduzidos e estruturados |
| Analítica oficial | Consultas e eventos mínimos no D1 | Denominadores exatos e política de eliminação controlável |
| Analítica Web | Cloudflare Web Analytics, sujeita a revisão de privacidade | Medição agregada da experiência, sem decisões do jogador |

### 1.2 Serviços adiados

| Serviço | Estado no MVP | Condição de revisão |
|---|---|---|
| Durable Objects | Não usar | Salas em tempo real, colaboração simultânea ou contenção D1 demonstrada |
| Queues | Não usar | Trabalho assíncrono material que possa ser repetido e desduplicado |
| KV | Não usar | Configuração pública, pequena e intensiva em leitura, sem consistência crítica |
| R2 | Não usar | Objetos licenciados, demonstrações ou instantâneos que não pertençam ao Git/D1 |
| Analytics Engine | Não usar como registo oficial | Volume e cardinalidade que justifiquem uma via analítica separada |
| Workers AI | Não usar | Experiência V1.1 em modo sombra, sem autoridade de classificação |
| Workflows | Não usar | Ingestão ou reprocessamento longo e retomável |
| Réplicas de leitura D1 | Não usar | Pressão de leitura medida; nesse caso, usar Sessions |
| Cache API | Não usar para respostas dinâmicas | Conteúdo público imutável com benefício medido |
| Service Worker/PWA | Não usar | Estratégia provada de invalidação sem fuga de conteúdo |

Esta exclusão é uma decisão de arquitetura, não uma limitação permanente.

---

## 2. Mandato, limites e condição de aprovação

### 2.1 O que esta fase decide

- topologia da aplicação e fronteiras de responsabilidade;
- tecnologia de execução, interface e persistência;
- modelo de conteúdo, tentativas, resultados e correções;
- máquina de estados oficial;
- contratos da API e de idempotência;
- cálculo determinístico e representação do resultado;
- proteção contra fuga de conteúdo futuro;
- identidade anónima, privacidade, retenção e eliminação;
- processo editorial e de publicação;
- ambientes, migrações, implantação, reversão e observabilidade;
- estratégia de testes e critérios de passagem à implementação.

### 2.2 O que esta fase não autoriza

- criação de projetos ou recursos Cloudflare;
- criação de outro repositório;
- instalação de dependências da aplicação;
- código, migrações executáveis ou conteúdo de produção;
- configuração de domínio, DNS, Turnstile ou segredos;
- implantação local, de pré-visualização ou pública;
- início da implementação.

### 2.3 Estado da Fase 2B

A Fase 2B continua marcada como «Proposed for approval». Para esta investigação, a direção **Editorial Tactical Desk** é a referência de trabalho porque foi selecionada pelo utilizador. A aprovação desta Fase 3 deve confirmar também essa base e os critérios de protótipo da secção 18 da Fase 2B. Se não forem confirmados, a implementação permanece bloqueada.

### 2.4 Regra de paragem

Esta fase termina com este documento. A Fase 4, a criação de recursos e qualquer código exigem aprovação explícita.

---

## 3. Rastreabilidade dos requisitos

| Requisito herdado | Decisão técnica | Verificação futura |
|---|---|---|
| Uma edição oficial partilhada | Seleção no servidor por `release_at`, estado e hora UTC | Integração e ensaio no limite das 00:00 UTC |
| Uma tentativa oficial por identidade e edição | Índice único em `(identity_id, edition_id, official)` | Concorrência com pedidos simultâneos |
| Primeiro compromisso válido vence | Atualização condicional e recibo na mesma transação D1 | Ensaio de corrida e resposta perdida |
| Rascunho fora de linha não é oficial | IndexedDB local; nenhuma pontuação local | E2E com perda e recuperação de rede |
| Resultado determinístico 50/20/30 | Motor de inteiros, revisões congeladas e testes dourados | Testes unitários e de propriedades |
| Várias linhas defensáveis | Matrizes Q, E e F completas e versionadas | Validador editorial e adjudicação |
| Nenhuma fuga antes dos compromissos | Projeções físicas separadas por fase | Varrimento de HTML, JS, mapas, DOM e API |
| Conteúdo sintético no MVP | Pacotes com origem e rotulagem obrigatórias | Esquema e QA editorial |
| Sem texto livre no MVP | Enumerações fechadas em todos os comandos | Validação de esquemas |
| Identidade anónima, sem impressão digital | Cookie opaco de alta entropia; resumo no D1 | Revisão de privacidade e segurança |
| Limpar localmente não elimina no servidor | Ações e mensagens distintas | E2E e teste de compreensão |
| Eliminação do histórico | Comando provado pelo cookie e limpeza transacional | Ensaio de eliminação e auditoria |
| Período de tolerância de 12 horas | Prazo congelado na tentativa | Ensaios antes, durante e depois do reinício diário |
| Correção sem reescrever o passado | Nova versão de resultado e linhagem | Ensaio de recálculo/correção |
| Distribuições só após conclusão | Projeção autorizada apenas em `decision_complete` | Teste de autorização por estado |
| Acessibilidade WCAG 2.2 AA | Componentes semânticos e matriz manual/automática | Auditoria com teclado e leitores de ecrã |

---

## 4. Alternativas avaliadas

| Opção | Estrutura | Vantagens | Custos e riscos | Decisão |
|---|---|---|---|---|
| A | Worker + D1 | Menor complexidade; uma autoridade; transações completas | Limite e contenção concentrados no D1 | **Escolhida para o MVP** |
| B | Worker + Durable Object por tentativa + D1 | Serialização natural por tentativa | Duas autoridades, projeções, falhas parciais e retenção duplicada | Adiada |
| C | Vários Workers e serviços | Isolamento organizacional | Complexidade e observabilidade desproporcionadas | Rejeitada no MVP |

Os Durable Objects destinam-se a coordenação com estado por entidade e consistência forte. A tentativa Roundcraft tem apenas dois compromissos curtos e transacionais, sem comunicação em tempo real entre jogadores. Assim sendo, D1 satisfaz o contrato com menos estados de falha. Esta decisão deve ser revista se os ensaios demonstrarem contenção que não possa ser resolvida com índices, atualizações condicionais e transações.

Não ativar réplicas de leitura no MVP. Se forem necessárias mais tarde, as réplicas são assíncronas e os fluxos que exigem «ler a própria escrita» devem usar D1 Sessions, como explica a [documentação de replicação](https://developers.cloudflare.com/d1/best-practices/read-replication/).

---

## 5. Tecnologias e organização lógica

### 5.1 Escolhas propostas

| Camada | Escolha | Regra |
|---|---|---|
| Linguagem | TypeScript estrito | Sem `any` implícito; contratos validados nos limites |
| Interface | React + Vite | Aplicação de página única, sem renderização no servidor no MVP |
| Integração Cloudflare | [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/) + Wrangler | Execução local em `workerd`, configuração versionada e tipos gerados das ligações |
| API | [Hono sobre Workers](https://hono.dev/docs/getting-started/cloudflare-workers) | Encaminhamento fino, tipos e middleware explícito |
| Validação | Esquemas versionados, compatíveis com JSON Schema | O mesmo contrato valida autoria, importação e API |
| Base de dados | D1/SQLite | SQL parametrizado, migrações incrementais e índices explícitos |
| Testes | Vitest + Workers test pool + Playwright | Unidade, integração realista e E2E |
| Gestor de pacotes | A decidir na implementação | Um único ficheiro de bloqueio, sem mistura de gestores |

Hono não é uma fronteira de domínio. A máquina de estados, classificação e políticas de divulgação devem permanecer funções independentes de HTTP e D1.

### 5.2 Módulos lógicos do Worker

```text
HTTP
├── política de origem, CSRF e cabeçalhos
├── limitação de taxa e Turnstile adaptativo
├── validação de pedido/resposta
└── catálogo de erros seguro

Domínio
├── política de edição e calendário
├── máquina de estados da tentativa
├── motor de classificação
├── política de divulgação
├── correções e retiradas
└── retenção e eliminação

Persistência
├── repositórios D1
├── transações e recibos idempotentes
├── migrações
└── consultas de projeção
```

Não criar um serviço implantável por módulo. A separação é interna e testável.

---

## 6. Fronteiras de divulgação do conteúdo

O pacote editorial completo nunca é servido ao navegador. A compilação produz artefactos distintos:

| Projeção | Momento de acesso | Conteúdo permitido |
|---|---|---|
| `public_brief_payload` | Antes do compromisso principal | Identidade publicada, regras, estado, factos, esquema, opções principais, qualificadores, cinco provas e confiança |
| `followup_payload` | Depois do compromisso principal aceite | Tipo, novo estímulo e respostas finitas válidas |
| `reveal_payload` | Depois do compromisso de seguimento aceite | Continuação, explicações, alternativa, contrafactual, princípio, fontes públicas e versão do resultado |
| `server_scoring_payload` | Nunca no cliente | Matrizes Q/E/F, limites, bandas internas, aliases e regras de classificação |
| `governance_payload` | Nunca na aplicação pública | Pareceres, direitos, contacto, aprovações, adjudicação e provas internas |

Regras:

1. Cada projeção tem um esquema de lista permitida; não se remove conteúdo proibido de um objeto completo em tempo de resposta.
2. A projeção de seguimento só é lida após a transação do compromisso principal.
3. A revelação só é lida após a transação do segundo compromisso.
4. Não existem URLs previsíveis para revisões futuras ou privadas.
5. Nenhum campo proibido entra em HTML, estado serializado, JavaScript, mapas de código-fonte, metadados, pré-carregamento, memória intermédia ou árvore de acessibilidade.
6. Os mapas de código-fonte podem ser enviados de forma privada para a Cloudflare, mas não são publicados como recursos Web. A Cloudflare suporta esta utilização com `upload_source_maps`, segundo [Source maps](https://developers.cloudflare.com/workers/observability/source-maps/).
7. A política de divulgação devolve DTOs próprios; nunca serializa diretamente linhas D1.

---

## 7. Modelo editorial e publicação

### 7.1 Fonte editorial

Após aprovação para implementação, recomenda-se um repositório privado separado, com nome provisório `roundcraft-content`:

- o repositório da aplicação contém esquemas, validadores, exemplos sintéticos e compilador;
- o repositório de conteúdo contém pacotes editáveis, fontes, direitos, pareceres e calendário;
- a aplicação pública nunca aceita criação ou alteração editorial;
- um processo autenticado de integração contínua valida, compila e publica revisões bloqueadas.

O repositório separado **não deve ser criado nesta fase**.

### 7.2 Fluxo editorial

```text
Proposta
  → viabilidade mecânica
  → rascunho
  → rubrica completa
  → revisão tática 1
  → revisão tática 2
  → adjudicação
  → fontes e direitos
  → cópia e acessibilidade
  → aprovação
  → bloqueio imutável
  → agendamento
  → publicação
  → monitorização
  → arquivo, correção ou retirada
```

### 7.3 Validadores obrigatórios

- 3–5 ações distintas;
- 2–4 qualificadores válidos por ação;
- exatamente cinco provas;
- todos os dez pares de provas por ação, num total de 30–50 células E;
- pesos dimensionais com soma exata de 100;
- valores Q de 0–100, E inteiros de 0–20 e F de 0–100;
- todas as respostas finitas de seguimento cobertas;
- pacotes económicos e inventário conciliados;
- um único contrafactual de uma variável;
- texto equivalente completo para cada esquema;
- duas revisões, adjudicação e direitos válidos;
- substituto sintético para qualquer caso profissional agendado;
- ausência de campos proibidos nas três projeções públicas;
- soma de verificação e revisões imutáveis após bloqueio.

### 7.4 Publicação e reinício diário

O reinício diário não depende de uma tarefa agendada. Em cada pedido, o Worker usa a hora UTC do servidor e seleciona uma edição que cumpra todas as condições:

- `status = locked` ou `released`, conforme o contrato final;
- `release_at <= now`;
- `official_end_at > now`, para novas tentativas oficiais;
- soma de verificação válida;
- sem retirada;
- uma única edição elegível por calendário.

A tentativa congela `edition_id`, revisões e `grace_end_at`. Uma tarefa agendada apenas apoia alertas, retenção e verificações; uma falha dessa tarefa não altera a edição servida.

---

## 8. Modelo de dados D1

### 8.1 Grupos de tabelas

| Grupo | Tabelas conceptuais | Finalidade |
|---|---|---|
| Identidade | `anonymous_identities` | Resumo criptográfico, estado e datas de retenção |
| Catálogo | `cases`, `case_revisions`, `editions` | Identidade, calendário e revisões bloqueadas |
| Projeções | `case_public_briefs`, `case_followups`, `case_reveals`, `case_rubrics` | Separação física por fase |
| Governação | `case_sources`, `rights_records`, `case_reviews`, `case_corrections` | Proveniência, direitos, aprovação e linhagem |
| Tentativas | `attempts`, `attempt_commits`, `idempotency_receipts` | Estado oficial e compromissos imutáveis |
| Resultados | `result_versions`, `participation_credits` | Classificação, correções e participação |
| Produto | `analytics_events`, `fairness_reports`, `distribution_rollups` | Medição mínima e relatórios estruturados |
| Operações | `retention_jobs`, `publication_audits` | Execução idempotente e prova operacional |

### 8.2 Campos mínimos da tentativa

- `attempt_id`, opaco e aleatório;
- `identity_id`, referência interna;
- `edition_id`, `case_revision`, `rubric_revision`, `ruleset_revision` e somas de verificação;
- `mode`: `official` ou `practice`;
- `state` e `sequence`, sempre crescente;
- `issued_at`, `grace_end_at`, datas de compromissos e eliminação;
- `assisted`;
- resposta principal estruturada e resumo do corpo;
- resposta de seguimento estruturada e resumo do corpo;
- componentes exatos e resultado congelado;
- estado de publicação: divulgado, corrigido, retirado ou nulo;
- versão do resultado aplicável.

### 8.3 Restrições e índices essenciais

- índice único parcial em `(identity_id, edition_id)` apenas quando `mode = 'official'`;
- tentativas de prática com `attempt_id` próprio e sem unicidade por edição, para permitir repetições ilimitadas enquanto os direitos o permitirem;
- `UNIQUE(attempt_id, phase)` para o compromisso vencedor de cada fase;
- `UNIQUE(attempt_id, phase, idempotency_key)` para repetição segura;
- `UNIQUE(edition_id, release_at)` e regra editorial contra sobreposição;
- `CHECK` sobre enumerações e intervalos;
- índice em `editions(status, release_at, official_end_at)`;
- índice em `attempts(identity_id, updated_at)`;
- índice em datas de retenção e estados de correção;
- nenhuma eliminação em cascata que apague a linhagem necessária a auditoria ou correção.

As consultas devem selecionar apenas colunas necessárias e usar índices verificados com `EXPLAIN QUERY PLAN`. O D1 tem limites por base de dados e uma base individual executa consultas de forma sequencial; os limites atuais devem ser novamente confirmados antes da implementação em [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

### 8.4 Correções

Uma correção nunca substitui silenciosamente o resultado original:

1. cria uma nova revisão de caso/rubrica;
2. regista motivo, responsável, data e linhagem;
3. cria uma nova `result_version` para tentativas afetadas;
4. preserva componentes e versão anteriores para auditoria mínima;
5. mostra ao jogador o estado corrigido e a explicação pública;
6. exclui ou inclui a tentativa em agregados segundo política explícita.

Uma retirada impede novos compromissos, remove a edição das listas públicas e devolve uma mensagem neutra às tentativas existentes. O crédito de participação segue a política aprovada da Fase 1.

---

## 9. Máquina de estados oficial

Os estados visuais da Fase 2B continuam válidos na interface. O servidor persiste apenas marcos oficiais:

```text
issued
  └── main_locked
        └── decision_complete
              └── debrief_complete
```

Estados terminais/administrativos:

- `expired_uncommitted`;
- `deleted` como marca transitória de execução, não como perfil persistente;
- resultado ou edição com atributos `corrected`, `withdrawn` ou `void`.

`submitting`, `result_pending`, `version_conflict` e `offline_draft` são estados de recuperação da interface ou respostas de operação. Não criam ramos oficiais permanentes.

### 9.1 Transições

| Origem | Comando | Guardas | Mutação atómica | Resultado |
|---|---|---|---|---|
| Sem tentativa | Criar/retomar | Edição publicada; identidade válida | Inserir ou recuperar tentativa única | `issued` + briefing público |
| `issued` | Comprometer principal | Janela/tolerância; sequência; revisões; combinação válida | Resposta + Q/E + recibo + sequência | `main_locked` + seguimento |
| `main_locked` | Comprometer seguimento | Janela/tolerância; sequência; resposta finita válida | Resposta + F + total + participação + recibo | `decision_complete` + revelação |
| `decision_complete` | Concluir debrief | Identidade e sequência válidas | Data explícita + sequência | `debrief_complete` |
| Qualquer permitido | Eliminar histórico | Prova do token e proteção reforçada | Eliminação/anonimização abrangente | Confirmação neutra |

Regras invariantes:

- o relógio do navegador não tem autoridade;
- a primeira mutação válida vence;
- uma nova chave depois do bloqueio nunca substitui a resposta vencedora;
- o resultado fica congelado com as revisões da tentativa;
- `decision_complete` exige os dois compromissos;
- `debrief_complete` exige uma ação explícita, não deslocamento da página;
- o compromisso oficial só existe depois da confirmação do servidor.

---

## 10. Idempotência e concorrência

Cada comando de compromisso inclui:

- `Idempotency-Key`, aleatória e persistida no rascunho;
- `If-Match` com o ETag da sequência esperada;
- revisões e somas de verificação congeladas;
- corpo validado e respetivo resumo criptográfico.

O recibo guarda:

```text
(attempt_id, phase, idempotency_key, request_hash,
 accepted_sequence, accepted_state, response_snapshot)
```

Ordem de decisão do servidor:

1. autenticar a identidade e validar o limite do pedido;
2. aplicar primeiro qualquer retirada ou restrição de direitos que proíba voltar a divulgar o conteúdo;
3. procurar um recibo com a mesma chave;
4. se chave e resumo coincidirem, devolver o `response_snapshot` original ou a projeção neutra exigida pela retirada;
5. se a chave existir com outro resumo, devolver conflito seguro;
6. validar estado, sequência, revisões e prazo;
7. executar uma atualização condicionada a estado e sequência;
8. gravar compromisso, recibo e novo estado na mesma transação;
9. se zero linhas forem alteradas, ler e devolver o estado vencedor sem o substituir.

Verificar o recibo antes do precondicionamento evita que a repetição de uma resposta perdida falhe por sequência antiga.

Semântica:

| Situação | Resposta |
|---|---|
| Mesma chave e mesmo corpo | Mesmo estado, resultado e corpo lógico da primeira resposta |
| Mesma chave e corpo diferente | `409 IDEMPOTENCY_KEY_REUSED` |
| Chave diferente após bloqueio | Estado já aceite, sem revelar proximidade nem aceitar substituição |
| Sequência/revisão antiga antes do bloqueio | `409 VERSION_CONFLICT` com instrução de retoma |
| Entrada inválida | `422 VALIDATION_ERROR`, sem escrita |
| Prazo terminado | `410 ATTEMPT_EXPIRED`, sem consumo de participação |

---

## 11. Cálculo determinístico

A fórmula herdada mantém-se:

```text
S = round_half_up(0,50 × Q + E + 0,30 × F)
```

Para evitar diferenças de ponto flutuante, o compilador calcula primeiro `q_quarters`, o numerador exato de Q em quartos de ponto:

```text
raw_q_quarters = Σ(weight_i × rating_i)
q_quarters = min(raw_q_quarters, 4 × lowest_applicable_cap)
Q = q_quarters / 4

total_units = 25 × q_quarters + 200 × E + 60 × F
S = floor((total_units + 100) / 200)
```

Cada `weight_i` é inteiro, cada `rating_i` pertence a 0–4 e os pesos somam 100. Assim, Q pode conter quartos de ponto sem usar valores de vírgula flutuante. A escala de 1/200 torna também exatas as contribuições de 50% e 30%. Não usar `Math.round` sobre uma cadeia de resultados binários.

### 11.1 Componentes apresentados

O PRD exige componentes 50/20/30 e um total inteiro. Para que os três valores inteiros apresentados somem sempre a `S`, propõe-se:

1. calcular as contribuições exatas `0,50Q`, `E` e `0,30F`;
2. tomar a parte inteira de cada contribuição;
3. distribuir as unidades que faltam pelos maiores restos;
4. usar uma ordem de desempate fixa: principal, provas, seguimento;
5. preservar os valores exatos no registo e no detalhe acessível.

Esta regra de apresentação não altera a fórmula. Requer aprovação explícita, porque as fases anteriores não definiram como repartir o arredondamento do total pelos componentes.

### 11.2 Provas obrigatórias

- todos os pesos somam 100;
- o limite aplicável mais baixo vence;
- todos os 30–50 valores E estão cobertos;
- todas as respostas F estão cobertas;
- aliases produzem o mesmo resultado;
- a ordem das duas provas não muda E;
- repetições e concorrência não mudam o resultado;
- alterações na continuação oculta, sem mudança da rubrica, não mudam o resultado;
- testes dourados reproduzem total, componentes, bandas e motivos;
- testes de propriedades provam intervalos e monotonicidade onde a rubrica a exigir.

---

## 12. Contrato da API

Prefixo: `/api/v1`. Resposta comum:

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "meta": {
    "request_id": "opaque",
    "api_version": "v1"
  }
}
```

Em erro, `data` é nulo e `error` contém apenas `code`, `message` seguro e campos de validação permitidos.

### 12.1 Pontos de acesso

| Método e rota | Finalidade | Memória intermédia |
|---|---|---|
| `POST /session` | Emitir/renovar contexto pseudónimo e CSRF | `private, no-store` |
| `GET /today` | Obter apenas capa e metainformação pública da edição atual | Revalidação por ETag; nunca futuro |
| `POST /attempts` | Criar ou retomar tentativa da edição | `private, no-store` |
| `GET /attempts/{id}` | Retomar estado autorizado | `private, no-store` |
| `POST /attempts/{id}/main-commit` | Bloquear decisão principal | `private, no-store` |
| `POST /attempts/{id}/followup-commit` | Bloquear seguimento e calcular resultado | `private, no-store` |
| `POST /attempts/{id}/debrief-complete` | Registar conclusão explícita | `private, no-store` |
| `GET /cases` | Listar apenas edições já divulgadas | ETag por versão pública |
| `POST /practice-attempts` | Criar repetição sem crédito oficial | `private, no-store` |
| `GET /progress` | Histórico da identidade atual | `private, no-store` |
| `POST /fairness-reports` | Categoria estruturada | `private, no-store` |
| `POST /events` | Acontecimentos permitidos e versionados | `private, no-store` |
| `DELETE /history` | Eliminar histórico no servidor | `private, no-store` |

Não existe uma rota que devolva o pacote completo, rubricas ou calendário futuro.

### 12.2 Códigos de estado

| Código | Uso |
|---:|---|
| 400 | Pedido malformado |
| 401 | Cookie pseudónimo ausente/inválido quando necessário |
| 403 | Origem/CSRF/Turnstile falhou, sem detalhe sensível |
| 404 | Recurso desconhecido, não publicado ou não pertencente à identidade |
| 409 | Estado, sequência, revisão ou idempotência em conflito |
| 410 | Tentativa expirada ou edição retirada segundo política |
| 422 | Valores estruturados inválidos |
| 429 | Limite temporário excedido |
| 503 | Dependência temporariamente indisponível; compromisso não confirmado |

IDs inexistentes, privados e pertencentes a outra identidade devem produzir a mesma forma de 404. Nenhuma mensagem indica que uma escolha inválida esteve «perto» de uma escolha aceite.

### 12.3 Contratos futuros antes de código

A implementação deve começar por:

- OpenAPI 3.1 da API;
- JSON Schema de pedidos, respostas e pacotes;
- catálogo versionado de erros;
- exemplos sintéticos válidos e inválidos;
- testes de contrato gerados a partir destes artefactos.

---

## 13. Identidade, segurança e privacidade

### 13.1 Identidade pseudónima

- token aleatório com pelo menos 128 bits de entropia;
- cookie `__Host-roundcraft`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` e sem `Domain`;
- D1 guarda apenas um resumo/verificador com segredo do servidor e metadados mínimos;
- rotação segura quando houver suspeita ou mudança de versão do formato;
- nenhuma impressão digital do dispositivo;
- limpar cookies cria uma nova identidade, como previsto no PRD;
- «Limpar este dispositivo» e «Eliminar dados do servidor» são ações distintas.

`SameSite=Strict` é a proposta inicial porque a aplicação e API partilham origem e não há autenticação por ligações externas. Rever apenas se a experiência de entrada por ligação exigir `Lax`.

### 13.2 Pedidos de alteração

- aceitar apenas HTTPS e conteúdo JSON nos comandos da aplicação;
- validar `Origin` e cabeçalhos Fetch Metadata;
- exigir token CSRF ligado à sessão pseudónima;
- CORS fechado à origem oficial;
- consultas sempre parametrizadas;
- validar esquemas, comprimentos, enumerações e IDs;
- aplicar limites de corpo pequenos;
- não efetuar chamadas externas dentro da transação oficial.

### 13.3 Cabeçalhos

- Content Security Policy restrita;
- `Strict-Transport-Security` configurado na zona após domínio e HTTPS estáveis;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin` ou mais restrita após teste;
- `Permissions-Policy` sem capacidades desnecessárias;
- `frame-ancestors 'none'` na CSP;
- `Cache-Control: private, no-store` em respostas pessoais ou dependentes da fase.

Sem Turnstile, a CSP deve permitir apenas recursos próprios. Se o Turnstile for ativado, acrescentar estritamente os domínios necessários da Cloudflare para script e frame.

As rotas que devolvem o documento HTML executam o Worker primeiro e recebem CSP, `frame-ancestors`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e a política de memória intermédia antes da resposta `ASSETS`. Os ficheiros imutáveis com resumo no nome continuam no percurso direto. Testes E2E verificam os cabeçalhos em `/`, em cada rota SPA e numa amostra de JS, CSS, fontes e imagens. A proteção HSTS é verificada separadamente ao nível da zona.

### 13.4 Turnstile e limites de taxa

O Turnstile não aparece em todas as jogadas. Ativa-se de forma progressiva para criação anómala de tentativas, relatórios repetidos, eliminação ou abuso medido. A validação no servidor é obrigatória; os tokens expiram ao fim de cinco minutos e são de utilização única, conforme [Server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Os limites combinam:

- identidade pseudónima para quotas funcionais;
- rota/ação para proteção operacional;
- sinal de rede grosseiro, temporário e com retenção curta;
- WAF/mitigação DDoS da zona;
- Turnstile quando o risco ultrapassa o limiar.

A ligação de Rate Limiting é permissiva e pode apresentar consistência eventual. Serve para redução de abuso, não para garantir a regra «uma tentativa», que permanece no D1. Ver [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

### 13.5 Modelo de ameaças resumido

| Ameaça | Impacto | Controlo principal | Prova |
|---|---|---|---|
| Obter resposta/rubrica antes do compromisso | Integridade do jogo | Projeções físicas separadas | Varrimento automatizado de fugas |
| Enumerar casos futuros | Calendário e respostas expostos | IDs opacos, 404 uniforme, sem calendário futuro | Ensaios de enumeração |
| Repetir/substituir compromisso | Resultado incorreto | Idempotência, sequência e transação | Concorrência e repetição |
| Forjar pedido a partir de outro sítio | Alteração indevida | SameSite, Origin, Fetch Metadata e CSRF | Testes CSRF |
| Roubar identidade por script | Histórico exposto | HttpOnly, CSP e ausência de HTML livre | Testes XSS/CSP |
| Automatizar tentativas/relatórios | Custo e qualidade de dados | Limites progressivos e Turnstile | Testes de carga/abuso |
| Injetar dados/SQL | Corrupção ou leitura | Esquemas e SQL parametrizado | Testes de entradas hostis |
| Expor segredos em configuração/registos | Compromisso da infraestrutura | Secrets, revisão e varrimento | Scanner de segredos |
| Publicar revisão errada | Resultado/revelação incoerentes | Bloqueio, soma e implantação transacional | Ensaio editorial |
| Corrigir sem rastreio | Perda de confiança | Resultados versionados e linhagem | Ensaio de correção |

### 13.6 Segredos

No MVP, cada segredo é exclusivo de um único Worker e deve usar Worker Secrets. O Secrets Store só se justifica quando vários Workers partilham uma credencial ou quando a governação central o exigir. Ligações e segredos ficam separados por ambiente; valores sensíveis nunca entram em `vars`, Git, respostas ou registos. As [Workers bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) permitem aceder a recursos sem incorporar tokens da API no código.

---

## 14. Retenção, eliminação e correção

| Classe | Retenção proposta | Observação |
|---|---:|---|
| Identidade e tentativas pseudónimas | 90 dias | Herdado da Fase 1; eliminar ou anonimizar conforme necessidade |
| Sinais de rede para abuso | 7 dias | Resumo grosseiro, sem impressão digital |
| Workers Logs nativos | Até 7 dias | Usar o mínimo suportado que permita operar; confirmar por plano |
| Rastreios | Amostragem e retenção nativa do plano | Sem corpos, tokens ou escolhas |
| Relatórios de equidade | 90 dias | Categorias fechadas; sem texto livre no MVP |
| Rascunhos locais | Até ação do utilizador/navegador | Não são oficiais |
| Agregados irreversíveis | Enquanto tiverem finalidade aprovada | Sem possibilidade razoável de voltar a uma identidade |
| Conteúdo e governação | Segundo direitos e auditoria | Separado dos dados do jogador |

A página atual de [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) deve ser consultada antes de configurar retenção, porque os limites dependem do plano.

### 14.1 Eliminação do servidor

1. exigir posse do token atual, proteção CSRF e, se houver risco, Turnstile;
2. criar uma operação idempotente com prazo e recibo neutro;
3. eliminar tentativas, compromissos, recibos pessoais, progresso e relatórios ligados;
4. remover a ligação da identidade a agregados que ainda sejam reversíveis;
5. preservar apenas agregados verdadeiramente irreversíveis e autorizados;
6. concluir no máximo em 30 dias, com objetivo operacional muito inferior;
7. não afirmar conformidade jurídica sem validação própria.

Limpar IndexedDB/cookies não executa esta operação. Eliminar no servidor não consegue limpar um navegador que já não comunica; a interface deve explicar ambos os efeitos.

### 14.2 Jurisdição e base jurídica

A residência/jurisdição dos dados, base jurídica, idade mínima, texto de privacidade, subcontratantes e eventual consentimento precisam de validação antes da beta. Uma preferência de localização D1 não deve ser tratada como garantia jurídica sem confirmar o contrato e a funcionalidade atual da conta.

---

## 15. Analítica e indicadores

Separar três planos:

1. **estado oficial:** tentativas, compromissos e participação no D1;
2. **projeções de produto:** eventos fechados e agregados no D1;
3. **experiência Web:** métricas agregadas sem respostas, se Web Analytics for aprovado.

### 15.1 Acontecimentos permitidos

| Evento | Momento | Campos permitidos |
|---|---|---|
| `today_loaded` | Capa carregada | edição pública, versão e resultado técnico |
| `attempt_issued` | Emissão | edição, modo, assistência, versão |
| `attempt_resumed` | Retoma | edição, modo, estado público e versão |
| `state_reached` | Entrada num estado visual permitido | edição, modo e nome fechado do estado |
| `assisted_context_used` | Ajuda/glossário | edição, modo e ID neutro da ajuda |
| `main_committed` | Confirmação | edição, modo, duração por intervalo, versão |
| `followup_committed` | Confirmação | edição, modo, duração por intervalo, versão |
| `decision_complete` | Segundo compromisso | edição, modo, assistência, banda geral aprovada |
| `debrief_opened` | Abertura da análise | edição, modo e assistência |
| `debrief_complete` | Ação explícita | edição, modo, assistência |
| `sources_opened` | Abertura das fontes | edição, origem e versão pública |
| `share_invoked` | Partilha neutra | edição e superfície; nunca resposta/resultado individual |
| `fairness_reported` | Envio | edição e categoria fechada |
| `practice_started` | Início de repetição | edição e versão pública |
| `return_visit` | Nova visita elegível | intervalo temporal e coorte agregada aprovada |
| `case_withdrawn_seen` | Recuperação | edição e versão pública |
| `history_deleted` | Conclusão | apenas contagem operacional agregada |

Não enviar para analítica geral:

- ação, qualificador, provas ou resposta de seguimento;
- confiança individual;
- token, ID de tentativa ou resumo reutilizável da identidade;
- conteúdo futuro, rubrica ou continuação;
- texto pessoal ou endereço IP em bruto.

Os indicadores oficiais resultam de consultas às transições D1, não de eventos que possam falhar. `debrief_complete` é uma escrita explícita.

### 15.2 Analytics Engine

Fica adiado. As escritas são adequadas a métricas de alta cardinalidade, mas podem ser amostradas/falhar sem participar numa transação oficial. A retenção atual é de três meses e deve ser novamente confirmada em [Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/). Só adotar quando houver volume, esquema, finalidade e processo de anonimização aprovados.

### 15.3 Distribuições

- mostrar apenas depois de `decision_complete`;
- exigir pelo menos 100 tentativas oficiais, pontuadas e elegíveis para a edição;
- excluir prática, retirados, anulados e automatização suspeita;
- separar utilização de ajuda;
- nunca redefinir a correção editorial;
- recalcular de forma versionada após correção;
- não permitir que consultas públicas revelem escolhas de um grupo pequeno.

O perfil por lente continua sujeito aos limiares herdados: pelo menos cinco amostras oficiais pontuadas nessa lente e 15 casos oficiais pontuados no total. Tentativas assistidas ficam excluídas desse perfil até a beta demonstrar neutralidade da ajuda.

---

## 16. Memória intermédia e comportamento fora de linha

### 16.1 Recursos estáticos

- nomes baseados no conteúdo para JS, CSS, fontes e imagens;
- `public, max-age=31536000, immutable` nesses recursos;
- HTML com `max-age=0, must-revalidate`;
- `run_worker_first` em `/api/*` e em todas as rotas HTML da aplicação, para aplicar cabeçalhos de segurança;
- nenhuma fonte de terceiros no MVP;
- nenhum mapa de código-fonte público em produção.

### 16.2 API

- `private, no-store` em identidade, tentativa, seguimento, revelação, progresso e relatórios;
- ETag em metainformação pública imutável ou revalidável;
- nenhuma Cache API para respostas dependentes do estado;
- uma correção cria nova chave/revisão e invalida o apontador público curto.

### 16.3 IndexedDB

Pode guardar:

- ID opaco da tentativa;
- revisão pública;
- escolhas ainda não confirmadas;
- chave de idempotência do envio pendente;
- preferências e progresso visual local.

Não pode guardar:

- token HttpOnly;
- rubricas, respostas ou conteúdo futuro;
- resultado «oficial» calculado localmente;
- conteúdo de outra fase antes da autorização do servidor.

Sem ligação, o jogador pode continuar a editar o rascunho. O produto só mostra bloqueio, participação ou resultado depois da confirmação do servidor. Não criar Service Worker no MVP.

---

## 17. Ambientes, implantação e reversão

### 17.1 Ambientes

| Ambiente | Dados | Recursos | Finalidade |
|---|---|---|---|
| Local | Sintéticos, descartáveis | D1 local simulado | Desenvolvimento e unidade |
| Pré-visualização | Sintéticos isolados por alteração | Worker/D1 temporários ou namespace próprio | Revisão funcional |
| Pré-produção | Pacote de ensaio controlado | Worker, D1, segredos e domínio separados | Integração e ensaios finais |
| Beta fechada | Apenas casos aprovados para beta | Recursos isolados de produção pública | Validação com coorte |
| Produção | Conteúdo e dados reais aprovados | Recursos próprios | Serviço público |

Dados de produção nunca entram em testes. Ligações, variáveis e segredos devem ser repetidos explicitamente por ambiente, porque muitos campos Wrangler não são herdados; ver [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/).

### 17.2 Via de entrega

```text
alteração
  → validação de esquema
  → testes unitários e de propriedades
  → integração D1/Worker
  → E2E e acessibilidade
  → varrimento de segredos e fugas
  → artefacto imutável
  → pré-produção
  → ensaios de fumo, concorrência e migração
  → aprovação manual
  → produção
  → monitorização
```

Construir uma vez e promover o mesmo artefacto. O conteúdo usa uma via separada, mas compatível com as versões de esquema aceites pela aplicação.

### 17.3 Implantação

No MVP, implantar uma única versão de aplicação de cada vez. Uma implantação gradual pode servir versões diferentes em pedidos consecutivos, enquanto D1 e outros armazenamentos não acompanham automaticamente a versão do Worker. Só ativar depois de provar compatibilidade de contratos e migrações. Ver [Gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/).

### 17.4 Migrações D1

Usar o padrão «expandir, migrar, mudar, contrair»:

1. adicionar estruturas compatíveis;
2. implantar código que compreenda versões antiga e nova;
3. preencher dados de forma idempotente;
4. mudar leituras/escritas;
5. esperar pelo período de tolerância máximo de 12 horas e concluir verificações;
6. remover estruturas antigas numa alteração posterior.

As migrações ficam numeradas e testadas numa cópia sintética. Consultar [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) antes da implementação.

### 17.5 Reversão e recuperação

- reversão de código não reverte dados;
- manter compatibilidade para a versão anterior durante cada implantação;
- criar marcador operacional antes de migrações materiais;
- ensaiar recuperação temporal num ambiente não produtivo;
- documentar quem decide e comunica uma correção/retirada;
- nunca restaurar D1 em produção como primeira reação sem avaliar perda de escritas.

D1 Time Travel permite recuperação pontual, mas a restauração substitui o estado atual. O prazo disponível depende do plano; confirmar em [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

---

## 18. Observabilidade e operação

### 18.1 Registos estruturados

Campos permitidos:

- `request_id` aleatório;
- rota normalizada e método;
- estado HTTP e código de erro interno;
- duração por intervalo;
- ambiente e versão da aplicação;
- resultado operacional da transação;
- estado D1 agregado, sem SQL ou valores pessoais.

Campos proibidos:

- cookies, tokens, CSRF ou segredos;
- corpos de pedidos/respostas;
- escolhas, provas, confiança ou resultado individual;
- conteúdo futuro e rubricas;
- endereços IP em bruto;
- texto de relatório.

### 18.2 Métricas e alertas

- taxa de erros por rota e versão;
- latência p50/p95/p99 dos pedidos e compromissos;
- conflitos de sequência e repetições idempotentes;
- falhas D1, consultas lentas e tamanho da base;
- edições sem substituto ou perto do prazo sem bloqueio;
- falhas de retenção, correção e eliminação;
- respostas 429 e desafios Turnstile;
- diferença entre compromissos oficiais e agregados derivados.

### 18.3 Objetivos provisórios para a beta

Estes valores são alvos de validação, não compromissos públicos:

- disponibilidade mensal da API: 99,9%;
- p95 de leitura dinâmica: até 500 ms no percurso esperado;
- p95 de compromisso: até 1 s;
- nenhuma perda de compromisso confirmado;
- recuperação operacional inicial em até 30 minutos para falhas reversíveis;
- zero fugas conhecidas de conteúdo futuro ou segredos.

O orçamento de volume e custo só pode ser fechado depois de escolher o plano Cloudflare, coorte, tráfego esperado e domínio. Não inventar uma estimativa sem esses dados.

---

## 19. Estratégia de testes

### 19.1 Unidade e propriedades

- fórmula, limites, arredondamento e repartição de componentes;
- todos os valores Q/E/F e aliases;
- máquina de estados e guardas;
- seleção de edição e período de tolerância;
- política de divulgação por estado;
- correções e retiradas;
- validação de pacotes e reconciliação económica;
- redatores de registos e respostas de erro.

### 19.2 Integração Worker + D1

- migrações para base vazia e base da versão anterior;
- criação concorrente da mesma tentativa;
- dois compromissos principais simultâneos diferentes;
- dois compromissos de seguimento simultâneos;
- mesma chave/mesmo corpo e mesma chave/corpo diferente;
- resposta perdida depois da escrita;
- sequência antiga, revisão antiga e prazo terminado;
- reinício diário durante a tentativa e período de tolerância;
- eliminação, correção, anulação e retirada;
- falha D1 antes, durante e depois da transação;
- consultas e índices sob volume sintético.

### 19.3 E2E

- percurso oficial completo com rato, toque e teclado;
- retoma após atualização/fecho;
- perda de rede antes e depois de cada confirmação;
- prática separada do resultado oficial;
- histórico, distribuição, relatório e eliminação;
- edição indisponível, retirada e resultado corrigido;
- tamanhos móveis e ampliação a 200%/400%;
- movimento reduzido, contraste elevado e temas suportados.

### 19.4 Segurança e ausência de fugas

Varrer, em cada estado:

- HTML bruto e DOM;
- árvore de acessibilidade;
- respostas JSON e cabeçalhos;
- pacotes JS/CSS e recursos estáticos;
- mapas de código-fonte e manifesto de construção;
- nomes de ficheiros, metadados, ETags e URLs;
- memória intermédia do navegador e da Cloudflare;
- IndexedDB, localStorage e pedidos de pré-carregamento.

Os testes usam marcadores proibidos únicos nos pacotes privados. Qualquer ocorrência antes da fase autorizada falha a entrega.

### 19.5 Acessibilidade

- axe/automação como primeira barreira, nunca como prova única;
- teclado completo, ordem de foco e foco após transições;
- leitores de ecrã em pelo menos Windows e uma plataforma móvel;
- texto equivalente do esquema e relações espaciais compreensíveis;
- anúncios não intrusivos de bloqueio, erro, conflito e resultado;
- estados não dependentes apenas de cor;
- alvos tácteis e orientação suportada;
- sem limite de tempo para responder.

### 19.6 Cobertura

O código de domínio e os contratos críticos devem atingir pelo menos 80% de cobertura, com 100% das transições, células editoriais válidas, rejeições críticas e caminhos de idempotência cobertos. A percentagem não substitui os ensaios adversariais.

---

## 20. Evolução planeada

### MVP

- monólito modular Worker + Static Assets;
- D1 único por ambiente, sem réplica;
- identidade pseudónima e respostas estruturadas;
- motor determinístico no servidor;
- processo editorial validado, sem CMS;
- casos sintéticos;
- rascunhos IndexedDB;
- retenção e observabilidade mínimas;
- sem dependências externas no compromisso oficial.

### V1.1, apenas após os respetivos limiares

- contas opcionais e associação explícita do histórico;
- arquivo alargado e perfis;
- réplicas D1 com Sessions;
- Queue para trabalho repetível que não confirma o compromisso;
- Workers AI em modo sombra, depois do compromisso e sem efeito na pontuação;
- Analytics Engine para métricas não oficiais;
- agregados pré-calculados quando as consultas o exigirem.

### V2

- ingestão editorial separada;
- R2 privado para objetos licenciados;
- Workflows e Queues para ingestão/reprocessamento;
- suporte a casos profissionais com direitos completos;
- interpretação assistida por IA com confirmação humana;
- Durable Objects apenas para novas experiências em tempo real.

### Não construir no MVP

- microserviços;
- Durable Objects, KV, R2, Queues, Workflows ou Workers AI;
- GraphQL;
- renderização no servidor;
- CMS público;
- Service Worker/PWA;
- autenticação obrigatória;
- pagamentos;
- texto livre;
- cálculo ou pontuação no cliente;
- tabelas classificativas ou prémios;
- WebSockets;
- importação automática de demonstrações;
- conteúdo profissional sem autorização escrita.

---

## 21. Decisões que exigem aprovação

### 21.1 Propostas prontas a aprovar

- nome de trabalho do projeto: **Roundcraft**;
- arquitetura MVP: Worker + Static Assets + D1;
- React, Vite, TypeScript e Hono;
- aplicação e API no mesmo domínio;
- D1 como única autoridade do MVP;
- sem Durable Objects, filas, KV, R2, IA ou Service Worker no MVP;
- quatro projeções físicas de conteúdo e governação separada;
- cookie pseudónimo HttpOnly/Secure/SameSite=Strict;
- Turnstile apenas adaptativo;
- analítica oficial no D1, sem escolhas em analítica geral;
- processo editorial privado e sem CMS;
- implantação de versão única no MVP;
- regra de inteiros para classificação e maiores restos na apresentação;
- novo repositório privado de conteúdo apenas depois da aprovação para implementar.

### 21.2 Decisões externas ainda necessárias antes da beta

- plano e orçamento Cloudflare;
- domínio de produção;
- jurisdição/residência de dados e validação jurídica;
- base jurídica, idade mínima, privacidade e subcontratantes;
- volume esperado e coorte da beta;
- responsáveis editoriais, revisores, adjudicador e aprovador de direitos;
- política detalhada para fontes e eventuais objetos em R2;
- autorização escrita para qualquer caso profissional;
- utilização ou não de Cloudflare Web Analytics;
- objetivos finais de serviço e recuperação.

Estas decisões não impedem a preparação local da implementação depois de a arquitetura ser aprovada, mas impedem a beta ou produção quando afetam recursos, privacidade ou operação.

---

## 22. Critérios de passagem à implementação

A Fase 3 fica aprovada quando:

- [ ] a Fase 2B e a sua validação de protótipo são confirmadas;
- [ ] a arquitetura Worker + D1 é aceite;
- [ ] a separação física de conteúdo é aceite;
- [ ] a máquina de estados e a idempotência são aceites;
- [ ] o modelo de dados, correções e retenção são aceites;
- [ ] a regra exata de classificação/apresentação é aceite;
- [ ] os pontos de acesso e erros da API são aceites;
- [ ] o modelo de identidade, CSRF e Turnstile é aceite;
- [ ] o processo editorial privado é aceite;
- [ ] os serviços adiados são confirmados;
- [ ] o plano de ambientes, migrações e reversão é aceite;
- [ ] a estratégia de testes e ausência de fugas é aceite;
- [ ] não subsiste risco P0/P1 sem controlo ou decisão explícita;
- [ ] existe autorização explícita para iniciar a implementação.

Até esta lista ser aprovada, não criar código, recursos Cloudflare, repositório de conteúdo ou implantação.

---

## 23. Registo de investigação

Consulta técnica efetuada em 31/08/2026 e revisão final concluída em 01/09/2026. Antes da implementação, confirmar novamente versões, preços, limites e funcionalidades em estado beta.

| Tema | Fonte oficial | Decisão suportada |
|---|---|---|
| Recursos estáticos e Worker | [Worker script routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) | Uma implantação e execução seletiva de `/api/*` |
| SPA | [Single-page application](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) | Encaminhamento seguro da interface |
| D1 transacional | [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) | Compromissos e recibos atómicos |
| Réplicas | [D1 read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/) | Adiar; Sessions se forem ativadas |
| Limites D1 | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) | Capacidade e índices a validar |
| Migrações | [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) | Migrações versionadas |
| Recuperação | [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) | Recuperação separada da reversão de código |
| Limitação de taxa | [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) | Defesa contra abuso, não autoridade |
| Turnstile | [Server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) | Validação no servidor, tokens breves e únicos |
| Ambientes | [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/) | Ligações e segredos isolados |
| Ligações | [Workers bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) | Recursos sem tokens incorporados |
| Observabilidade | [Workers observability](https://developers.cloudflare.com/workers/observability/) | Registos/rastreios estruturados e reduzidos |
| Registos | [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) | Retenção e campos a confirmar por plano |
| Mapas de código-fonte | [Source maps](https://developers.cloudflare.com/workers/observability/source-maps/) | Envio privado, não publicação Web |
| Analítica Web | [Web Analytics](https://developers.cloudflare.com/web-analytics/about/) | Opção agregada sujeita a revisão |
| Analytics Engine | [Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/) | Adiado; não é registo oficial |
| Versões | [Versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/) | Código e dados têm ciclos diferentes |
| Implantação gradual | [Gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/) | Adiada até haver compatibilidade provada |

---

## 24. Decisão final desta fase

Recomenda-se aprovar esta arquitetura como base da implementação do Roundcraft, com D1 como única autoridade e uma separação física rigorosa do conteúdo por fase. A proposta privilegia integridade, clareza operacional e evolução progressiva.

**Paragem obrigatória:** aguardar aprovação explícita antes de iniciar a implementação.
