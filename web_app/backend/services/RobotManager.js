const path = require('path');

class RobotManager {
  constructor() {
    this.currentRobot = null;
    this.robotAdapters = new Map();
    this.isExecuting = false;
    // Initialize a default status structure
    this.status = { 
        connected: false, 
        executing: false, 
        robotType: null,
        position: { x: 0, y: 0, z: 0, r: 0 }
    };
    this.loadAdapters();
  }

  loadAdapters() {
    try {
      console.log('📦 Loading robot adapters...');
      
      // NOTE: These require paths assume the adapter files are in ../adapters/
      const DobotAdapter = require('../adapters/DobotAdapter');
      const UniversalRobotsAdapter = require('../adapters/UniversalRobotsAdapter');
      const ABBAdapter = require('../adapters/ABBAdapter');
      const KUKAAdapter = require('../adapters/KUKAAdapter');
      const ArduinoAdapter = require('../adapters/ArduinoAdapter');
      const CustomAdapter = require('../adapters/CustomAdapter');
      
      // Register adapters - KEY MUST MATCH FRONTEND!
      this.robotAdapters.set('dobot', DobotAdapter);
      this.robotAdapters.set('universal', UniversalRobotsAdapter);
      this.robotAdapters.set('abb', ABBAdapter);
      this.robotAdapters.set('kuka', KUKAAdapter);
      this.robotAdapters.set('arduino', ArduinoAdapter);
      this.robotAdapters.set('custom', CustomAdapter);
      
      console.log(`✅ Loaded ${this.robotAdapters.size} robot adapters:`);
      this.robotAdapters.forEach((adapter, key) => {
        console.log(`   - ${key}: ${adapter.getName ? adapter.getName() : key}`);
      });
    } catch (error) {
      console.error('❌ Error loading adapters:', error.message);
      console.error('   Make sure all adapter files exist in backend/adapters/');
    }
  }

  getAvailableRobotTypes() {
    return Array.from(this.robotAdapters.keys()).map(key => ({
      id: key,
      name: this.robotAdapters.get(key).getName ? this.robotAdapters.get(key).getName() : key,
      description: this.robotAdapters.get(key).getDescription ? 
        this.robotAdapters.get(key).getDescription() : ''
    }));
  }

