#!/usr/bin/env node

const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const chalk = require('chalk');
const chalkTable = require('chalk-table');
const yargs = require('yargs');
const Excel = require('exceljs');

const log = console.log;
const workbook = new Excel.Workbook();
const logStartTime = new Date();
const headerColor = chalk.bold.rgb(10, 100, 200);
const opts = yargs
  .option('name', {
    alias: 'n',
    default: [],
    description: 'Collect logs for particular app',
    type: 'string'
  })
  .option('interval', {
    alias: 'i',
    default: 0,
    description: 'Interval with which b2g-info should poll',
    type: 'number'
  })
  .option('duration', {
    alias: 'd',
    default: 10000,
    description: 'Duration till b2g-info to be collected',
    type: 'number'
  })
  .parse();
const options = {
  leftPad: 2,
  columns: [
    { field: 'pid', name: headerColor('PID') },
    { field: 'name', name: headerColor('NAME') },
    { field: 'uss', name: headerColor('USS') },
    { field: 'pss', name: headerColor('PSS') }
  ]
};
const check = {
  rootUser: 'This program needs to run as the root user in order to query pids.',
  systemMemoryInfo: 'System memory info',
  lowMemoryInfo: 'Low-memory killer parameters'
};
let b2gInfoData = {
  device: {
    id: '',
    product: '',
    model: ''
  },
  apps: [],
  memory: {},
  lowMemory: {
    notify_trigger: {
      value: null,
      denotation: ''
    },
    oom_adj: [],
    min_free: []
  }
};

if (opts.name) {
  opts.name = typeof opts.name === 'string' ? [opts.name] : opts.name;
  opts.name.forEach((name) => {
    const worksheet = workbook.addWorksheet(name);
    worksheet.columns = [
      { header: 'Name', key: 'name' },
      { header: 'PID', key: 'pid' },
      { header: 'PSS', key: 'pss' },
      { header: 'USS', key: 'uss' }
    ];
    worksheet.getRow(1).font = { bold: true };
  });
}

if (opts.duration) {
  setTimeout(() => {
    generateLogs().then(() => {
      log(chalk.rgb(255, 140, 0)('b2g logs collected'));
      process.exit();
    });
  }, opts.duration);
}

process.on('SIGTERM', (signal) => {
  generateLogs().then(() => {
    log(chalk.rgb(255, 140, 0)('b2g logs collected'));
    process.exit(0);
  });
});

process.on('SIGINT', (signal) => {
  generateLogs().then(() => {
    log(chalk.rgb(255, 140, 0)('b2g logs collected'));
    process.exit(0);
  });
});

const generateLogs = () => {
  if (!opts.name.length) {
    process.exit(0);
  }

  opts.name.forEach((name) => {
    const rowLength = workbook.getWorksheet(name)._rows.length;
    const worksheet = workbook.getWorksheet(name);

    worksheet.addRow();
    worksheet.addRow();

    worksheet.addRow({
      pid: 'Average PSS',
      pss: {
        formula: `=AVERAGE(C${2}:C${rowLength})`
      }
    });

    worksheet.addRow({
      pid: 'Average USS',
      pss: {
        formula: `=AVERAGE(D${2}:D${rowLength})`
      }
    });

    worksheet.addRow();
    worksheet.addRow();

    worksheet.addRow({
      pid: 'MAX PSS',
      pss: {
        formula: `=MAX(C${2}:C${rowLength})`
      }
    });

    worksheet.addRow({
      pid: 'MAX USS',
      pss: {
        formula: `=MAX(D${2}:D${rowLength})`
      }
    });

    worksheet.addRow();
    worksheet.addRow();

    let duration = Math.abs(new Date() - logStartTime) / 1000;

    const hours = Math.floor(duration / 3600) % 24;
    duration -= hours * 3600;

    const minutes = Math.floor(duration / 60) % 60;
    duration -= minutes * 60;

    const seconds = (duration % 60).toFixed(0);

    worksheet.addRow({
      pid: 'Time spent for report collection',
      pss: `${hours}H:${minutes}M:${seconds}S`
    });
  });
  return workbook.xlsx.writeFile('./logs/b2g_logs.xls');
};

const collectLogs = async () => {
  try {
    const device = await exec('adb devices -l | grep "device usb:" ');
    const detail = device.stdout
      .replace('\r', '')
      .split(' ')
      .filter((n) => n);
    b2gInfoData.device = {
      id: detail[0],
      product: detail[3].split(':')[1],
      model: detail[5].split(':')[1]
    };
  } catch (error) {
    log(chalk.rgb(220, 20, 60)('No device connected'));
    process.exit(0);
  }

  await b2gInfo(nextTick);

  try {
  } catch (error) {
    log(chalk.rgb(220, 20, 60)('Closing connection to device'));
    return;
  }
};

