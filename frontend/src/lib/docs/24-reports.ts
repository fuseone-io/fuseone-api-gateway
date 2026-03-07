import type { DocCategory } from "./types"

export const reportsCategory: DocCategory = {
  slug: "reports",
  title: "Relatórios",
  description:
    "Exporte dados de uso, métricas e analytics como arquivos CSV para análise externa.",
  icon: "FileBarChart",
  articles: [
    {
      slug: "visao-geral-relatorios",
      title: "Visão Geral de Relatórios",
      description:
        "Entenda os tipos de relatórios disponíveis e como exportar dados do API Gateway.",
      icon: "FileBarChart",
      tags: ["relatórios", "exportação", "csv", "métricas", "overview"],
      content: [
        {
          id: "o-que-sao",
          title: "O que são Relatórios",
          body: `A seção de Relatórios permite exportar dados de uso e métricas do API Gateway em formato CSV para análise externa em ferramentas como Excel, Google Sheets, Power BI ou scripts de automação.

**Relatórios disponíveis:**

| Relatório | Descrição | Dados incluídos |
|-----------|-----------|-----------------|
| **Uso de APIs** | Volume de requisições por API | Requisições, erros, latência por rota |
| **Consumo por Aplicação** | Uso detalhado por consumidor | Requisições, bandwidth, erros por consumer |
| **Status Codes** | Distribuição de códigos HTTP | Contagem por status code e API |
| **Latência** | Tempos de resposta | P50, P95, P99 por rota e período |
| **Erros** | Análise de falhas | Erros 4xx/5xx detalhados por API |
| **Upstream Health** | Saúde dos backends | Status dos nós, falhas, recuperações |

Cada relatório pode ser filtrado por **período** (últimas 24h, 7 dias, 30 dias ou intervalo customizado) e **APIs específicas**.`,
        },
        {
          id: "como-exportar",
          title: "Como Exportar",
          body: `Para gerar um relatório:

1. Acesse **Relatórios** no menu lateral
2. Selecione o **tipo de relatório** desejado
3. Configure os **filtros**:
   - Período de tempo
   - APIs específicas (opcional)
   - Aplicações específicas (opcional)
4. Clique em **Exportar CSV**
5. O arquivo será baixado automaticamente

**Formato do CSV:**

Os arquivos CSV usam:
- Separador: vírgula (\`,\`)
- Encoding: UTF-8 com BOM (compatível com Excel)
- Timestamps: formato ISO 8601 (\`2024-01-15T10:30:00Z\`)
- Números decimais: ponto como separador (\`1.234\`)

**Exemplo de saída (Uso de APIs):**

\`\`\`csv
api_name,route_id,requests,errors_4xx,errors_5xx,avg_latency_ms,p99_latency_ms
Produtos API,route-001,15234,120,8,45.2,312.5
Usuários API,route-002,8921,56,2,32.1,198.7
\`\`\``,
        },
        {
          id: "casos-de-uso",
          title: "Casos de Uso",
          body: `**Faturamento e chargeback:**
- Exporte o relatório de "Consumo por Aplicação" mensal
- Use os dados para cobrar parceiros pelo uso da API
- Automatize com scripts que consomem a API de relatórios

**Compliance e auditoria:**
- Gere relatórios periódicos de uso para auditorias
- Combine com dados do log de auditoria para rastreabilidade completa
- Mantenha histórico de relatórios para referência futura

**Análise de performance:**
- Identifique APIs com latência elevada via relatório de latência
- Detecte tendências de crescimento no uso
- Compare performance entre períodos (semana vs semana, mês vs mês)

**Diagnóstico de problemas:**
- Use o relatório de erros para identificar APIs problemáticas
- Correlacione picos de erros com eventos de infraestrutura
- Analise distribuição de status codes para entender padrões de falha

**Capacidade:**
- Projete crescimento baseado em tendências históricas
- Identifique aplicações que precisam de upgrade de plano
- Planeje escalabilidade de backends baseado em dados reais`,
        },
      ],
    },
  ],
}
