# [cachet-monitor](https://git.sp-codes.de/samuel-p/cachet-monitor)

[![Build Status](https://ci.sp-codes.de/api/badges/samuel-p/cachet-monitor/status.svg)](https://ci.sp-codes.de/samuel-p/cachet-monitor) [![License](https://img.shields.io/badge/license-GPL--3.0-orange)](#license) [![Docker Pulls](https://img.shields.io/docker/pulls/samuelph/cachet-monitor)](https://hub.docker.com/r/samuelph/cachet-monitor)

Simple monitor to watch URLs (`HTTP`) or ports (`TCP`, `UDP`) and update [Cachet](https://cachethq.io/) status.

## Configuration

cachet-monitor can monitor a list of services. Therefore it requires to setup all services in `./data/config.json`. __The id of each service has to match the cachet component id you want to update!__ Each service needs the following attributes (additionally to `id` and `type`):

* type `HTTP`
  * `url`
* type `TCP` or `UDP`
  * `host`
  * `port`

Optionally you can add the following options to each service, or change the default values globally:

* `retry` - number how often the check should be retried if the service is offline (default value `0`)
* `waitUntilRetry` - number of seconds the retry should be delayed (default value `5`)
* `performanceTimeout` - time in seconds in which the request has to be completed, otherwise the status will be `SLOW` (Cachet `Performance Issues`) (default value `1`)
* `requestTimeout` - time in seconds in which the request has to be completed, otherwise the status will be offline (default value `30`)
* `offlineTimeUntilMajor` - time in seconds a service has to be offline until it turns from partial to major outage (default value `300`)

You can specify the interval (`cron`) your services should be checked. You can use the cron syntax from [`node-cron`](https://www.npmjs.com/package/node-cron). Finally you need to provide the information to your cachet instance (`api` and `token`).

To change the default values globally you can set the in the `defaults` object.

Example:

```json
{
	"cron": "0 * * * * *",
	"api": "https://<cachet-url>/api/v1",
	"token": "<user-token>",
	"services": [
		{
			"id": 1,
			"type": "HTTP",
			"url": "https://sp-codes.de",
			"performanceTimeout": 1
		},
		{
			"id": 2,
			"type": "TCP",
			"host": "sp-codes.de",
			"port": 443
		}
	],
	"defaults": {
		"retry": 1,
		"waitUntilRetry": 5,
		"performanceTimeout": 2,
		"requestTimeout": 10,
		"offlineTimeUntilMajor": 600
	}
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
   
   __Important: If you want `UDP` checks, you need to run it as `root`, because `nmap` allows `UDP` scans only for `root`.__

## License

[![GNU GPLv3 Image](https://www.gnu.org/graphics/gplv3-127x51.png)](https://www.gnu.org/licenses/gpl-3.0)

cachet-monitor is Free Software: It is licensed under GNU GPL v3 (See [LICENSE](LICENSE) for more information).
