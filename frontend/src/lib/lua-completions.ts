export interface LuaCompletion {
  label: string
  type: "function" | "variable" | "keyword" | "constant"
  detail: string
  info?: string
}

export const LUA_COMPLETIONS: LuaCompletion[] = [
  // ngx.req
  { label: "ngx.req.get_headers", type: "function", detail: "Get request headers table", info: "Returns a Lua table with all current request headers" },
  { label: "ngx.req.set_header", type: "function", detail: "Set a request header", info: "ngx.req.set_header(name, value)" },
  { label: "ngx.req.clear_header", type: "function", detail: "Remove a request header", info: "ngx.req.clear_header(name)" },
  { label: "ngx.req.get_body_data", type: "function", detail: "Get request body as string" },
  { label: "ngx.req.set_body_data", type: "function", detail: "Set request body string", info: "ngx.req.set_body_data(data)" },
  { label: "ngx.req.read_body", type: "function", detail: "Read the client request body" },
  { label: "ngx.req.get_method", type: "function", detail: "Get HTTP method string" },
  { label: "ngx.req.set_method", type: "function", detail: "Set HTTP method", info: "ngx.req.set_method(ngx.HTTP_POST)" },
  { label: "ngx.req.get_uri_args", type: "function", detail: "Get query string parameters table" },
  { label: "ngx.req.set_uri_args", type: "function", detail: "Set query string parameters" },
  { label: "ngx.req.get_post_args", type: "function", detail: "Get POST parameters table" },

  // ngx response
  { label: "ngx.say", type: "function", detail: "Send response body to client", info: "ngx.say(data) — sends data and appends newline" },
  { label: "ngx.print", type: "function", detail: "Send response body (no newline)" },
  { label: "ngx.exit", type: "function", detail: "Finish processing with status code", info: "ngx.exit(ngx.HTTP_OK)" },
  { label: "ngx.redirect", type: "function", detail: "Issue an HTTP redirect", info: "ngx.redirect(url, status)" },
  { label: "ngx.header", type: "variable", detail: "Response header table", info: "ngx.header['X-Custom'] = 'value'" },
  { label: "ngx.status", type: "variable", detail: "Response status code", info: "ngx.status = 200" },

  // ngx.var
  { label: "ngx.var.uri", type: "variable", detail: "Current request URI (without args)" },
  { label: "ngx.var.request_uri", type: "variable", detail: "Full request URI (with args)" },
  { label: "ngx.var.args", type: "variable", detail: "Query string" },
  { label: "ngx.var.host", type: "variable", detail: "Request Host header" },
  { label: "ngx.var.remote_addr", type: "variable", detail: "Client IP address" },
  { label: "ngx.var.request_method", type: "variable", detail: "HTTP method" },
  { label: "ngx.var.scheme", type: "variable", detail: "Request scheme (http/https)" },
  { label: "ngx.var.server_port", type: "variable", detail: "Server port" },
  { label: "ngx.var.content_type", type: "variable", detail: "Content-Type header" },
  { label: "ngx.var.content_length", type: "variable", detail: "Content-Length header" },
  { label: "ngx.var.http_authorization", type: "variable", detail: "Authorization header" },
  { label: "ngx.var.http_user_agent", type: "variable", detail: "User-Agent header" },
  { label: "ngx.var.upstream_status", type: "variable", detail: "Upstream response status" },
  { label: "ngx.var.upstream_response_time", type: "variable", detail: "Upstream response time" },

  // ngx logging
  { label: "ngx.log", type: "function", detail: "Write to error log", info: "ngx.log(ngx.WARN, 'message')" },
  { label: "ngx.ERR", type: "constant", detail: "Error log level" },
  { label: "ngx.WARN", type: "constant", detail: "Warning log level" },
  { label: "ngx.INFO", type: "constant", detail: "Info log level" },
  { label: "ngx.DEBUG", type: "constant", detail: "Debug log level" },

  // ngx HTTP status constants
  { label: "ngx.HTTP_OK", type: "constant", detail: "200" },
  { label: "ngx.HTTP_CREATED", type: "constant", detail: "201" },
  { label: "ngx.HTTP_BAD_REQUEST", type: "constant", detail: "400" },
  { label: "ngx.HTTP_UNAUTHORIZED", type: "constant", detail: "401" },
  { label: "ngx.HTTP_FORBIDDEN", type: "constant", detail: "403" },
  { label: "ngx.HTTP_NOT_FOUND", type: "constant", detail: "404" },
  { label: "ngx.HTTP_INTERNAL_SERVER_ERROR", type: "constant", detail: "500" },
  { label: "ngx.HTTP_SERVICE_UNAVAILABLE", type: "constant", detail: "503" },

  // ngx utilities
  { label: "ngx.encode_base64", type: "function", detail: "Base64 encode a string" },
  { label: "ngx.decode_base64", type: "function", detail: "Base64 decode a string" },
  { label: "ngx.escape_uri", type: "function", detail: "URI-encode a string" },
  { label: "ngx.unescape_uri", type: "function", detail: "URI-decode a string" },
  { label: "ngx.md5", type: "function", detail: "MD5 hash of a string" },
  { label: "ngx.sha1_bin", type: "function", detail: "SHA-1 hash (binary)" },
  { label: "ngx.now", type: "function", detail: "Current time (seconds, float)" },
  { label: "ngx.time", type: "function", detail: "Current time (seconds, integer)" },
  { label: "ngx.sleep", type: "function", detail: "Non-blocking sleep", info: "ngx.sleep(seconds)" },

  // ngx.re (regex)
  { label: "ngx.re.match", type: "function", detail: "Regex match", info: "ngx.re.match(subject, regex, 'jo')" },
  { label: "ngx.re.find", type: "function", detail: "Regex find (returns indices)" },
  { label: "ngx.re.gmatch", type: "function", detail: "Global regex match iterator" },
  { label: "ngx.re.sub", type: "function", detail: "Regex substitution" },
  { label: "ngx.re.gsub", type: "function", detail: "Global regex substitution" },

  // APISIX core
  { label: "core.request.get_ip", type: "function", detail: "Get real client IP", info: "local ip = core.request.get_ip(ctx)" },
  { label: "core.request.get_host", type: "function", detail: "Get request host" },
  { label: "core.request.get_scheme", type: "function", detail: "Get request scheme" },
  { label: "core.request.header", type: "function", detail: "Get a request header", info: "core.request.header(ctx, 'X-Custom')" },
  { label: "core.response.exit", type: "function", detail: "Send JSON response and exit", info: "core.response.exit(200, {msg='ok'})" },
  { label: "core.response.set_header", type: "function", detail: "Set a response header" },
  { label: "core.json.encode", type: "function", detail: "Encode table to JSON string" },
  { label: "core.json.decode", type: "function", detail: "Decode JSON string to table" },
  { label: "core.log.warn", type: "function", detail: "Log warning message" },
  { label: "core.log.error", type: "function", detail: "Log error message" },
  { label: "core.log.info", type: "function", detail: "Log info message" },

  // Lua keywords
  { label: "local", type: "keyword", detail: "Declare local variable" },
  { label: "function", type: "keyword", detail: "Define function" },
  { label: "return", type: "keyword", detail: "Return from function" },
  { label: "if", type: "keyword", detail: "Conditional" },
  { label: "then", type: "keyword", detail: "After condition" },
  { label: "else", type: "keyword", detail: "Alternative branch" },
  { label: "elseif", type: "keyword", detail: "Alternative conditional" },
  { label: "end", type: "keyword", detail: "Close block" },
  { label: "for", type: "keyword", detail: "Loop" },
  { label: "while", type: "keyword", detail: "While loop" },
  { label: "do", type: "keyword", detail: "Begin block" },
  { label: "repeat", type: "keyword", detail: "Repeat-until loop" },
  { label: "until", type: "keyword", detail: "Repeat-until condition" },
  { label: "not", type: "keyword", detail: "Logical not" },
  { label: "and", type: "keyword", detail: "Logical and" },
  { label: "or", type: "keyword", detail: "Logical or" },
  { label: "nil", type: "constant", detail: "Null value" },
  { label: "true", type: "constant", detail: "Boolean true" },
  { label: "false", type: "constant", detail: "Boolean false" },

  // Common Lua stdlib
  { label: "string.format", type: "function", detail: "Format a string", info: "string.format('%s=%d', key, val)" },
  { label: "string.find", type: "function", detail: "Find pattern in string" },
  { label: "string.sub", type: "function", detail: "Extract substring" },
  { label: "string.lower", type: "function", detail: "Convert to lowercase" },
  { label: "string.upper", type: "function", detail: "Convert to uppercase" },
  { label: "string.len", type: "function", detail: "Get string length" },
  { label: "string.match", type: "function", detail: "Pattern match" },
  { label: "string.gmatch", type: "function", detail: "Global pattern match iterator" },
  { label: "string.gsub", type: "function", detail: "Global substitution" },
  { label: "table.insert", type: "function", detail: "Insert element into table" },
  { label: "table.remove", type: "function", detail: "Remove element from table" },
  { label: "table.concat", type: "function", detail: "Concatenate table elements" },
  { label: "table.sort", type: "function", detail: "Sort table in-place" },
  { label: "tostring", type: "function", detail: "Convert to string" },
  { label: "tonumber", type: "function", detail: "Convert to number" },
  { label: "type", type: "function", detail: "Get type of value" },
  { label: "pairs", type: "function", detail: "Iterate table key-value pairs" },
  { label: "ipairs", type: "function", detail: "Iterate array numerically" },
  { label: "pcall", type: "function", detail: "Protected call (catch errors)", info: "local ok, err = pcall(fn, args)" },
  { label: "xpcall", type: "function", detail: "Protected call with error handler" },
  { label: "error", type: "function", detail: "Raise an error" },
  { label: "require", type: "function", detail: "Load a module" },
  { label: "unpack", type: "function", detail: "Unpack table to values" },
  { label: "select", type: "function", detail: "Select from varargs" },
]
