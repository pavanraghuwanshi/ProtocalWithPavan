// const gps = require('./index');

// const options = {
//   debug: true,
//   port: 5001,
//   device_adapter: "GT06"
// };

// const server = gps.server(options, (device, connection) => {

//   device.on('login_request', function(device_id, msg_parts) {
//     console.log('Device trying to login:', device_id);
//     this.login_authorized(true);
//   });

//   device.on('login', function() {
//     console.log('Device logged in:', this.uid);
//   });

//   device.on('ping', function(data) {
//     console.log('Ping from device:', data.toString('hex'));
//     return data;
//   });

//   // Listen for all data packets from the device
//   device.on('data', function(data) {
//     const protocolNumber = data[3]; // GT06 protocol number
//     const timestamp = new Date().toLocaleString();

//     if (protocolNumber === 0x13) {
//       // Heartbeat packet
//       console.log(`❤️ Heartbeat received from device ${device.uid} at ${timestamp}`);
//     } else {
//       // Other packets (login, GPS, etc.)
//       console.log(`📡 Data received from device ${device.uid} at ${timestamp}:`, data.toString('hex'));
//     }
//   });
// });

// server.setDebug(true);
// console.log('GPS server running on port', options.port);

console.log('GT06 test server running on port 5001');



// const gps = require('./index');

// // GT06/PT06 options
// const options = {
//   debug: true,
//   port: 5001,
//   device_adapter: "GT06"
// };

// function parseLatitude(data) {
//   return data.readUInt32BE(7) / 1000000;
// }

// function parseLongitude(data) {
//   return data.readUInt32BE(11) / 1000000;
// }

// function parseSpeed(data) {
//   return data[15];
// }

// function parseCourse(data) {
//   return data.readUInt16BE(16);
// }

// const server = gps.server(options, (device, connection) => {

//   device.on('login_request', function(device_id, msg_parts) {
//     console.log('Device trying to login:', device_id);
//     this.login_authorized(true);
//   });

//   device.on('login', function() {
//     console.log('Device logged in:', this.uid);
//   });

//   device.on('ping', function(data) {
//     console.log('Ping from device:', data.toString('hex'));
//     return data;
//   });

//   // Listen for all packets
//   device.on('data', function(data) {
//     const protocolNumber = data[3]; // Protocol number
//     const timestamp = new Date().toLocaleString();

//     if (protocolNumber === 0x13) {
//       // Heartbeat
//       console.log(`❤️ Heartbeat received from device ${device.uid} at ${timestamp}`);
//     } else if (protocolNumber === 0x12 || protocolNumber === 0x10) {
//       // GPS location
//       const lat = parseLatitude(data);
//       const lon = parseLongitude(data);
//       const speed = parseSpeed(data);
//       const course = parseCourse(data);

//       console.log(`📍 GPS data from device ${device.uid} at ${timestamp}`);
//       console.log(`   Latitude: ${lat}`);
//       console.log(`   Longitude: ${lon}`);
//       console.log(`   Speed: ${speed} km/h`);
//       console.log(`   Course: ${course}°`);
//     } else {
//       console.log(`📡 Data received from device ${device.uid} at ${timestamp}:`, data.toString('hex'));
//     }
//   });
// });

// server.setDebug(true);
// console.log('GPS server running on port', options.port);


const gps = require('./index');

// GT06/PT06 options
const options = {
  debug: true,
  port: 5001,
  device_adapter: "GT06"
};

// --- Parsers for GT06 packets ---
function parseLatitude(data) {
  // Latitude = 4 bytes after datetime(6) + satellites(1) = start at byte 11
  return data.readUInt32BE(11) / 1800000;
}

function parseLongitude(data) {
  // Longitude = next 4 bytes after latitude
  return data.readUInt32BE(15) / 1800000;
}

function parseSpeed(data) {
  // Speed byte right after longitude
  return data[19];
}

function parseCourse(data) {
  // Course = 2 bytes after speed (lower 10 bits are valid)
  return data.readUInt16BE(20) & 0x03FF;
}

// --- GPS Server Setup ---
const server = gps.server(options, (device, connection) => {

  device.on('login_request', function (device_id, msg_parts) {
    console.log('Device trying to login:', device_id);
    this.login_authorized(true);
  });

  device.on('login', function () {
    console.log('Device logged in:', this.uid);
  });

  device.on('ping', function (data) {
    console.log('Ping from device (raw hex):', data.toString('hex'));
    return data;
  });

  // Listen for all data packets from the device
  device.on('data', function (data) {
    const protocolNumber = data[3]; // GT06 protocol number
    const timestamp = new Date().toLocaleString();

    if (protocolNumber === 0x13) {
      // Heartbeat
      console.log(`❤️ Heartbeat received from device ${device.uid} at ${timestamp}`);
    } else if (protocolNumber === 0x12 || protocolNumber === 0x10 || protocolNumber === 0x94) {
      // GPS Location
      try {
        const lat = parseLatitude(data);
        const lon = parseLongitude(data);
        const speed = parseSpeed(data);
        const course = parseCourse(data);

        console.log(`📍 GPS data from device ${device.uid} at ${timestamp}`);
        console.log(`   Latitude: ${lat.toFixed(6)}`);
        console.log(`   Longitude: ${lon.toFixed(6)}`);
        console.log(`   Speed: ${speed} km/h`);
        console.log(`   Course: ${course}°`);
      } catch (err) {
        console.error("❌ Error parsing GPS data:", err);
        console.log("Raw packet:", data.toString('hex'));
      }
    } else {
      // Other data (alarms, status, etc.)
      console.log(`📡 Data received from device ${device.uid} at ${timestamp}:`, data.toString('hex'));
    }
  });
});

server.setDebug(true);
console.log('🚀 GPS server running on port', options.port);
