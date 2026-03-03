export interface WsdlOperation {
  name: string
  inputMessage: string
  outputMessage: string
  requestTemplate: string
  responseTemplate: string
}

export interface WsdlParseResult {
  serviceName: string
  targetNamespace: string
  operations: WsdlOperation[]
}

/**
 * Lightweight WSDL parser using browser-native DOMParser.
 * Extracts operations and generates body-transformer templates.
 */
export function parseWsdl(wsdlXml: string): WsdlParseResult | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(wsdlXml, "text/xml")

    const errorNode = doc.querySelector("parsererror")
    if (errorNode) return null

    const definitions = doc.documentElement
    const targetNamespace =
      definitions.getAttribute("targetNamespace") || "http://example.com/service"

    // Extract service name
    const serviceEl =
      definitions.getElementsByTagNameNS("*", "service")[0]
    const serviceName =
      serviceEl?.getAttribute("name") || "UnknownService"

    // Extract operations from portType
    const portTypes = definitions.getElementsByTagNameNS("*", "portType")
    const operations: WsdlOperation[] = []

    for (let i = 0; i < portTypes.length; i++) {
      const portType = portTypes[i]
      const ops = portType.getElementsByTagNameNS("*", "operation")

      for (let j = 0; j < ops.length; j++) {
        const op = ops[j]
        const opName = op.getAttribute("name") || `Operation${j}`

        const inputEl = op.getElementsByTagNameNS("*", "input")[0]
        const outputEl = op.getElementsByTagNameNS("*", "output")[0]

        const inputMsg = stripPrefix(
          inputEl?.getAttribute("message") || "Request"
        )
        const outputMsg = stripPrefix(
          outputEl?.getAttribute("message") || "Response"
        )

        // Extract message parts to generate template fields
        const fields = extractMessageFields(doc, inputMsg)

        operations.push({
          name: opName,
          inputMessage: inputMsg,
          outputMessage: outputMsg,
          requestTemplate: generateRequestTemplate(
            opName,
            targetNamespace,
            fields
          ),
          responseTemplate: generateResponseTemplate(opName),
        })
      }
    }

    // Fallback: try binding operations if portType is empty
    if (operations.length === 0) {
      const bindings = definitions.getElementsByTagNameNS("*", "binding")
      for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i]
        const ops = binding.getElementsByTagNameNS("*", "operation")
        for (let j = 0; j < ops.length; j++) {
          const op = ops[j]
          const opName = op.getAttribute("name") || `Operation${j}`
          operations.push({
            name: opName,
            inputMessage: `${opName}Request`,
            outputMessage: `${opName}Response`,
            requestTemplate: generateRequestTemplate(opName, targetNamespace, []),
            responseTemplate: generateResponseTemplate(opName),
          })
        }
      }
    }

    return { serviceName, targetNamespace, operations }
  } catch {
    return null
  }
}

function stripPrefix(name: string): string {
  const idx = name.indexOf(":")
  return idx >= 0 ? name.substring(idx + 1) : name
}

function extractMessageFields(
  doc: Document,
  messageName: string
): string[] {
  const messages = doc.getElementsByTagNameNS("*", "message")
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.getAttribute("name") === messageName) {
      const parts = msg.getElementsByTagNameNS("*", "part")
      const fields: string[] = []
      for (let j = 0; j < parts.length; j++) {
        const name = parts[j].getAttribute("name")
        if (name) fields.push(name)
      }
      return fields
    }
  }
  return []
}

function generateRequestTemplate(
  operationName: string,
  namespace: string,
  fields: string[]
): string {
  const fieldLines =
    fields.length > 0
      ? fields
          .map((f) => `      <ns:${f}>{* _body.${f} or "" *}</ns:${f}>`)
          .join("\n")
      : `      {% for key, val in pairs(_body) do %}
      <ns:{* key *}>{* val *}</ns:{* key *}>
      {% end %}`

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="${namespace}">
  <soap:Body>
    <ns:${operationName}>
${fieldLines}
    </ns:${operationName}>
  </soap:Body>
</soap:Envelope>`
}

function generateResponseTemplate(operationName: string): string {
  return `{
  {% local env = _body["soap:Envelope"] or _body["S:Envelope"] %}
  {% local body = env and (env["soap:Body"] or env["S:Body"]) %}
  {% local resp = body and body["${operationName}Response"] %}
  {% if resp then %}
  "data": {* require("cjson").encode(resp) *}
  {% else %}
  "data": null
  {% end %}
}`
}
