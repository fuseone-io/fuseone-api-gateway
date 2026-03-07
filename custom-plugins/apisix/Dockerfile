FROM apache/apisix:3.15.0-debian

# Copy all FuseOne custom Lua plugins into the extra_lua_path directory
# (extra_lua_path = "/opt/custom-plugins/?.lua" in apisix-config.yaml)
COPY plugins/ /opt/custom-plugins/apisix/plugins/
