import type { DocCategory } from "./types"

export const policyTemplatesCategory: DocCategory = {
  slug: "policy-templates",
  title: "Templates de Políticas",
  description:
    "Crie conjuntos reutilizáveis de políticas que podem ser compartilhados entre múltiplos fluxos de API.",
  icon: "FileJson",
  articles: [
    {
      slug: "visao-geral-templates",
      title: "Visão Geral de Templates",
      description:
        "Entenda como templates de políticas simplificam a gestão de configurações repetitivas.",
      icon: "FileJson",
      tags: ["templates", "plugin-configs", "políticas", "reutilização", "overview"],
      content: [
        {
          id: "o-que-sao",
          title: "O que são Templates de Políticas",
          body: `Templates de Políticas (Plugin Configs) são **conjuntos pré-configurados de plugins** que podem ser reutilizados em múltiplas APIs. Em vez de configurar os mesmos plugins repetidamente em cada rota, você define um template uma vez e o referencia onde necessário.

**Benefícios:**

- **Consistência** — mesma configuração aplicada em todas as APIs que usam o template
- **Manutenção simplificada** — altere o template e todas as APIs são atualizadas
- **Redução de erros** — evita configurações divergentes entre rotas similares
- **Padronização** — equipes podem seguir templates aprovados pela organização

**Exemplo prático:**

Um template "Segurança Padrão" pode incluir:
- \`cors\` — configuração de CORS para aplicações web
- \`ip-restriction\` — bloqueio de IPs maliciosos conhecidos
- \`limit-count\` — rate limit padrão de 1000 req/min
- \`prometheus\` — coleta de métricas

Esse template é aplicado a todas as APIs públicas com um único clique.`,
        },
        {
          id: "diferenca-global",
          title: "Templates vs Políticas Globais",
          body: `É importante entender a diferença entre templates e políticas globais:

| Aspecto | Templates de Políticas | Políticas Globais |
|---------|----------------------|-------------------|
| **Escopo** | APIs selecionadas | Todas as APIs |
| **Aplicação** | Referenciado por rota | Automático |
| **Granularidade** | Pode variar por API | Uniforme |
| **Uso típico** | Padrões por equipe/produto | Segurança/observabilidade geral |

**Quando usar cada um:**

- **Templates** — quando você quer padronizar configurações para um **subconjunto** de APIs (ex: todas as APIs públicas, todas as APIs de um time)
- **Políticas Globais** — quando a política deve se aplicar a **absolutamente todas** as APIs sem exceção (ex: logging, métricas)`,
        },
      ],
    },
    {
      slug: "configurando-templates",
      title: "Configurando Templates",
      description:
        "Crie, edite e aplique templates de políticas nas suas APIs.",
      icon: "Settings",
      tags: ["templates", "configuração", "criação", "plugins"],
      content: [
        {
          id: "criando-template",
          title: "Criando um Template",
          body: `Para criar um novo template de políticas:

1. Acesse **Templates de Políticas** no menu lateral
2. Clique em **Novo Template**
3. Defina um **ID** descritivo (ex: \`tpl-seguranca-publica\`)
4. Opcionalmente adicione uma **descrição**
5. Adicione os plugins desejados e configure cada um
6. Salve o template

**Exemplo de template para APIs públicas:**

\`\`\`json
{
  "id": "tpl-api-publica",
  "desc": "Template padrão para APIs públicas",
  "plugins": {
    "cors": {
      "allow_origins": "*",
      "allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
      "allow_headers": "Content-Type,Authorization",
      "max_age": 3600
    },
    "limit-count": {
      "count": 1000,
      "time_window": 60,
      "rejected_code": 429
    },
    "prometheus": {}
  }
}
\`\`\``,
        },
        {
          id: "aplicando-template",
          title: "Aplicando em Rotas",
          body: `Para aplicar um template a uma rota, referencie o ID do template no campo \`plugin_config_id\` da rota:

\`\`\`json
{
  "uri": "/api/v1/produtos",
  "upstream_id": "upstream-produtos",
  "plugin_config_id": "tpl-api-publica"
}
\`\`\`

No editor visual de fluxo, você pode selecionar o template no campo "Template de Políticas" da configuração da rota.

**Ordem de precedência de plugins:**

1. **Políticas Globais** (maior prioridade)
2. **Plugins do Template** (plugin_config)
3. **Plugins da Rota** (menor prioridade)

Se o mesmo plugin existir em mais de um nível, a configuração de **maior prioridade** prevalece. Isso permite que políticas globais nunca sejam sobrescritas por templates ou rotas individuais.`,
        },
        {
          id: "boas-praticas-templates",
          title: "Boas Práticas",
          body: `**Organização:**
- Nomeie templates de forma descritiva: \`tpl-publico\`, \`tpl-interno\`, \`tpl-parceiro\`
- Documente o propósito de cada template na descrição
- Mantenha templates focados — um template por caso de uso

**Manutenção:**
- Revise templates periodicamente para garantir que estão atualizados
- Teste alterações em ambiente de staging antes de aplicar em produção
- Use o sistema de promoções para migrar templates entre ambientes

**Segurança:**
- Não coloque credenciais diretamente nos templates — use o gerenciador de segredos
- Templates de segurança devem ser revisados pela equipe de InfoSec
- Mantenha um template mínimo de segurança que todas as APIs devem usar`,
        },
      ],
    },
  ],
}
