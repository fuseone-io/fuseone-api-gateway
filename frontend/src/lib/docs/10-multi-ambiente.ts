import type { DocCategory } from "./types"

export const multiAmbienteCategory: DocCategory = {
  slug: "multi-ambiente",
  title: "Multi-Ambiente",
  description:
    "Gerencie ambientes isolados (dev, staging, produção) e promova APIs entre eles com segurança.",
  icon: "Layers",
  articles: [
    {
      slug: "ambientes",
      title: "Gerenciando Ambientes",
      description:
        "Entenda o conceito de ambientes, como criar e configurar cada um deles e alternar entre eles no dashboard.",
      icon: "Layers",
      tags: ["ambientes", "dev", "staging", "produção"],
      content: [
        {
          id: "o-que-sao-ambientes",
          title: "O que são Ambientes",
          body: `Ambientes representam instâncias isoladas do API Gateway, cada uma com suas próprias rotas, upstreams, plugins e configurações. O FuseOne API Gateway permite criar quantos ambientes forem necessários, mas a maioria das organizações trabalha com três:

- **Desenvolvimento (dev)** — usado pelas equipes de engenharia para testes rápidos e iterações. Geralmente conectado a backends locais ou de sandbox.
- **Homologação (staging)** — réplica fiel do ambiente de produção, utilizado para testes de integração e validação antes do deploy final.
- **Produção (prod)** — ambiente real que recebe tráfego de clientes. Possui políticas mais restritivas de segurança e rate limiting.

> **Nota:** Cada ambiente aponta para uma instância separada do API Gateway (e seu respectivo etcd). Isso garante isolamento total entre os ambientes.

A separação em ambientes permite que você desenvolva e teste novas configurações sem risco de impactar usuários finais.`,
        },
        {
          id: "criando-ambientes",
          title: "Criando e Configurando Ambientes",
          body: `Para criar um novo ambiente, acesse **Configurações > Ambientes** e clique em **Novo Ambiente**. Preencha os seguintes campos:

- **Nome** — identificador único do ambiente (ex: \`dev\`, \`staging\`, \`prod\`).
- **Descrição** — breve descrição do propósito do ambiente.
- **URL do Admin API** — endereço da Admin API do API Gateway deste ambiente (ex: \`https://apisix-dev.internal:9180\`).
- **Chave de API** — chave de autenticação para a Admin API do gateway.
- **Cor do Badge** — cor visual para identificar rapidamente o ambiente no dashboard.

> **Dica:** Use nomes curtos e padronizados para os ambientes. Isso facilita a automação via CI/CD e scripts de promoção.

Após salvar, o ambiente aparece na lista e pode ser selecionado pelo seletor de ambientes no topo do dashboard. Todas as operações (criação de rotas, upstreams, plugins) passam a atuar no ambiente selecionado.

\`\`\`
POST /api/environments
{
  "name": "staging",
  "description": "Ambiente de homologação",
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
- O dashboard recarrega automaticamente todos os dados (rotas, upstreams, plugins, métricas) do novo ambiente.
- Um badge colorido permanece visível em todas as páginas para que você sempre saiba em qual ambiente está trabalhando.

> **Atenção:** Todas as ações realizadas no dashboard (criar, editar, excluir recursos) afetam **somente** o ambiente selecionado. Verifique sempre o badge do ambiente antes de fazer alterações em produção.

O estado do ambiente selecionado é persistido na sessão do usuário. Ao fazer login novamente, o último ambiente utilizado será restaurado automaticamente.`,
        },
        {
          id: "conexao-gateway",
          title: "Conexão com o Gateway por Ambiente",
          body: `Cada ambiente mantém sua própria conexão com uma instância do API Gateway. O FuseOne utiliza a Admin API do gateway para sincronizar recursos.

Detalhes da conexão:

- **Health Check** — o sistema verifica periodicamente a disponibilidade da Admin API de cada ambiente. O status aparece como um indicador verde/vermelho na lista de ambientes.
- **Timeout** — o timeout padrão para requisições à Admin API é de 10 segundos, configurável por ambiente.
- **TLS** — conexões HTTPS são recomendadas para todos os ambientes, especialmente produção.

Para testar a conexão manualmente, acesse **Configurações > Ambientes**, selecione o ambiente desejado e clique em **Testar Conexão**. O sistema tentará se conectar à Admin API e retornará o status da instância do gateway.

> **Dica:** Em ambientes de desenvolvimento local, você pode usar \`http://localhost:9180\` como URL da Admin API, mas nunca utilize HTTP em ambientes de staging ou produção.`,
        },
      ],
    },
    {
      slug: "promocoes",
      title: "Promoção de APIs entre Ambientes",
      description:
        "Aprenda o fluxo de promoção de configurações entre ambientes, visualização de diffs e aprovação.",
      icon: "ArrowUpCircle",
      tags: ["promoção", "deploy", "diff", "aprovação"],
      content: [
        {
          id: "fluxo-de-promocao",
          title: "Fluxo de Promoção",
          body: `A promoção é o processo de mover configurações de APIs (rotas, upstreams, plugins) de um ambiente para outro. O fluxo padrão segue a ordem:

**Desenvolvimento → Homologação → Produção**

Etapas do fluxo:

- **Selecionar recursos** — escolha quais rotas, upstreams e plugins deseja promover. Você pode selecionar recursos individualmente ou promover uma API completa de uma vez.
- **Revisar diferenças** — o sistema exibe um diff detalhado entre o ambiente de origem e o de destino, destacando o que será adicionado, modificado ou removido.
- **Solicitar aprovação** — dependendo das políticas da sua organização, a promoção pode exigir aprovação de um ou mais revisores antes de ser aplicada.
- **Aplicar promoção** — após aprovação, as configurações são replicadas no ambiente de destino via Admin API do gateway.

> **Nota:** A promoção não move tráfego — ela replica configurações. Seus backends de produção precisam estar prontos para receber as requisições configuradas.`,
        },
        {
          id: "visualizacao-diff",
          title: "Visualização de Diferenças (Diff)",
          body: `Antes de aplicar qualquer promoção, o FuseOne exibe uma comparação lado a lado das configurações entre os dois ambientes. O visualizador de diff destaca:

- **Linhas adicionadas** (verde) — configurações que existem na origem mas não no destino.
- **Linhas removidas** (vermelho) — configurações presentes no destino que serão substituídas ou removidas.
- **Linhas modificadas** (amarelo) — valores que diferem entre os ambientes.

O diff é gerado para cada tipo de recurso separadamente:

- Rotas (paths, métodos, plugins vinculados)
- Upstreams (nodes, algoritmo de balanceamento, health checks)
- Plugins (configurações de cada plugin aplicado)

> **Dica:** Revise o diff com atenção antes de promover para produção. Pequenas diferenças em configurações de plugins (como limites de rate limiting) podem ter grande impacto no tráfego real.

Você também pode exportar o diff como JSON para registro e auditoria.`,
        },
        {
          id: "aprovacao-e-revisao",
          title: "Fluxo de Aprovação",
          body: `Para ambientes críticos como produção, o FuseOne oferece um fluxo de aprovação integrado. Quando configurado, toda promoção precisa ser revisada e aprovada antes de ser aplicada.

Configurando o fluxo de aprovação:

- Acesse **Configurações > Ambientes** e edite o ambiente de destino.
- Ative a opção **Requer aprovação para promoções**.
- Defina os **aprovadores** — usuários ou roles que podem aprovar solicitações.

Quando uma promoção é solicitada:

- O solicitante recebe um ID de acompanhamento.
- Os aprovadores são notificados (via e-mail, Slack ou webhook, conforme configurado).
- O aprovador pode **aprovar**, **rejeitar** ou **solicitar alterações**.
- Apenas após a aprovação a promoção é efetivamente aplicada.

> **Nota:** O histórico completo de aprovações fica registrado no audit log, incluindo quem solicitou, quem aprovou e quando a promoção foi aplicada.`,
        },
        {
          id: "rollback",
          title: "Rollback de Promoções",
          body: `Caso uma promoção cause problemas, o FuseOne permite reverter rapidamente para o estado anterior. Cada promoção gera um snapshot automático do ambiente de destino antes da aplicação.

Para realizar um rollback:

- Acesse **Promoções** no menu lateral e localize a promoção desejada.
- Clique em **Reverter** para restaurar o estado anterior do ambiente de destino.
- O sistema exibe um diff mostrando o que será desfeito.
- Confirme o rollback para aplicar a reversão.

> **Atenção:** O rollback reverte todas as alterações da promoção de uma vez. Não é possível reverter parcialmente. Se precisar ajustar apenas um recurso específico, edite-o manualmente no ambiente de destino.

Snapshots de promoção são retidos por 30 dias por padrão. Esse período pode ser configurado em **Configurações > Sistema > Retenção de Dados**.`,
        },
      ],
    },
    {
      slug: "boas-praticas-ambientes",
      title: "Boas Práticas para Multi-Ambiente",
      description:
        "Convenções de nomenclatura, estratégias de configuração, segredos por ambiente e integração CI/CD.",
      icon: "BookOpen",
      tags: ["boas-práticas", "ci-cd", "configuração"],
      content: [
        {
          id: "convencoes-nomenclatura",
          title: "Convenções de Nomenclatura",
          body: `Adotar uma nomenclatura consistente entre ambientes evita erros e facilita a automação. Recomendações:

- Use nomes curtos e minúsculos: \`dev\`, \`staging\`, \`prod\`.
- Prefixe recursos com o nome do ambiente quando necessário: \`dev-api-pagamentos\`, \`prod-api-pagamentos\`.
- Mantenha os mesmos nomes de rotas e upstreams em todos os ambientes — só mude os valores (endpoints, portas, chaves).
- Evite abreviações ambíguas. Prefira \`staging\` a \`stg\` ou \`hml\`.

> **Dica:** Documente suas convenções de nomenclatura em um local acessível a toda equipe. Isso reduz retrabalho e facilita a integração de novos membros.

Nomes consistentes também facilitam scripts de automação, já que você pode parametrizar o nome do ambiente em pipelines de CI/CD.`,
        },
        {
          id: "configuracao-por-ambiente",
          title: "Estratégias de Configuração",
          body: `Cada ambiente pode exigir configurações diferentes. Algumas estratégias recomendadas:

- **Rate Limiting** — use limites mais permissivos em dev (ex: 1000 req/min) e mais restritivos em produção (ex: 100 req/min por consumidor).
- **Logging** — ative logs detalhados em dev e staging para depuração. Em produção, mantenha apenas logs essenciais para performance.
- **Upstreams** — aponte para backends diferentes por ambiente. Dev pode usar \`localhost\` ou mocks, staging deve usar backends reais de homologação.
- **Plugins** — teste novos plugins em dev antes de aplicá-los em staging. Somente promova para produção após validação completa.

> **Nota:** O FuseOne preserva as configurações específicas de cada ambiente durante a promoção. Valores marcados como "específicos do ambiente" (como URLs de upstream) não são sobrescritos.

Mantenha um documento de referência com as diferenças esperadas entre ambientes para facilitar revisões de promoção.`,
        },
        {
          id: "segredos-por-ambiente",
          title: "Gerenciamento de Segredos",
          body: `Segredos como chaves de API, tokens de acesso e certificados TLS devem ser gerenciados de forma segura e isolada por ambiente.

Práticas recomendadas:

- **Nunca reutilize segredos entre ambientes.** Cada ambiente deve ter suas próprias chaves e certificados.
- **Não versione segredos no código.** Use variáveis de ambiente ou um gerenciador de segredos (ex: HashiCorp Vault, AWS Secrets Manager).
- **Rotacione segredos periodicamente**, especialmente em produção.
- **Use permissões restritas** — apenas administradores devem ter acesso para visualizar ou modificar segredos de produção.

> **Atenção:** O FuseOne não exibe valores de chaves de API após a criação. Guarde os valores em um local seguro imediatamente após gerá-los.

No FuseOne, segredos são armazenados de forma criptografada no banco de dados. A chave de encriptação é configurada via variável de ambiente \`ENCRYPTION_KEY\`.`,
        },
        {
          id: "integracao-ci-cd",
          title: "Integração com CI/CD",
          body: `O FuseOne oferece uma API REST completa que permite integrar o fluxo de promoção com pipelines de CI/CD.

Exemplo de integração com um pipeline:

\`\`\`
# 1. Exportar configuração do ambiente dev
curl -X GET https://fuseone.internal/api/environments/dev/export \\
  -H "Authorization: Bearer $TOKEN" > config-dev.json

# 2. Criar solicitação de promoção para staging
curl -X POST https://fuseone.internal/api/promotions \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{"source": "dev", "target": "staging", "resources": ["route:api-v2"]}'

# 3. Verificar status da promoção
curl -X GET https://fuseone.internal/api/promotions/{id}/status \\
  -H "Authorization: Bearer $TOKEN"
\`\`\`

Padrões comuns de integração:

- **GitOps** — exporte as configurações do gateway para um repositório Git e use promoções automáticas baseadas em merges.
- **Pipeline de deploy** — inclua a etapa de promoção no pipeline após o deploy do backend.
- **Aprovação via chat** — configure webhooks para enviar solicitações de aprovação para Slack ou Microsoft Teams.

> **Dica:** Use o endpoint \`/api/promotions\` com o parâmetro \`auto_approve=true\` para ambientes não críticos (como dev → staging), agilizando o fluxo de deploy.`,
        },
      ],
    },
  ],
}