const b2gInfo = async (done) => {
  b2gInfoData = {
    device: {
      ...b2gInfoData.device
    },
    ...{
      apps: [],
      memory: {},
      lowMemory: {
        notify_trigger: {
          value: null,
          denotation: ''
        },
        oom_adj: [],
        min_free: []
      }
    }
  };

  let info;
  try {
    info = await exec('adb shell b2g-info');
  } catch (err) {
    log(chalk.rgb(220, 20, 60)('Closing connection to device'));
    return;
  }

  if (info.stderr) {
    log(chalk.rgb(220, 20, 60)(`Device: ${b2gInfoData.device.id} disconnected`));
    process.exit(0);
  }

  const data = info.stdout && info.stdout.split('\n');

  if (data[0] && data[0].includes(check.rootUser)) {
    try {
      await exec('adb root');
      await b2gInfo(nextTick);
    } catch (error) {
      log(chalk.rgb(220, 20, 60)('Failed to boot device as root'));
      return;
    }
  }

  const headers = data[1]
    .replace('\r', '')
    .split(' ')
    .filter((n) => n);
  let isSystemInfo = false;
  let isLowMemoryInfo = false;

  data.splice(2).map((items) => {
    const appInfo = items
      .replace('\r', '')
      .replace(' + ', '+')
      .replace(' - ', '-')
      .split(' ')
      .filter((n) => n);

    if (!appInfo.length) {
      return;
    }

    if (isNaN(+appInfo[1])) {
      appInfo[0] = `${appInfo[0]} ${appInfo[1]}`;
      appInfo.splice(1, 1);
    }

    if (items.includes(check.lowMemoryInfo)) {
      isLowMemoryInfo = true;
      return;
    }

    if (items.includes(check.systemMemoryInfo)) {
      isSystemInfo = true;
      return;
    }

    if (isLowMemoryInfo) {
      if (appInfo[0] === 'notify_trigger') {
        b2gInfoData.lowMemory.notify_trigger = {
          value: appInfo[1],
          denotation: appInfo[2]
        };
      } else if (appInfo[0] !== 'oom_adj' && appInfo[1] !== 'min_free') {
        b2gInfoData.lowMemory.oom_adj.push(appInfo[0]);
        b2gInfoData.lowMemory.min_free.push({
          value: appInfo[1],
          denotation: appInfo[2]
        });
      }

      return;
    }

    if (isSystemInfo) {
      b2gInfoData.memory[appInfo[0].toLowerCase()] = {
        value: appInfo[1],
        denotation: appInfo[2]
      };

      return;
    }

    let apps = {};

    headers.forEach((header, index) => {
      apps[header.toLowerCase()] = appInfo[index];
    });

    let appListToFilter = typeof opts.name === 'string' ? [opts.name] : opts.name;

    if (appListToFilter.length > 0) {
      appListToFilter = appListToFilter.map((name) => name.toLowerCase());
      if (!appListToFilter.includes(apps.name.toLowerCase())) {
        return;
      }
    }

    if (opts.name.length) {
      workbook.getWorksheet(apps.name.toLowerCase()).addRow({
        name: apps.name,
        pid: +apps.pid,
        pss: +apps.pss,
        uss: +apps.uss
      });
    }

    b2gInfoData.apps.push(apps);
  });

  console.clear();
  const table = chalkTable(options, b2gInfoData.apps);

  log(chalk.rgb(255, 140, 0)('Device Detail'));

  log(chalk`
  ${headerColor('DEVICE')}: ${b2gInfoData.device.id}
  ${headerColor('PRODUCT')}:  ${b2gInfoData.device.product}
  ${headerColor('MODEL')}:  ${b2gInfoData.device.model}
`);

  log(chalk.rgb(255, 140, 0)('Running Apps'));

  log(`
${table}`);

  log(`
${chalk.rgb(255, 140, 0)('Memory')}`);

  log(chalk`
  ${headerColor('TOTAL')}: ${b2gInfoData.memory.total.value}
  ${headerColor('FREE')}: ${b2gInfoData.memory.free.value}
  ${headerColor('CACHE')}:  ${b2gInfoData.memory.cache.value}
  ${headerColor('FREE+CACHE')}:  ${b2gInfoData.memory['free+cache']['value']}
  `);

  done();
};

const nextTick = () => {
  const callback = b2gInfo.bind(null, nextTick);
  if (!opts.interval) {
    process.nextTick(callback);
  } else {
    setTimeout(callback, opts.interval);
  }
};

collectLogs();
log(chalk.rgb(255, 140, 0)('Establishing connection to device'));
