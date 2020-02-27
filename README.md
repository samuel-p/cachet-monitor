# [cachet-monitor](https://git.sp-codes.de/samuel-p/cachet-monitor)

[![Build Status](https://ci.sp-codes.de/api/badges/samuel-p/cachet-monitor/status.svg)](https://ci.sp-codes.de/samuel-p/cachet-monitor) ![Docker Pulls](https://img.shields.io/docker/pulls/samuelph/cachet-monitor)

Simple monitor to watch URLs (`HTTP`) or ports (`TCP`, `UDP`) and update [Cachet](https://cachethq.io/) status.

## Configuration

cachet-monitor can monitor a list of services. Therefore it requires to setup all services in `./data/config.json`. __The id of each service has to match the cachet component id you want to update!__ You also can specify a custom timeout in seconds for each service.

You also need to specify the interval (`cron`) your services should be checked. You can use the cron syntax from [`node-cron`](https://www.npmjs.com/package/node-cron). You also have to set `offlineTimeUntilMajor` which is the offline time in seconds until the state of an offline service turns from partial to major outage. Finally you need to provide the information to your cachet instance (`api` and `token`).

Example:

```json
{
	"services": [
		{
			"id": 1,
			"type": "HTTP",
			"url": "https://sp-codes.de",
			"timeout": 60
		},
		{
			"id": 2,
			"type": "TCP",
			"host": "sp-codes.de",
			"port": 443,
			"timeout": 60
		}
	],
	"cron": "0 * * * * *",
	"offlineTimeUntilMajor": 300,
	"api": "https://<cachet-url>/api/v1",
	"token": "<user-token>"
}
```

## Run with docker

You can use the docker image [`samuelph/cachet-monitor`](https://hub.docker.com/r/samuelph/cachet-monitor) and mount a volume to `/monitor/data` to persist cache and config:

```bash
docker run -v /your/path/monitor/data:/monitor/data samuelph/cachet-monitor
```

You also can use it in `docker-compose.yml`:

```yaml
services:
  monitor:
    image: samuelph/cachet-monitor
    restart: always
    volumes:
      - /your/path/monitor:/monitor/data
```

## Run from source

1. clone the repo

   ```bash
   git clone https://git.sp-codes.de/samuel-p/cachet-monitor.git
   ```

2. install dependencies

   ```bash
   npm install
   ```

3. run

   ```bash
   npm run start
   ```