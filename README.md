# cachet-monitor

Simple monitor to watch URLs (`HTTP`) or ports (`TCP`, `UDP`) and update Cachet status.

## Configuration

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
