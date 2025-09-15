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
  device_adapter: "GT06"   // PT06 bhi isi adapter ka variation hai
};

// --- Parsers for PT06 packets ---
// Utility: convert BCD (hex-coded) to decimal
function bcdToDecimal(bcdBuffer) {
  let str = "";
  for (let i = 0; i < bcdBuffer.length; i++) {
    let byte = bcdBuffer[i];
    str += (byte >> 4).toString(16);
    str += (byte & 0x0f).toString(16);
  }
  return parseFloat(str);
}

function parseLatitude(data) {
  // PT06: latitude bytes start around 9th byte (after date + sat)
  // usually 4 bytes
  const latRaw = data.slice(9, 13);  
  const lat = bcdToDecimal(latRaw) / 1000000; 
  return lat;
}

function parseLongitude(data) {
  // next 4 bytes
  const lonRaw = data.slice(13, 17);
  const lon = bcdToDecimal(lonRaw) / 1000000;
  return lon;
}

function parseSpeed(data) {
  return data[data.length - 6]; // usually speed is last few bytes before checksum
}

function parseCourse(data) {
  return 0; // optional, we can refine later
}

// --- GPS Server Setup ---
const server = gps.server(options, (device, connection) => {

  device.on('login_request', function (device_id, msg_parts) {
    console.log(`#${device_id}: Device requesting login`);
    this.login_authorized(true);
  });

  device.on('login', function () {
    console.log(`✅ Device logged in: ${this.uid}`);
  });

  device.on('ping', function (data) {
    console.log('Ping (raw hex):', data.toString('hex'));
    return data;
  });

  device.on('data', function (data) {
    const protocolNumber = data[4]; 
    const timestamp = new Date().toLocaleString();

    if (protocolNumber === 0x13) {
      console.log(`❤️ Heartbeat from ${device.uid} at ${timestamp}`);
    } 
    else if (protocolNumber === 0x12 || protocolNumber === 0x10 || protocolNumber === 0x94) {
      try {
        const lat = parseLatitude(data);
        const lon = parseLongitude(data);
        const speed = parseSpeed(data);
        const course = parseCourse(data);

        console.log(`📍 GPS data from ${device.uid} at ${timestamp}`);
        console.log(`   Latitude: ${lat}`);
        console.log(`   Longitude: ${lon}`);
        console.log(`   Speed: ${speed} km/h`);
        console.log(`   Course: ${course}°`);
      } catch (err) {
        console.error("❌ Error parsing GPS data:", err);
        console.log("Raw packet:", data.toString('hex'));
      }
    } 
    else {
      console.log(`📡 Data from ${device.uid} at ${timestamp}:`, data.toString('hex'));
    }
  });
});

server.setDebug(true);
console.log('🚀 GPS server running on port', options.port);
