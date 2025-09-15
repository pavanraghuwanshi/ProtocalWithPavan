// const net = require("net");
// const client = new net.Socket();

// // GT06 login packet (IMEI = 123456789012345)
// const loginPacket = Buffer.from("78780D01012345678901234500018DDB0D0A", "hex");

// // GT06 heartbeat packet
// const heartbeatPacket = Buffer.from("78780A13400604000100008DDB0D0A", "hex");

// client.connect(5001, "127.0.0.1", function () {
//   console.log("✅ Connected to GPS server, sending login packet...");
//   client.write(loginPacket);
// });

// client.on("data", function (data) {
//   console.log("📩 Received from server:", data.toString("hex"));

//   // If server accepted login, start heartbeat loop
//   if (data.toString("hex").startsWith("78780501")) {
//     console.log("✅ Login acknowledged by server, starting heartbeat...");
//     setInterval(() => {
//       client.write(heartbeatPacket);
//       console.log("❤️ Sent heartbeat packet");
//     }, 30000);
//   }
// });

// client.on("error", function (err) {
//   console.error("❌ Socket error:", err.message);
// });

// client.on("close", function () {
//   console.log("❌ Connection closed");
// });


const net = require("net");
const client = new net.Socket();

// ----------------------------
// GT06 Packet Templates
// ----------------------------

// GT06 login packet (IMEI = 123456789012345)
const loginPacket = Buffer.from("78780D01012345678901234500018DDB0D0A", "hex");

// GT06 heartbeat packet (protocol 0x13)
const heartbeatPacket = Buffer.from("78780A13400604000100008DDB0D0A", "hex");

// GT06 GPS location packet (protocol 0x12)
// This is a simulated GPS packet: latitude, longitude, speed
// Format: 78 78 + length + protocol + data + serial + CRC + 0D0A
function createGPSPacket(lat, lon, speed) {
  const packet = Buffer.alloc(23); // total length including headers

  packet[0] = 0x78;
  packet[1] = 0x78;
  packet[2] = 0x0F; // length of remaining bytes
  packet[3] = 0x12; // protocol number 0x12 = GPS
  packet.writeUInt32BE(Math.floor(lat * 1000000), 4); // latitude
  packet.writeUInt32BE(Math.floor(lon * 1000000), 8); // longitude
  packet[12] = speed; // speed km/h
  packet.writeUInt16BE(0, 13); // course 0
  packet.writeUInt16BE(1, 15); // serial number
  packet[17] = 0x00; // CRC placeholder
  packet[18] = 0x00; // CRC placeholder
  packet[19] = 0x0D;
  packet[20] = 0x0A;

  return packet;
}

// ----------------------------
// Connect to server
// ----------------------------
client.connect(5001, "127.0.0.1", function () {
  console.log("✅ Connected to GPS server, sending login packet...");
  client.write(loginPacket);
});

// ----------------------------
// Handle server data
// ----------------------------
client.on("data", function (data) {
  console.log("📩 Received from server:", data.toString("hex"));

  // If login acknowledged, start heartbeat + GPS loop
  if (data.toString("hex").startsWith("78780501")) {
    console.log("✅ Login acknowledged by server, starting heartbeat + GPS...");

    // Heartbeat every 30 seconds
    setInterval(() => {
      client.write(heartbeatPacket);
      console.log("❤️ Sent heartbeat packet");
    }, 30000);

    // GPS location every 10 seconds (simulate moving device)
    let lat = 12.9716; // example latitude
    let lon = 77.5946; // example longitude
    setInterval(() => {
      const gpsPacket = createGPSPacket(lat, lon, 60); // 60 km/h speed
      client.write(gpsPacket);
      console.log(`📍 Sent GPS packet: lat=${lat}, lon=${lon}`);
      
      // Simulate movement
      lat += 0.0001;
      lon += 0.0001;
    }, 10000);
  }
});

client.on("error", function (err) {
  console.error("❌ Socket error:", err.message);
});

client.on("close", function () {
  console.log("❌ Connection closed");
});
