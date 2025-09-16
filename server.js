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



// server.js
const gps = require('./index');

const options = {
  debug: true,
  port: 5001,
  device_adapter: "GT06"
};

// Helper: check valid lat/lon range
function isValidLatLon(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
         lat <= 90 && lat >= -90 && lon <= 180 && lon >= -180;
}

// Try standard PT06 (7878) offsets first, then fallback to scanning buffer for plausible lat/lon
function findLatLonAndMeta(buffer) {
  // Candidate parsing strategies (offset-based)
  const candidates = [
    // common 7878 layout (latitude bytes 12-15, longitude 16-19)
    { latIndex: 12, lonIndex: 16, speedIndexOffset: 8, courseIndexOffset: 9 },
    // alternative 7878 variant (lat 9-12, lon 13-16) - some firmwares
    { latIndex: 9, lonIndex: 13, speedIndexOffset: 8, courseIndexOffset: 9 },
    // later/extended variant where lat starts later (used for 7979/0x94 sometimes)
    { latIndex: 20, lonIndex: 24, speedIndexOffset: 8, courseIndexOffset: 9 }
  ];

  // Try candidates first
  for (const c of candidates) {
    if (buffer.length >= c.lonIndex + 4) {
      try {
        const latRaw = buffer.readUInt32BE(c.latIndex);
        const lonRaw = buffer.readUInt32BE(c.lonIndex);
        const lat = latRaw / 1800000;
        const lon = lonRaw / 1800000;
        if (isValidLatLon(lat, lon)) {
          const speed = (buffer.length > (c.latIndex + c.speedIndexOffset)) ? buffer[c.latIndex + c.speedIndexOffset] : null;
          const course = (buffer.length > (c.latIndex + c.courseIndexOffset + 1)) ? buffer.readUInt16BE(c.latIndex + c.courseIndexOffset) : null;
          return { lat, lon, speed, course, foundAt: c.latIndex };
        }
      } catch (e) {
        // ignore read errors and continue
      }
    }
  }

  // Fallback: brute force scan the buffer for any 8-byte pair that gives plausible lat & lon
  for (let i = 0; i + 8 <= buffer.length; i++) {
    try {
      const latRaw = buffer.readUInt32BE(i);
      const lonRaw = buffer.readUInt32BE(i + 4);
      const lat = latRaw / 1800000;
      const lon = lonRaw / 1800000;
      if (isValidLatLon(lat, lon)) {
        const speed = (buffer.length > i + 8) ? buffer[i + 8] : null;
        const course = (buffer.length > i + 9) ? buffer.readUInt16BE(i + 9) : null;
        return { lat, lon, speed, course, foundAt: i };
      }
    } catch (e) {
      // if readUInt32BE fails near buffer end, continue
    }
  }

  // nothing found
  return null;
}

// small helper to print hex nicely
function hex(buf) {
  return Buffer.isBuffer(buf) ? buf.toString('hex') : String(buf);
}

