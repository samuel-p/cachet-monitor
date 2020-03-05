const config = require('./data/config');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const fetch = require('node-fetch');
const abort = require('abort-controller');
const nmap = require('libnmap');

let cachePath = path.resolve("./data/cache.json");
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, {encoding: "utf8"})) : {};
// delete cache file to remove orphaned cache values
if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
}

process.on('SIGINT', () => {
    fs.writeFileSync(cachePath, JSON.stringify(cache), {encoding: "utf8"});
    process.exit(0);
});

const cachetStatusMapping = {
    "ONLINE": 1,
    "SLOW": 2,
    "OFFLINE": 3,
    "INCIDENT": 4
};

config.cron = config.cron || "* * * * *";
config.defaults = config.defaults || {};
config.defaults.retry = config.defaults.retry || 0;
config.defaults.waitUntilRetry = config.defaults.waitUntilRetry || 5;
config.defaults.performanceTimeout = config.defaults.performanceTimeout || 1;
config.defaults.requestTimeout = config.defaults.requestTimeout || 30;
config.defaults.offlineTimeUntilMajor = config.defaults.offlineTimeUntilMajor || 300;

const checkHttp = async (url, performanceTimeout, requestTimeout) => {
    const controller = new abort.AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout * 1000);
    try {
        const start = new Date().getTime();
        const response = await fetch(url, {signal: controller.signal});
        const stop = new Date().getTime();
        if (response.ok) {
            if (stop - start > performanceTimeout * 1000) {
                return {status: "SLOW", message: response.statusText};
            }
            return {status: "ONLINE", message: response.statusText};
        }
        return {status: "OFFLINE", message: response.statusText};
    } catch (e) {
        return {status: "OFFLINE", message: e.message};
    } finally {
        clearTimeout(timeout);
    }
};

const checkPort = async (host, port, type, performanceTimeout, requestTimeout) => {
    return await new Promise(resolve => {
        nmap.scan({
            range: [host],
            ports: port.toString(),
            timeout: requestTimeout,
            udp: type === 'udp'
        }, (error, report) => {
            if (error) {
                resolve({status: "OFFLINE", message: error});
            } else {
                const result = report[host].host[0];
                const time = parseInt(result.item.endtime) - parseInt(result.item.starttime);
                const status = result.ports[0].port[0].state[0].item;
                if (status.state.includes('open')) {
                    if (time > performanceTimeout * 1000) {
                        resolve({status: "SLOW", message: status.state});
                    } else {
                        resolve({status: "ONLINE", message: status.state});
                    }
                } else {
                    resolve({status: "OFFLINE", message: status.state});
                }
            }
        });
    });
};

async function checkStatus(service) {
    const performanceTimeout = service.performanceTimeout || config.defaults.performanceTimeout;
    const requestTimeout = service.requestTimeout || config.defaults.requestTimeout;
    switch (service.type) {
        case 'HTTP':
            return await checkHttp(service.url, performanceTimeout, requestTimeout);
        case 'TCP':
            return await checkPort(service.host, service.port, 'tcp', performanceTimeout, requestTimeout);
        case 'UDP':
            return await checkPort(service.host, service.port, 'udp', performanceTimeout, requestTimeout);
        default:
            throw new Error('unsupported type "' + type + '"')
    }
}

const checkService = async (service, oldStatus) => {
    const retry = service.retry || config.defaults.retry;
    const waitUntilRetry = (service.waitUntilRetry || config.defaults.waitUntilRetry) * 1000;
    let newStatus;
    for (let i = retry; i >= 0; i--) {
        newStatus = await checkStatus(service);
        newStatus.changed = new Date().getTime();
        if (newStatus.status === "ONLINE") {
            return newStatus;
        }
        const offlineTimeUntilMajor = (service.offlineTimeUntilMajor || config.defaults.offlineTimeUntilMajor) * 1000;
        if (newStatus === "OFFLINE" && oldStatus && (oldStatus.status === "INCIDENT" || oldStatus.status === "OFFLINE" && oldStatus.changed + offlineTimeUntilMajor < newStatus.changed)) {
            newStatus.status = "INCIDENT";
        }
        if (i >= 0 && waitUntilRetry > 0) {
            await new Promise(r => setTimeout(r, waitUntilRetry));
        }
    }
    return newStatus;
};

const pushStatusToCachet = async (id, status) => {
    try {
        let currentCachetStatus = cachetStatusMapping[status];
        const oldState = await fetch(config.api + '/components/' + id).then(r => r.json());
        if (oldState.data.status === currentCachetStatus) {
            console.log('state already set');
            return;
        }
        const update = await fetch(config.api + '/components/' + id, {
            method: 'PUT',
            body: JSON.stringify({status: currentCachetStatus}),
            headers: {
                'Content-Type': 'application/json',
                'X-Cachet-Token': config.token
            }
        });
        if (!update.ok) {
            console.log('failed to update status: ' + update.statusText);
        }
    } catch (e) {
        console.log('failed to update status', e);
    }
};

const check = async () => {
    await Promise.all(config.services.map(async service => {
        const oldStatus = cache[service.id];
        const newStatus = await checkService(service, oldStatus);
        if (!oldStatus || oldStatus.status !== newStatus.status) {
            console.log(service.id + ' status changed: ' + newStatus.status);
            await pushStatusToCachet(service.id, newStatus.status);
            cache[service.id] = newStatus;
        }
    }));
};

cron.schedule(config.cron, async () => await check(), {});
