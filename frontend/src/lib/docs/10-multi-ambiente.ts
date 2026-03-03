import type { DocCategory } from "./types"

export const multiAmbienteCategory: DocCategory = {
  slug: "multi-ambiente",
  title: "Multi-Ambiente",
  description:
    "Gerencie ambientes isolados (dev, staging, producao) e promova APIs entre eles com seguranca.",
  icon: "Layers",
  articles: [
    {
      slug: "ambientes",
      title: "Gerenciando Ambientes",
      description:
        "Entenda o conceito de ambientes, como criar e configurar cada um deles e alternar entre eles no dashboard.",
      icon: "Layers",
      tags: ["ambientes", "dev", "staging", "producao"],
      content: [
        {
          id: "o-que-sao-ambientes",
          title: "O que sao Ambientes",
          body: `Ambientes representam instancias isoladas do API Gateway, cada uma com suas proprias rotas, upstreams, plugins e configuracoes. O FuseOne API Gateway permite criar quantos ambientes forem necessarios, mas a maioria das organizacoes trabalha com tres:

- **Desenvolvimento (dev)** — usado pelas equipes de engenharia para testes rapidos e iteracoes. Geralmente conectado a backends locais ou de sandbox.
- **Homologacao (staging)** — replica fiel do ambiente de producao, utilizado para testes de integracao e validacao antes do deploy final.
- **Producao (prod)** — ambiente real que recebe trafego de clientes. Possui politicas mais restritivas de seguranca e rate limiting.

> **Nota:** Cada ambiente aponta para uma instancia separada do API Gateway (e seu respectivo etcd). Isso garante isolamento total entre os ambientes.

A separacao em ambientes permite que voce desenvolva e teste novas configuracoes sem risco de impactar usuarios finais.`,
        },
        {
          id: "criando-ambientes",
          title: "Criando e Configurando Ambientes",
          body: `Para criar um novo ambiente, acesse **Configuracoes > Ambientes** e clique em **Novo Ambiente**. Preencha os seguintes campos:

- **Nome** — identificador unico do ambiente (ex: \`dev\`, \`staging\`, \`prod\`).
- **Descricao** — breve descricao do proposito do ambiente.
- **URL do Admin API** — endereco da Admin API do API Gateway deste ambiente (ex: \`https://apisix-dev.internal:9180\`).
- **Chave de API** — chave de autenticacao para a Admin API do gateway.
- **Cor do Badge** — cor visual para identificar rapidamente o ambiente no dashboard.

> **Dica:** Use nomes curtos e padronizados para os ambientes. Isso facilita a automacao via CI/CD e scripts de promocao.

Apos salvar, o ambiente aparece na lista e pode ser selecionado pelo seletor de ambientes no topo do dashboard. Todas as operacoes (criacao de rotas, upstreams, plugins) passam a atuar no ambiente selecionado.

\`\`\`
POST /api/environments
{
  "name": "staging",
  "description": "Ambiente de homologacao",
  "admin_url": "https://apisix-staging.internal:9180",
  "admin_key": "sua-chave-aqui",
  "color": "#f59e0b"
}
\`\`\``,
        },
        {
          id: "seletor-de-ambiente",
          title: "Alternando entre Ambientes no Dashboard",
          body: `O **seletor de ambientes** fica localizado na barra lateral do dashboard, logo abaixo do logotipo do FuseOne. Ele exibe o nome e a cor do ambiente atualmente ativo.

Para alternar:

- Clique no seletor e escolha o ambiente desejado na lista suspensa.
- O dashboard recarrega automaticamente todos os dados (rotas, upstreams, plugins, metricas) do novo ambiente.
- Um badge colorido permanece visivel em todas as paginas para que voce sempre saiba em qual ambiente esta trabalhando.

> **Atencao:** Todas as acoes realizadas no dashboard (criar, editar, excluir recursos) afetam **somente** o ambiente selecionado. Verifique sempre o badge do ambiente antes de fazer alteracoes em producao.

O estado do ambiente selecionado e persistido na sessao do usuario. Ao fazer login novamente, o ultimo ambiente utilizado sera restaurado automaticamente.`,
        },
        {
          id: "conexao-gateway",
          title: "Conexao com o Gateway por Ambiente",
          body: `Cada ambiente mantem sua propria conexao com uma instancia do API Gateway. O FuseOne utiliza a Admin API do gateway para sincronizar recursos.

Detalhes da conexao:

- **Health Check** — o sistema verifica periodicamente a disponibilidade da Admin API de cada ambiente. O status aparece como um indicador verde/vermelho na lista de ambientes.
- **Timeout** — o timeout padrao para requisicoes a Admin API e de 10 segundos, configuravel por ambiente.
- **TLS** — conexoes HTTPS sao recomendadas para todos os ambientes, especialmente producao.

Para testar a conexao manualmente, acesse **Configuracoes > Ambientes**, selecione o ambiente desejado e clique em **Testar Conexao**. O sistema tentara se conectar a Admin API e retornara o status da instancia do gateway.

> **Dica:** Em ambientes de desenvolvimento local, voce pode usar \`http://localhost:9180\` como URL da Admin API, mas nunca utilize HTTP em ambientes de staging ou producao.`,
        },
      ],
    },
    {
      slug: "promocoes",
      title: "Promocao de APIs entre Ambientes",
      description:
        "Aprenda o fluxo de promocao de configuracoes entre ambientes, visualizacao de diffs e aprovacao.",
      icon: "ArrowUpCircle",
      tags: ["promocao", "deploy", "diff", "aprovacao"],
      content: [
        {
          id: "fluxo-de-promocao",
          title: "Fluxo de Promocao",
          body: `A promocao e o processo de mover configuracoes de APIs (rotas, upstreams, plugins) de um ambiente para outro. O fluxo padrao segue a ordem:

**Desenvolvimento → Homologacao → Producao**

Etapas do fluxo:

- **Selecionar recursos** — escolha quais rotas, upstreams e plugins deseja promover. Voce pode selecionar recursos individualmente ou promover uma API completa de uma vez.
- **Revisar diferencias** — o sistema exibe um diff detalhado entre o ambiente de origem e o de destino, destacando o que sera adicionado, modificado ou removido.
- **Solicitar aprovacao** — dependendo das politicas da sua organizacao, a promocao pode exigir aprovacao de um ou mais revisores antes de ser aplicada.
- **Aplicar promocao** — apos aprovacao, as configuracoes sao replicadas no ambiente de destino via Admin API do gateway.

> **Nota:** A promocao nao move trafego — ela replica configuracoes. Seus backends de producao precisam estar prontos para receber as requisicoes configuradas.`,
        },
        {
          id: "visualizacao-diff",
          title: "Visualizacao de Diferencias (Diff)",
          body: `Antes de aplicar qualquer promocao, o FuseOne exibe uma comparacao lado a lado das configuracoes entre os dois ambientes. O visualizador de diff destaca:

- **Linhas adicionadas** (verde) — configuracoes que existem na origem mas nao no destino.
- **Linhas removidas** (vermelho) — configuracoes presentes no destino que serao substituidas ou removidas.
- **Linhas modificadas** (amarelo) — valores que diferem entre os ambientes.

O diff e gerado para cada tipo de recurso separadamente:

- Rotas (paths, metodos, plugins vinculados)
- Upstreams (nodes, algoritmo de balanceamento, health checks)
- Plugins (configuracoes de cada plugin aplicado)

> **Dica:** Revise o diff com atencao antes de promover para producao. Pequenas diferencas em configuracoes de plugins (como limites de rate limiting) podem ter grande impacto no trafego real.

Voce tambem pode exportar o diff como JSON para registro e auditoria.`,
        },
        {
          id: "aprovacao-e-revisao",
          title: "Fluxo de Aprovacao",
          body: `Para ambientes criticos como producao, o FuseOne oferece um fluxo de aprovacao integrado. Quando configurado, toda promocao precisa ser revisada e aprovada antes de ser aplicada.

Configurando o fluxo de aprovacao:

- Acesse **Configuracoes > Ambientes** e edite o ambiente de destino.
- Ative a opcao **Requer aprovacao para promocoes**.
- Defina os **aprovadores** — usuarios ou roles que podem aprovar solicitacoes.

Quando uma promocao e solicitada:

- O solicitante recebe um ID de acompanhamento.
- Os aprovadores sao notificados (via e-mail, Slack ou webhook, conforme configurado).
- O aprovador pode **aprovar**, **rejeitar** ou **solicitar alteracoes**.
- Apenas apos a aprovacao a promocao e efetivamente aplicada.

> **Nota:** O historico completo de aprovacoes fica registrado no audit log, incluindo quem solicitou, quem aprovou e quando a promocao foi aplicada.`,
        },
        {
          id: "rollback",
          title: "Rollback de Promocoes",
          body: `Caso uma promocao cause problemas, o FuseOne permite reverter rapidamente para o estado anterior. Cada promocao gera um snapshot automatico do ambiente de destino antes da aplicacao.

Para realizar um rollback:

- Acesse **Promocoes** no menu lateral e localize a promocao desejada.
- Clique em **Reverter** para restaurar o estado anterior do ambiente de destino.
- O sistema exibe um diff mostrando o que sera desfeito.
- Confirme o rollback para aplicar a reversao.

> **Atencao:** O rollback reverte todas as alteracoes da promocao de uma vez. Nao e possivel reverter parcialmente. Se precisar ajustar apenas um recurso especifico, edite-o manualmente no ambiente de destino.

Snapshots de promocao sao retidos por 30 dias por padrao. Esse periodo pode ser configurado em **Configuracoes > Sistema > Retencao de Dados**.`,
        },
      ],
    },
    {
      slug: "boas-praticas-ambientes",
      title: "Boas Praticas para Multi-Ambiente",
      description:
        "Convencoes de nomenclatura, estrategias de configuracao, segredos por ambiente e integracao CI/CD.",
      icon: "BookOpen",
      tags: ["boas-praticas", "ci-cd", "configuracao"],
      content: [
        {
          id: "convencoes-nomenclatura",
          title: "Convencoes de Nomenclatura",
          body: `Adotar uma nomenclatura consistente entre ambientes evita erros e facilita a automacao. Recomendacoes:

- Use nomes curtos e minusculos: \`dev\`, \`staging\`, \`prod\`.
- Prefixe recursos com o nome do ambiente quando necessario: \`dev-api-pagamentos\`, \`prod-api-pagamentos\`.
- Mantenha os mesmos nomes de rotas e upstreams em todos os ambientes — so mude os valores (endpoints, portas, chaves).
- Evite abreviacoes ambiguas. Prefira \`staging\` a \`stg\` ou \`hml\`.

> **Dica:** Documente suas convencoes de nomenclatura em um local acessivel a toda equipe. Isso reduz retrabalho e facilita a integracao de novos membros.

Nomes consistentes tambem facilitam scripts de automacao, ja que voce pode parametrizar o nome do ambiente em pipelines de CI/CD.`,
        },
        {
          id: "configuracao-por-ambiente",
          title: "Estrategias de Configuracao",
          body: `Cada ambiente pode exigir configuracoes diferentes. Algumas estrategias recomendadas:

- **Rate Limiting** — use limites mais permissivos em dev (ex: 1000 req/min) e mais restritivos em producao (ex: 100 req/min por consumidor).
- **Logging** — ative logs detalhados em dev e staging para depuracao. Em producao, mantenha apenas logs essenciais para performance.
- **Upstreams** — aponte para backends diferentes por ambiente. Dev pode usar \`localhost\` ou mocks, staging deve usar backends reais de homologacao.
- **Plugins** — teste novos plugins em dev antes de aplica-los em staging. Somente promova para producao apos validacao completa.

> **Nota:** O FuseOne preserva as configuracoes especificas de cada ambiente durante a promocao. Valores marcados como "especificos do ambiente" (como URLs de upstream) nao sao sobrescritos.

Mantenha um documento de referencia com as diferencas esperadas entre ambientes para facilitar revisoes de promocao.`,
        },
        {
          id: "segredos-por-ambiente",
          title: "Gerenciamento de Segredos",
          body: `Segredos como chaves de API, tokens de acesso e certificados TLS devem ser gerenciados de forma segura e isolada por ambiente.

Praticas recomendadas:

- **Nunca reutilize segredos entre ambientes.** Cada ambiente deve ter suas proprias chaves e certificados.
- **Nao versione segredos no codigo.** Use variaveis de ambiente ou um gerenciador de segredos (ex: HashiCorp Vault, AWS Secrets Manager).
- **Rotacione segredos periodicamente**, especialmente em producao.
- **Use permissoes restritas** — apenas administradores devem ter acesso para visualizar ou modificar segredos de producao.

> **Atencao:** O FuseOne nao exibe valores de chaves de API apos a criacao. Guarde os valores em um local seguro imediatamente apos gera-los.

No FuseOne, segredos sao armazenados de forma criptografada no banco de dados. A chave de encriptacao e configurada via variavel de ambiente \`ENCRYPTION_KEY\`.`,
        },
        {
          id: "integracao-ci-cd",
          title: "Integracao com CI/CD",
          body: `O FuseOne oferece uma API REST completa que permite integrar o fluxo de promocao com pipelines de CI/CD.

Exemplo de integracao com um pipeline:

\`\`\`
# 1. Exportar configuracao do ambiente dev
curl -X GET https://fuseone.internal/api/environments/dev/export \\
  -H "Authorization: Bearer $TOKEN" > config-dev.json

# 2. Criar solicitacao de promocao para staging
curl -X POST https://fuseone.internal/api/promotions \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{"source": "dev", "target": "staging", "resources": ["route:api-v2"]}'

# 3. Verificar status da promocao
curl -X GET https://fuseone.internal/api/promotions/{id}/status \\
  -H "Authorization: Bearer $TOKEN"
\`\`\`

Padroes comuns de integracao:

- **GitOps** — exporte as configuracoes do gateway para um repositorio Git e use promocoes automaticas baseadas em merges.
- **Pipeline de deploy** — inclua a etapa de promocao no pipeline apos o deploy do backend.
- **Aprovacao via chat** — configure webhooks para enviar solicitacoes de aprovacao para Slack ou Microsoft Teams.

> **Dica:** Use o endpoint \`/api/promotions\` com o parametro \`auto_approve=true\` para ambientes nao criticos (como dev → staging), agilizando o fluxo de deploy.`,
        },
      ],
    },
  ],
}
