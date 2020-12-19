# b2g-info-logs

b2g information of adb device and memory profiling for kiaos apps.

b2g-info command is executed to fetch below details

- Current running apps
- Sytem memory information
- Low-memory killer parameters

Infomation will be collected at regular intervals if duration is not defined and xls logs are generated.

Logs will have below information

- NAME
- PID
- PSS
- USS
- AVG(USS), AVG(PSS)
- MAX(USS), MAX(PSS)
- Time spent

## Dependencies

- `node`
- `npm`
- `adb`
- firefox version < `54.0.1`
- adb server need to started `sudo adb start-server` on Ubuntu/Mac and `adb start-server` to be run as administrator on windows

## Install

```
npm install -g b2g-info-logs
```

## How to use

```
b2g-info-logs

Options:
   -n, --name          Collect logs for particular app []
   -i, --interval      Interval with which b2g-info should poll [0ms]
   -d, --duration      Duration till b2g-info to be collected [10000ms]
```

Launch multiple apps

```
b2g-info-logs -n facebook -n google
```

Run for particular duration

```
b2g-info-logs -d 30000
```

Run with defined interval

```
b2g-info-logs -i 10
```

![Reference](https://user-images.githubusercontent.com/54983245/102697067-d26f5900-4258-11eb-9c2a-23aa08de580c.gif)

## Future

- [ ] Real time graph
- [ ] Flexability to drive b2g-info-logs with needs params of running apps
- [ ] Adding Sytem memory information & Low-memory killer parameters to logs
- [ ] Screen shots of b2g-info
