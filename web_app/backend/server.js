require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const RobotManager = require('./services/RobotManager');

const manager = new RobotManager();
const app = express();
app.use(cors());
app.use(bodyParser.json());

/* -----------------------------------------
   CONNECT TO ROBOT (IP or COM PORT)
----------------------------------------- */
app.post('/api/connect', async (req, res) => {
  const { robotType, ipAddress, comPort } = req.body;

  try {
    // ✅ FIX: Determine which port to use (COM takes priority)
    const port = comPort || ipAddress;
    
    if (!port) {
      return res.status(400).json({ 
        success: false, 
        error: 'Neither COM port nor IP address provided' 
      });
    }

    console.log(`🔌 Attempting to connect to ${robotType} on ${port}`);
    
    // ✅ FIX: Pass only robotType and port (not 3 parameters)
    await manager.connect(robotType, port);

    // Get status after connection
    const status = manager.getStatus();
    
    return res.json({ 
      success: true, 
      message: 'Connected successfully',
      status: status
    });

  } catch (error) {
    console.error('❌ Connection error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* -----------------------------------------
   DISCONNECT
----------------------------------------- */
app.post('/api/disconnect', async (req, res) => {
  try {
    await manager.disconnect();
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* -----------------------------------------
   SEND COMMAND
----------------------------------------- */
app.post('/api/command', async (req, res) => {
  const { command, params } = req.body;

  try {
    const result = await manager.execute(command, params);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/* -----------------------------------------
   MOVEMENT COMMANDS
----------------------------------------- */
app.post('/api/move', async (req, res) => {
  const { axis, direction, distance = 10 } = req.body;

  try {
    const currentPos = manager.getCurrentPosition();
    const moveAmount = direction === '+' ? distance : -distance;
    
    const newPosition = { ...currentPos };
    
    switch(axis.toLowerCase()) {
      case 'x':
        newPosition.x = currentPos.x + moveAmount;
        break;
      case 'y':
        newPosition.y = currentPos.y + moveAmount;
        break;
      case 'z':
        newPosition.z = currentPos.z + moveAmount;
        break;
      case 'r':
        newPosition.r = currentPos.r + moveAmount;
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid axis' });
    }

    await manager.moveCartesian(newPosition);
    const status = manager.getStatus();
    
    res.json({ success: true, position: status.position });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/home', async (req, res) => {
  try {
    await manager.home();
    const status = manager.getStatus();
    res.json({ success: true, position: status.position });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/stop', async (req, res) => {
  try {
    await manager.emergencyStop();
    res.json({ success: true, message: 'Emergency stop executed' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/* -----------------------------------------
   STATUS
----------------------------------------- */
app.get('/api/status', async (req, res) => {
  try {
    const status = manager.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/* -----------------------------------------
   NETWORK SCAN (AUTO-FIND ROBOTS)
----------------------------------------- */
app.post('/api/robots/scan', async (req, res) => {
  try {
    const robots = await manager.scanNetwork();
    res.json({ success: true, robots });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* -----------------------------------------
   COM PORT LIST (AUTO-DETECT SERIAL ROBOTS)
----------------------------------------- */
const { SerialPort } = require('serialport');

app.get('/api/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    const portList = ports.map(port => ({
      path: port.path,
      manufacturer: port.manufacturer || 'Unknown',
      serialNumber: port.serialNumber,
      vendorId: port.vendorId,
      productId: port.productId
    }));
    res.json({ success: true, ports: portList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* -----------------------------------------
   GET AVAILABLE ROBOT TYPES
----------------------------------------- */
app.get('/api/robots/types', (req, res) => {
  try {
    const types = manager.getAvailableRobotTypes();
    res.json({ success: true, types });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* -----------------------------------------
   SERVER LISTEN
----------------------------------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Robot Control Backend Server`);
  console.log(`   Running at: http://localhost:${PORT}`);
  console.log(`\n📡 Available Endpoints:`);
  console.log(`   POST /api/connect       - Connect to robot`);
  console.log(`   POST /api/disconnect    - Disconnect robot`);
  console.log(`   POST /api/move          - Move robot`);
  console.log(`   POST /api/home          - Home robot`);
  console.log(`   POST /api/stop          - Emergency stop`);
  console.log(`   GET  /api/status        - Get robot status`);
  console.log(`   GET  /api/ports         - List COM ports`);
  console.log(`   GET  /api/robots/types  - List robot types\n`);
});