#!/bin/sh
# Fly mounts the volume as root-owned by default. Make sure the directories
# exist and are owned by the app user before we drop privileges.
set -e

mkdir -p /data/uploads
chown -R nextjs:nodejs /data

# Drop root and run the Node server.
exec gosu nextjs:nodejs "$@"
