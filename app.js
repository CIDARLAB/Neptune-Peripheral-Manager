var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var serialPort = require('serialport');

app.get('/', function(req, res){
    res.sendFile(__dirname + '\\views\\index2.html');
});

var serial_connections = {};
var serial_connections_details = {};
var custom_connections = {};
io.on('connection', function(socket){

    socket.on('get ports', function
        () {
        console.log("Ports requested");
        serialPort.list(function (err, ports) {
            var o = [];
            for (var connection in ports) {
                if (ports[connection].comName in serial_connections) {
                    o.push({
                        comName: ports[connection].comName,
                        connected: 'Disconnect',
                        name: serial_connections_details[ports[connection].comName].name,
                        module: serial_connections_details[ports[connection].comName].module
                    });
                }
                else {
                    o.push({
                        comName: ports[connection].comName,
                        connected: 'Connect'
                    });
                }
            }
            socket.emit('port numbers', o);
        });
    });

    socket.on('Connect', function (port_name) {
        if(port_name==null || port_name ==''){
            socket.emit('error message', 'Error: No port selected');
            return console.log('Error: No port selected');
        }
        if (!(port_name in serial_connections)) {
            serial_connections_details[port_name] = {
                name: "default",
                module: "PCR"
            };
            serial_connections[port_name] = new serialPort(port_name,
                {baudRate: 115200, parser: serialPort.parsers.readline("\r\n")},
                function (err) {
                    if (err) {
                        socket.emit('error message', err.message);
                        return console.log('Error: ', err.message);
                    }
                    console.log("Port Opened");
                    console.log(Object.keys(serial_connections).length);
                    serial_connections[port_name].write('Hello', function (err) {
                        if (err) {
                            socket.emit('error message', err.message);
                            return console.log('Error on Write:', err.message);
                        }
                    });
                    serial_connections[port_name].on('data', function (data) {
                        console.log(data);
                        socket.emit('data', data);
                        if(serial_connections_details[port_name].name in custom_connections) {
                            for (var detail in serial_connections_details) {
                                if(detail.name == custom_connections[serial_connections_details[port_name].name]) {
                                    serial_connections[detail].write(data, function (err) {
                                        if (err) {
                                            socket.emit('error message', err.message);
                                            return console.log('Error on Write:', err.message);
                                        }
                                    });
                                    break;
                                }
                            }
                        } else {
                            console.log(data);
                            socket.emit('data', data);
                        }
                    });
                });

        }
    });

    socket.on('Disconnect', function (port_name) {
        if (!(port_name in serial_connections)){
            socket.emit('error message','Error: User Attempted to close port with no open connection');
            return console.log("Error: User Attempted to close port with no open connection")
        }
        serial_connections[port_name].close(function (err) {
            if(err) {
                socket.emit('error message', err.message);
                return console.log(err);
            }
        });
        delete serial_connections[port_name];
        socket.emit('closed', "Closed: " + port_name);
        console.log(Object.keys(serial_connections).length);

    });

    socket.on('send message', function (received_message) {
        console.log(received_message);
        if (!(received_message[0] in serial_connections)){
            socket.emit('error message','Error: User Attempted to write to port with no open connection');
            return console.log("Error: User Attempted to write to port with no open connection")}
        serial_connections[received_message[0]].write(received_message[1], function(err){
            if (err){return console.log(err)}
        });
    });

    socket.on('update name', function(data) {
        if (data[0] in serial_connections_details) {
            serial_connections_details[data[0]].name = data[1];
        }
    });

    socket.on('establish connection', function (data) {
        var flag = 0;
        for(var portName in serial_connections_details) {
            if (serial_connections_details[portName].name == data.source || serial_connections_details[portName].name == data.destination) {
                flag +=1;
            }
        }
        if(flag==2) {
            custom_connections[data.source] = data.destination;
        } else{
            socket.emit('error message', 'Error: One of the names is invalid');
        }
    });

});

http.listen(3000, function(){
    console.log('listening on *:3000');
});


