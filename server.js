// server.js
const net = require("net");

const PORT = 5001;

// Helper: hex print
function hex(buf) {
  return Buffer.isBuffer(buf) ? buf.toString("hex") : String(buf);
}

// Validate lat/lon
function isValidLatLon(lat, lon) {
  return Number.isFinite(lat) &&
    lat <= 90 && lat >= -90 &&
    lon <= 180 && lon >= -180;
}

// Parse GPS packet (protocol 0x22)
function parseGpsPacket(buf) {
  try {
    const date = buf.slice(4, 10); // datetime
    const sats = buf[10];
    const latRaw = buf.readUInt32BE(11);
    const lonRaw = buf.readUInt32BE(15);
    const speed = buf[19];
    const courseStatus = buf.readUInt16BE(20);

    const lat = latRaw / 30000 / 60;
    const lon = lonRaw / 30000 / 60;
    const course = courseStatus & 0x03FF; // lower 10 bits

    return { lat, lon, speed, course, sats, raw: hex(buf) };
  } catch (e) {
    return null;
  }
}

// Simple buffer reassembler
class PacketAssembler {
  constructor(onPacket) {
    this.buffer = Buffer.alloc(0);
    this.onPacket = onPacket;
  }

  feed(data) {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length >= 5) {
      let start = this.buffer.slice(0, 2).toString("hex");
      let len, fullLen;

      if (start === "7878") {
        len = this.buffer[2];
        fullLen = 2 + 1 + len + 2; // start + len + body + stop
      } else if (start === "7979") {
        len = this.buffer.readUInt16BE(2);
        fullLen = 2 + 2 + len + 2;
      } else {
        // drop junk
        this.buffer = this.buffer.slice(1);
        continue;
      }

      if (this.buffer.length < fullLen) {
        // not enough yet
        break;
      }

      const packet = this.buffer.slice(0, fullLen);
      this.buffer = this.buffer.slice(fullLen);

      this.onPacket(packet);
    }
  }
}

// Server
const server = net.createServer((socket) => {
  console.log("🔌 Device connected:", socket.remoteAddress);

  const assembler = new PacketAssembler((packet) => {
    const start = packet.slice(0, 2).toString("hex");
    let protocol = null;

    if (start === "7878") {
      protocol = packet[3];
    } else if (start === "7979") {
      protocol = packet[4];
    }

    const ts = new Date().toLocaleString();

    // Handle packets
    if (protocol === 0x01) {
      // Login
      const imei = packet.slice(4, 12).toString("hex");
      console.log(`✅ Login request from IMEI: ${imei} at ${ts}`);

      // Reply login success
      const loginAck = Buffer.from("787805010001d9dc0d0a", "hex");
      socket.write(loginAck);

    } else if (protocol === 0x13) {
      // Heartbeat
      console.log(`❤️ Heartbeat at ${ts}`);
      const hbAck = Buffer.from("787805130001d9dc0d0a", "hex");
      socket.write(hbAck);

    } else if (protocol === 0x22) {
      // GPS
      const gps = parseGpsPacket(packet);
      if (gps && isValidLatLon(gps.lat, gps.lon)) {
        console.log(`📍 GPS at ${ts}`);
        console.log(`   Latitude : ${gps.lat}`);
        console.log(`   Longitude: ${gps.lon}`);
        console.log(`   Speed    : ${gps.speed} km/h`);
        console.log(`   Course   : ${gps.course}°`);
      } else {
        console.log(`⚠️ Could not parse GPS packet: ${hex(packet)}`);
      }

    } else {
      // Other data (0x94, alerts, etc.)
      console.log(`📡 Other data at ${ts}: ${hex(packet)}`);
    }
  });

  socket.on("data", (data) => {
    assembler.feed(data);
  });

  socket.on("error", (err) => {
    console.warn("⚠️ Socket error:", err.message);
  });

  socket.on("close", () => {
    console.log("🔌 Device disconnected");
  });
});

server.listen(PORT, () => {
  console.log("🚀 PT06/GT06 server running on port", PORT);
});
