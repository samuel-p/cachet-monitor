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
fs.unlinkSync(cachePath);

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

const checkHttp = async (url, performanceTimeout, requestTimeout) => {
    const controller = new abort.AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout);
    try {
        const start = new Date().getTime();
        const response = await fetch(url, {signal: controller.signal});
        const stop = new Date().getTime();
        if (response.ok) {
            if (stop - start > performanceTimeout) {
                return {status: "SLOW", message: response.statusText};
            }
            return {status: "ONLINE", message: response.statusText};
        } else {
            return {status: "OFFLINE", message: response.statusText};
        }
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
            timeout: requestTimeout / 1000,
            udp: type === 'udp'
        }, (error, report) => {
            if (error) {
                resolve({status: "OFFLINE", message: error});
            } else {
                const result = report[host].host[0];
                const time = parseInt(result.item.endtime) - parseInt(result.item.starttime);
                const status = result.ports[0].port[0].state[0].item;
                if (status.state.includes('open')) {
                    if (time > performanceTimeout) {
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
    switch (service.type) {
        case 'HTTP':
            return await checkHttp(service.url, service.timeout * 1000, service.timeout * 2000);
        case 'TCP':
            return await checkPort(service.host, service.port, 'tcp', service.timeout * 1000, service.timeout * 2000);
        case 'UDP':
            return await checkPort(service.host, service.port, 'udp', service.timeout * 1000, service.timeout * 2000);
        default:
            throw new Error('unsupported type "' + type + '"')
    }
}

const checkService = async (service, oldStatus) => {
    const newStatus = await checkStatus(service);
    newStatus.changed = new Date().getTime();
    if (newStatus.status === "OFFLINE" && oldStatus && ["OFFLINE", "INCIDENT"].includes(oldStatus.status) &&
        oldStatus.changed + config.offlineTimeUntilMajor * 1000 < newStatus.changed) {
        newStatus.status = "INCIDENT";
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
    for (const service of config.services) {
        const oldStatus = cache[service.id];
        const newStatus = await checkService(service, oldStatus);
        if (!oldStatus || oldStatus.status !== newStatus.status) {
            console.log(service.id + ' status changed: ' + newStatus.status);
            await pushStatusToCachet(service.id, newStatus.status);
            cache[service.id] = newStatus;
        }
    }
};

cron.schedule(config.cron, async () => await check(), {});