  async connect(robotType, port, config = {}) {
    console.log('\n🔌 Connection Request:');
    console.log('   Robot Type:', robotType);
    console.log('   Port:', port);
    
    if (this.currentRobot && this.currentRobot.connected) {
      throw new Error('A robot is already connected. Disconnect first.');
    }

    if (!this.robotAdapters.has(robotType)) {
      throw new Error(`Unsupported robot type: ${robotType}. Available: ${Array.from(this.robotAdapters.keys()).join(', ')}`);
    }

    const AdapterClass = this.robotAdapters.get(robotType);
    this.currentRobot = new AdapterClass(port, config);
    
    try {
      await this.currentRobot.connect();
      this.status.connected = true; // Update internal status
      this.status.robotType = robotType;
      console.log(`✅ Successfully connected to ${robotType} robot\n`);
    } catch (error) {
      this.currentRobot = null;
      throw new Error(`Failed to connect: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.currentRobot) {
      try {
        await this.currentRobot.disconnect();
        console.log('🔌 Robot disconnected');
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
      this.currentRobot = null;
    }
    this.status.connected = false;
    this.status.robotType = null;
    this.status.position = { x: 0, y: 0, z: 0, r: 0 };
  }
  
  /**
   * Execute generic commands (like tool control)
   * Called by the /api/command endpoint in server.js.
   */
  async execute(command, params = {}) {
      this.ensureConnected();
      console.log(`🔧 Command Executed: ${command}`, params);
      
      switch (command) {
          case 'tool_activate':
              // Try pen first (for Dobot), then gripper, then generic tool
              if (this.currentRobot.setPen) {
                  await this.currentRobot.setPen(true);
                  return { message: 'Pen activated' };
              } else if (this.currentRobot.setGripper) {
                  await this.currentRobot.setGripper(true);
                  return { message: 'Gripper activated' };
              } else if (this.currentRobot.setTool) {
                  await this.currentRobot.setTool(params.tool || 'pen', true);
                  return { message: `${params.tool || 'tool'} activated` };
              }
              throw new Error(`Current robot adapter does not support tool activation.`);
              
          case 'tool_deactivate':
              // Try pen first (for Dobot), then gripper, then generic tool
              if (this.currentRobot.setPen) {
                  await this.currentRobot.setPen(false);
                  return { message: 'Pen deactivated' };
              } else if (this.currentRobot.setGripper) {
                  await this.currentRobot.setGripper(false);
                  return { message: 'Gripper deactivated' };
              } else if (this.currentRobot.setTool) {
                  await this.currentRobot.setTool(params.tool || 'pen', false);
                  return { message: `${params.tool || 'tool'} deactivated` };
              }
              throw new Error(`Current robot adapter does not support tool deactivation.`);
              
          default:
              // Fallback for custom or unknown commands
              if (this.currentRobot.sendRawCommand) {
                  const result = await this.currentRobot.sendRawCommand(command, params);
                  return { message: `Raw command sent: ${command}`, result };
              }
              throw new Error(`Unknown command: ${command}`);
      }
  }

  getStatus() {
    // Get real-time status from the adapter if connected, otherwise return default
    if (!this.currentRobot) {
      return this.status;
    }
    
    return {
      // Merge connection status with robot-specific status
      ...this.currentRobot.getStatus(),
      connected: this.status.connected, // Keep connection status consistent
      executing: this.isExecuting,
      robotType: this.status.robotType,
    };
  }
  
  getCurrentPosition() {
    if (!this.currentRobot || !this.currentRobot.getCurrentPosition) {
      return { x: 0, y: 0, z: 0, r: 0, j1: 0, j2: 0, j3: 0, j4: 0 };
    }
    return this.currentRobot.getCurrentPosition();
  }

  async home() {
    this.ensureConnected();
    console.log('🏠 Homing robot...');
    const result = await this.currentRobot.home();
    // Update internal position after homing
    if (this.currentRobot.getCurrentPosition) {
        this.status.position = this.currentRobot.getCurrentPosition();
    }
    return result;
  }

  async moveCartesian(coordinates, speed = 50) {
    this.ensureConnected();
    console.log('🎯 Moving to cartesian coordinates:', coordinates);
    const result = await this.currentRobot.moveCartesian(coordinates, speed);
    // Update internal position after move
    if (this.currentRobot.getCurrentPosition) {
        this.status.position = this.currentRobot.getCurrentPosition();
    }
    return result;
  }

  async moveJoint(coordinates, speed = 50) {
    this.ensureConnected();
    console.log('🦾 Moving to joint coordinates:', coordinates);
    return await this.currentRobot.moveJoint(coordinates, speed);
  }

  async setGripper(state) {
    this.ensureConnected();
    console.log('🤏 Setting gripper:', state ? 'closed' : 'open');
    return await this.currentRobot.setGripper(state);
  }

  async executeProgram(program) {
    this.ensureConnected();
    
    if (this.isExecuting) {
      throw new Error('A program is already executing');
    }

    this.isExecuting = true;
    console.log(`▶️  Executing program: ${program.name}`);

    try {
      for (let i = 0; i < program.commands.length; i++) {
        const command = program.commands[i];
        console.log(`   Command ${i + 1}/${program.commands.length}:`, command.type);
        await this.executeCommand(command);
      }
      console.log('✅ Program execution completed');
    } catch (error) {
      console.error('❌ Program execution failed:', error);
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  async executeCommand(command) {
    // Helper function for program execution. Calls specific methods based on type.
    switch (command.type) {
      case 'move':
        await this.moveCartesian(command.params, command.speed || 50);
        break;
      
      case 'moveJoint':
        await this.moveJoint(command.params, command.speed || 50);
        break;
      
      case 'wait':
        await this.wait(command.params.duration || 1000);
        break;
      
      case 'gripper':
        await this.setGripper(command.params.state);
        break;
      
      case 'home':
        await this.home();
        break;
      
      default:
        console.warn(`⚠️  Unknown command type: ${command.type}`);
    }
  }

  async emergencyStop() {
    if (this.currentRobot && this.currentRobot.emergencyStop) {
      console.log('🛑 EMERGENCY STOP ACTIVATED');
      await this.currentRobot.emergencyStop();
      this.isExecuting = false;
    }
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  ensureConnected() {
    if (!this.currentRobot || !this.currentRobot.connected) {
      throw new Error('No robot connected');
    }
  }
  
  // Placeholder methods for network/port scanning (required by server.js)
  async scanNetwork() {
      // In a real app, this would use UDP/TCP scan to find robots on the network.
      console.log('🌐 Simulating network scan...');
      return [
          { ip: '192.168.1.100', name: 'Simulated UR5', type: 'universal' },
          { ip: '192.168.1.101', name: 'Simulated ABB', type: 'abb' },
      ];
  }
  
  async scanPorts() {
      // This is handled directly in server.js using serialport.
      // This is kept here for consistency, but the server.js implementation is preferred.
      return [];
  }
}

module.exports = RobotManager;