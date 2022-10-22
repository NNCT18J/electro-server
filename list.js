const { SerialPort } = require('serialport');

SerialPort.list().then(function (ports) {
    ports.forEach(function (port) {
        if (!port.pnpId) {
            return;
        }
        console.log("Port: ", port);
    })
});