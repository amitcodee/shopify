# Postgres with the platform's role setup baked in (for hosts that cannot bind-mount files from
# the repository, e.g. Coolify). Same script as docker-compose.prod.yml mounts.
FROM postgres:18
COPY deploy/postgres-init.sh /docker-entrypoint-initdb.d/10-roles.sh
RUN chmod 0755 /docker-entrypoint-initdb.d/10-roles.sh
