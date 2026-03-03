export interface SoapTemplate {
  id: string
  name: string
  description: string
  requestTemplate: string
  responseTemplate: string
  sampleInput: string
  sampleNamespace?: string
}

export const SOAP_TEMPLATES: SoapTemplate[] = [
  {
    id: "soap11-basic",
    name: "SOAP 1.1 Basic Envelope",
    description: "Standard SOAP 1.1 envelope that wraps JSON body fields as XML elements",
    requestTemplate: `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    <Request xmlns="http://example.com/service">
      {% for key, val in pairs(_body) do %}
      <{* key *}>{* val *}</{* key *}>
      {% end %}
    </Request>
  </soap:Body>
</soap:Envelope>`,
    responseTemplate: `{
  {% local body = _body["soap:Envelope"]["soap:Body"] %}
  {% if body then %}
  "result": {* require("cjson").encode(body) *}
  {% end %}
}`,
    sampleInput: `{"name": "John", "email": "john@example.com"}`,
  },
  {
    id: "soap12-basic",
    name: "SOAP 1.2 Basic Envelope",
    description: "Standard SOAP 1.2 envelope with updated namespace",
    requestTemplate: `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header/>
  <soap:Body>
    <Request xmlns="http://example.com/service">
      {% for key, val in pairs(_body) do %}
      <{* key *}>{* val *}</{* key *}>
      {% end %}
    </Request>
  </soap:Body>
</soap:Envelope>`,
    responseTemplate: `{
  {% local body = _body["soap:Envelope"]["soap:Body"] %}
  {% if body then %}
  "result": {* require("cjson").encode(body) *}
  {% end %}
}`,
    sampleInput: `{"action": "GetUser", "id": "123"}`,
  },
  {
    id: "soap11-wssecurity",
    name: "SOAP 1.1 with WS-Security",
    description: "SOAP envelope with WS-Security UsernameToken header for authentication",
    requestTemplate: `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soap:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>{* _body._auth_user or "admin" *}</wsse:Username>
        <wsse:Password>{* _body._auth_pass or "" *}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <Request xmlns="http://example.com/service">
      {% for key, val in pairs(_body) do %}
      {% if not string.find(key, "^_auth") then %}
      <{* key *}>{* val *}</{* key *}>
      {% end %}
      {% end %}
    </Request>
  </soap:Body>
</soap:Envelope>`,
    responseTemplate: `{
  {% local body = _body["soap:Envelope"]["soap:Body"] %}
  {% if body then %}
  "result": {* require("cjson").encode(body) *}
  {% end %}
}`,
    sampleInput: `{"_auth_user": "admin", "_auth_pass": "secret", "action": "GetData", "id": "456"}`,
  },
  {
    id: "soap11-operation",
    name: "SOAP Operation Wrapper",
    description: "Wraps JSON request as a named SOAP operation with typed parameters",
    requestTemplate: `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="http://example.com/service">
  <soap:Body>
    <ns:{* _body._operation or "DoAction" *}>
      {% for key, val in pairs(_body) do %}
      {% if key ~= "_operation" then %}
      <ns:{* key *}>{* val *}</ns:{* key *}>
      {% end %}
      {% end %}
    </ns:{* _body._operation or "DoAction" *}>
  </soap:Body>
</soap:Envelope>`,
    responseTemplate: `{
  {% local env = _body["soap:Envelope"] or _body["S:Envelope"] %}
  {% local body = env and (env["soap:Body"] or env["S:Body"]) %}
  {% if body then %}
  "data": {* require("cjson").encode(body) *}
  {% else %}
  "data": null
  {% end %}
}`,
    sampleInput: `{"_operation": "GetCustomer", "customerId": "C-001", "includeOrders": "true"}`,
  },
  {
    id: "json-to-xml-flat",
    name: "JSON to XML (Flat)",
    description: "Simple JSON-to-XML conversion without SOAP envelope for REST-to-XML backends",
    requestTemplate: `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  {% for key, val in pairs(_body) do %}
  <{* key *}>{* val *}</{* key *}>
  {% end %}
</Request>`,
    responseTemplate: `{
  {% if _body and _body.Response then %}
  {% for key, val in pairs(_body.Response) do %}
  "{* key *}": {* type(val) == "table" and require("cjson").encode(val) or '"' .. tostring(val) .. '"' *}{% if next(_body.Response, key) then %},{% end %}
  {% end %}
  {% end %}
}`,
    sampleInput: `{"name": "Test Product", "price": "29.99", "category": "electronics"}`,
  },
]