// Server setup
const server = gps.server(options, (device, connection) => {

  // login request: set device.uid (safe) and authorize
  device.on('login_request', function (device_id, msg_parts) {
    console.log(`#${device_id}: Device requesting login`);
    try {
      // ensure the device receives an authorization success
      this.login_authorized(true);
      // set uid so later logs show IMEI even if adapter doesn't
      this.uid = device_id || this.uid || '';
    } catch (e) {
      console.warn("⚠️ login_authorized error:", e);
    }
  });

  device.on('login', function () {
    // adapter might have already set this.uid to IMEI
    console.log(`✅ Device logged in: ${this.uid || 'unknown'}`);
  });

  device.on('ping', function (data) {
    console.log(`📩 Ping (raw hex) from ${device.uid || 'unknown'}: ${hex(data)}`);
    return data;
  });

  // catch low-level connection errors so server doesn't crash
  if (connection && connection.socket) {
    connection.socket.on('error', (err) => {
      console.warn(`⚠️ Connection socket error for ${device.uid || 'unknown'}:`, err && err.message ? err.message : err);
    });
    connection.socket.on('close', () => {
      console.log(`🔌 Connection closed for ${device.uid || 'unknown'}`);
    });
  }

  device.on('data', function (data) {
    // Determine frame type and protocol:
    //  - 78 78 frames: protocol at data[3]
    //  - 79 79 frames: length is two bytes, protocol at data[4] (extended)
    const ts = new Date().toLocaleString();
    if (!Buffer.isBuffer(data)) data = Buffer.from(data);

    const start = data.length >= 2 ? data.slice(0, 2).toString('hex') : '';
    let protocolNumber = null;
    if (start === '7878') {
      protocolNumber = data.length >= 4 ? data[3] : null;
    } else if (start === '7979') {
      // extended 79 frames: protocol typically at byte 4
      protocolNumber = data.length >= 5 ? data[4] : null;
    } else {
      // unknown frame start, but try to read protocol at 3 anyway
      protocolNumber = data.length >= 4 ? data[3] : null;
    }

    // Log raw for debug
    // console.log(`RAW packet (${start}) protocol=${protocolNumber} from ${device.uid || 'unknown'}: ${hex(data)}`);

    // Handle heartbeat (0x13)
    if (protocolNumber === 0x13) {
      console.log(`❤️ Heartbeat from ${device.uid || 'unknown'} at ${ts}`);
      // Optionally respond with heartbeat ack (GT06 style) - safe static response used by many libs
      try {
        const ack = Buffer.from('787805130001d9dc0d0a', 'hex');
        if (typeof device.send === 'function') device.send(ack);
        else if (connection && typeof connection.write === 'function') connection.write(ack);
      } catch (e) {
        // ignore send errors
      }
      return;
    }

    // Handle standard GPS packets (0x12 / 0x10) and extended 0x94 for PT06
    if (protocolNumber === 0x12 || protocolNumber === 0x10 || protocolNumber === 0x94) {
      // try to parse lat/lon with heuristics
      const found = findLatLonAndMeta(data);
      if (found) {
        const { lat, lon, speed, course, foundAt } = found;
        console.log(`📍 GPS data from ${device.uid || 'unknown'} at ${ts} (foundAt=${foundAt})`);
        console.log(`   Latitude : ${lat}`);
        console.log(`   Longitude: ${lon}`);
        console.log(`   Speed    : ${speed === null ? 'unknown' : speed + ' km/h'}`);
        console.log(`   Course   : ${course === null ? 'unknown' : course + '°'}`);
        return;
      } else {
        // fallback: try known offsets for older devices
        try {
          // older 7878-style offsets
          if (data.length >= 23) {
            const latRaw = data.readUInt32BE(12);
            const lonRaw = data.readUInt32BE(16);
            const lat = latRaw / 1800000;
            const lon = lonRaw / 1800000;
            if (isValidLatLon(lat, lon)) {
              const speed = data[20];
              const course = data.readUInt16BE(21);
              console.log(`📍 GPS data (fallback) from ${device.uid || 'unknown'} at ${ts}`);
              console.log(`   Latitude : ${lat}`);
              console.log(`   Longitude: ${lon}`);
              console.log(`   Speed    : ${speed} km/h`);
              console.log(`   Course   : ${course}°`);
              return;
            }
          }
        } catch (e) {
          // ignore fallback parse errors
        }

        // if still nothing, log raw for debugging
        console.log(`📡 ${ts} - Unable to parse GPS fields but protocol=${protocolNumber} from ${device.uid || 'unknown'}. Raw: ${hex(data)}`);
        return;
      }
    }

    // Everything else (alerts, LBS, config, etc.)
    console.log(`📡 Other data from ${device.uid || 'unknown'} at ${ts}:`, hex(data));
  });

}); // end gps.server

server.setDebug(true);
console.log('🚀 PT06 GPS server running on port', options.port);
