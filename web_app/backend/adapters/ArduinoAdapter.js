const BaseRobotAdapter = require('./BaseRobotAdapter');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

class ArduinoAdapter extends BaseRobotAdapter {
  constructor(port, config) {
    super(port, config);
    this.serial = null;
    this.parser = null;
    this.commandFormat = config.commandFormat || 'simple'; // 'simple', 'gcode', or 'json'
  }

  static getName() {
    return 'Arduino Robot Arm';
  }

  static getDescription() {
    return 'Custom Arduino-based robotic arms with serial communication';
  }

  async connect() {
    try {
      console.log(`Connecting to Arduino robot on ${this.port}...`);
      
      this.serial = new SerialPort(this.port, {
        baudRate: this.config.baudRate || 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      this.parser = this.serial.pipe(new Readline({ delimiter: '\n' }));

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        this.serial.on('open', () => {
          clearTimeout(timeout);
          this.connected = true;
          console.log('Arduino robot connected');
          
          // Listen for responses
          this.parser.on('data', (data) => {
            this.handleResponse(data);
          });
          
          // Send initialization
          setTimeout(() => {
            this.sendCommand('INIT');
            resolve();
          }, 2000); // Wait for Arduino to boot
        });

        this.serial.on('error', (err) => {
          clearTimeout(timeout);
          reject(new Error(`Serial error: ${err.message}`));
        });
      });
    } catch (error) {
      throw new Error(`Failed to connect to Arduino: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.serial && this.serial.isOpen) {
      return new Promise((resolve) => {
        this.serial.close(() => {
          this.connected = false;
          console.log('Arduino robot disconnected');
          resolve();
        });
      });
    }
  }

  async home() {
    console.log('Homing Arduino robot...');
    await this.sendCommand('HOME');
    await this.wait(3000);
    this.updatePosition({ x: 0, y: 0, z: 150, r: 0, j1: 0, j2: 0, j3: 0, j4: 0 });
  }

  async moveCartesian({ x, y, z, r }, speed) {
    this.validateCartesianLimits({ x, y, z, r });
    
    console.log(`Arduino: Moving to X${x} Y${y} Z${z}`);
    
    let command;
    
    switch(this.commandFormat) {
      case 'gcode':
        command = `G1 X${x} Y${y} Z${z} F${speed * 10}`;
        break;
      
      case 'json':
        command = JSON.stringify({
          cmd: 'move',
          x, y, z, r, speed
        });
        break;
      
      case 'simple':
      default:
        command = `MOVE ${x} ${y} ${z} ${r} ${speed}`;
        break;
    }
    
    await this.sendCommand(command);
    this.updatePosition({ x, y, z, r });
    await this.wait(500);
  }

  async moveJoint({ j1, j2, j3, j4, j5, j6 }, speed) {
    this.validateJointLimits({ j1, j2, j3, j4, j5, j6 });
    
    console.log(`Arduino: Moving joints`);
    
    let command;
    
    switch(this.commandFormat) {
      case 'json':
        command = JSON.stringify({
          cmd: 'joint',
          joints: [j1, j2, j3, j4, j5 || 0, j6 || 0],
          speed
        });
        break;
      
      case 'simple':
      default:
        command = `JOINT ${j1} ${j2} ${j3} ${j4} ${speed}`;
        break;
    }
    
    await this.sendCommand(command);
    this.updatePosition({ j1, j2, j3, j4, j5, j6 });
    await this.wait(500);
  }

  async setGripper(state) {
    console.log(`Arduino: Setting gripper ${state ? 'closed' : 'open'}`);
    const command = state ? 'GRIPPER CLOSE' : 'GRIPPER OPEN';
    await this.sendCommand(command);
  }

  async emergencyStop() {
    console.log('Arduino EMERGENCY STOP');
    await this.sendCommand('STOP');
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.serial.isOpen) {
        reject(new Error('Arduino not connected'));
        return;
      }

      console.log('Sending to Arduino:', command);
      
      this.serial.write(command + '\n', (err) => {
        if (err) {
          reject(new Error(`Write error: ${err.message}`));
        } else {
          setTimeout(resolve, 100);
        }
      });
    });
  }

  handleResponse(data) {
    const response = data.trim();
    console.log('Arduino response:', response);
    
    // Parse position updates if Arduino sends them
    if (response.startsWith('POS:')) {
      // Example: "POS:100,200,150,0"
      const coords = response.substring(4).split(',').map(Number);
      if (coords.length >= 4) {
        this.updatePosition({
          x: coords[0],
          y: coords[1],
          z: coords[2],
          r: coords[3]
        });
      }
    }
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ArduinoAdapter;