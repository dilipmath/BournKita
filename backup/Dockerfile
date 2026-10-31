# The backup service: dumps the database and copies the photos to the second drive every night,
# and writes an encrypted copy for off-site every week. Its scripts also restore.
FROM postgres:17-alpine
RUN apk add --no-cache age rsync tzdata
COPY start nightly weekly restore restore-offsite restore-from /usr/local/bin/
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/start /usr/local/bin/nightly /usr/local/bin/weekly /usr/local/bin/restore /usr/local/bin/restore-offsite /usr/local/bin/restore-from
ENV TZ=Europe/Berlin
# Checks the settings, then runs Busybox cron in the foreground; the jobs log to its output.
CMD ["start"]
