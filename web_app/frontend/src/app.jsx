// frontend/src/App.js (or App.jsx)
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, ChevronRight, RotateCw, Square, Activity } from 'lucide-react';

const API_URL = "http://localhost:3001/api"; // NOTE: backend port 3001

export default function App() {
  const [connected, setConnected] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState('ip'); // 'ip' or 'com'
  const [robotType, setRobotType] = useState("dobot");
  const [ipAddress, setIpAddress] = useState("192.168.1.100");
  const [comPort, setComPort] = useState("");
  const [availablePorts, setAvailablePorts] = useState([]);
  const [status, setStatus] = useState("idle");
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0, r: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [discoveredRobots, setDiscoveredRobots] = useState([]);
  const [tool, setTool] = useState("none");

  const addLog = (message, type = "info") => {
    setLogs(prev => [...prev.slice(-9), { message, type, time: new Date().toLocaleTimeString() }]);
  };

  // fetch available COM ports from backend
  const scanComPorts = async () => {
    setLoading(true);
    addLog("Scanning COM ports...", "info");
    try {
      const res = await fetch(`${API_URL}/ports`);
      const data = await res.json();
      setAvailablePorts(data.ports || []);
      if ((data.ports || []).length > 0) {
        setComPort(data.ports[0].path);
        addLog(`Found ${data.ports.length} COM port(s)`, "success");
      } else {
        addLog("No COM ports found", "error");
      }
    } catch (err) {
      addLog("COM scan failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // network robot scan (existing)
  const scanForRobots = async () => {
    setLoading(true);
    addLog("Scanning network for robots...", "info");
    try {
      const response = await fetch(`${API_URL}/robots/scan`, { method: "POST" });
      const data = await response.json();
      if (data.success && data.robots.length > 0) {
        setDiscoveredRobots(data.robots);
        addLog(`Found ${data.robots.length} robot(s)`, "success");
        // optionally auto-select first
        setIpAddress(data.robots[0].ip);
        if (data.robots[0].type) setRobotType(data.robots[0].type);
      } else {
        addLog("No robots found on network", "error");
      }
    } catch (err) {
      addLog("Scan failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // connect (now sends connectionMethod and comPort/ipAddress)
  const connectRobot = async () => {
    setLoading(true);
    try {
      const payload = {
        robotType,
        // If IP is active, send ipAddress value and comPort: null.
        // If COM is active, send comPort value and ipAddress: null.
        ipAddress: connectionMethod === 'ip' ? ipAddress : null, 
        comPort: connectionMethod === 'com' ? comPort : null,   
      };
      const response = await fetch(`${API_URL}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        setConnected(true);
        setStatus('connected');
        addLog(`Connected to ${robotType} via ${connectionMethod === 'ip' ? ipAddress : comPort}`, 'success');
      } else {
        addLog(`Connection failed: ${data.error}`, 'error');
      }
    } catch (error) {
      addLog(`Connection error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const disconnectRobot = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/disconnect`, { method: "POST" });
      if (response.ok) {
        setConnected(false);
        setStatus('idle');
        setPosition({ x:0,y:0,z:0,r:0 });
        addLog('Disconnected from robot', 'info');
      }
    } catch (err) {
      addLog('Disconnect error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: Generic command sender (for tool control only)
  const sendCommand = async (command, params = {}) => {
    if (!connected) { 
      addLog('Please connect to robot first','error'); 
      return; 
    }
    try {
      const res = await fetch(`${API_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, params })
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`Executed: ${command}`, 'success');
      } else {
        addLog(`Command failed: ${data.error}`, 'error');
      }
    } catch (err) { 
      addLog('Command error: ' + err.message, 'error'); 
    }
  };

  // ✅ FIX: Move robot using dedicated /api/move endpoint
  const moveRobot = async (axis, direction) => {
    if (!connected) { 
      addLog('Please connect to robot first','error'); 
      return; 
    }
    
    try {
      const res = await fetch(`${API_URL}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          axis: axis.toLowerCase(), 
          direction: direction === 'positive' ? '+' : '-',
          distance: 10 
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        addLog(`Moved ${axis.toUpperCase()}${direction === 'positive' ? '+' : '-'}`, 'success');
        // Update position from server response
        if (data.position) {
          setPosition(data.position);
        }
      } else {
        addLog(`Move failed: ${data.error}`, 'error');
      }
    } catch (err) { 
      addLog('Move error: ' + err.message, 'error'); 
    }
  };

  // ✅ FIX: Home robot using dedicated /api/home endpoint
  const homeRobot = async () => { 
    if (!connected) { 
      addLog('Please connect to robot first','error'); 
      return; 
    }
    
    try {
      const res = await fetch(`${API_URL}/home`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (res.ok) {
        addLog('Homing complete', 'success');
        // Update position from server response
        if (data.position) {
          setPosition(data.position);
        } else {
          setPosition({ x: 200, y: 0, z: 150, r: 0 }); // Default home position
        }
      } else {
        addLog(`Home failed: ${data.error}`, 'error');
      }
    } catch (err) { 
      addLog('Home error: ' + err.message, 'error'); 
    }
  };

  // ✅ FIX: Stop robot using dedicated /api/stop endpoint
  const stopRobot = async () => { 
    if (!connected) { 
      addLog('Please connect to robot first','error'); 
      return; 
    }
    
    try {
      const res = await fetch(`${API_URL}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (res.ok) {
        addLog('Emergency stop executed', 'success');
        setStatus('stopped');
      } else {
        addLog(`Stop failed: ${data.error}`, 'error');
      }
    } catch (err) { 
      addLog('Stop error: ' + err.message, 'error'); 
    }
  };

  // tool activation - these use the /api/command endpoint correctly
  const activateTool = async () => { 
    await sendCommand('tool_activate', { tool }); 
  };
  
  const deactivateTool = async () => { 
    await sendCommand('tool_deactivate', { tool }); 
  };

  // optionally scan COM ports on mount
  useEffect(() => {
    // only scan ports if user chooses COM method or on user request
    // scanComPorts();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Robot Control Center</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h2 className="text-xl mb-3">Connection</h2>

              {/* Connection method toggle */}
              <div className="flex gap-2 mb-3">
                <button onClick={() => setConnectionMethod('ip')}
                        className={`px-3 py-2 rounded ${connectionMethod==='ip' ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                  IP
                </button>
                <button onClick={() => setConnectionMethod('com')}
                        className={`px-3 py-2 rounded ${connectionMethod==='com' ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                  COM
                </button>
              </div>

              {/* show IP input or COM selector */}
              {connectionMethod === 'ip' ? (
                <>
                  <label className="block text-sm">IP Address</label>
                  <input value={ipAddress} onChange={(e)=>setIpAddress(e.target.value)} className="w-full bg-slate-700 px-3 py-2 rounded mb-3" />
                  <button onClick={scanForRobots} className="bg-slate-700 px-3 py-2 rounded mb-3">Scan Network</button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm">COM Port</label>
                    <button onClick={scanComPorts} className="ml-auto bg-slate-700 px-3 py-1 rounded">Scan COM</button>
                  </div>
                  <select value={comPort} onChange={(e)=>setComPort(e.target.value)} className="w-full bg-slate-700 px-3 py-2 rounded mb-3">
                    <option value="">-- choose COM port --</option>
                    {availablePorts.map((p,i) => <option key={i} value={p.path}>{p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}</option>)}
                  </select>
                </>
              )}

              {/* Robot type */}
              <label className="block text-sm">Robot Type</label>
              <select value={robotType} onChange={(e)=>setRobotType(e.target.value)} className="w-full bg-slate-700 px-3 py-2 rounded mb-3">
                <option value="dobot">Dobot</option>
                <option value="universal">Universal Robots</option>
                <option value="custom">Custom Robot</option>
                {discoveredRobots.map((r,i) => <option key={i} value={r.type || r.ip}>{r.name || r.ip} ({r.ip})</option>)}
              </select>

              {!connected ? (
                <button onClick={connectRobot} className="w-full bg-blue-600 py-2 rounded">Connect</button>
              ) : (
                <button onClick={disconnectRobot} className="w-full bg-red-600 py-2 rounded">Disconnect</button>
              )}
            </div>

            {/* status */}
            <div className="bg-slate-800 p-6 rounded border">
              <h2 className="text-lg">Status</h2>
              <p>Mode: <b>{status}</b></p>
              <p>X: {position.x} mm</p>
              <p>Y: {position.y} mm</p>
              <p>Z: {position.z} mm</p>
              <p>R: {position.r} °</p>
            </div>
          </div>

          {/* Controls & Tools (same as before) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800 p-6 rounded border">
              <h2 className="text-xl mb-4">Movement Controls</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3>X Axis</h3>
                  <div className="flex gap-2 mt-2">
                    <button onClick={()=>moveRobot('x','negative')} className="bg-slate-700 px-3 py-2 rounded">X-</button>
                    <button onClick={()=>moveRobot('x','positive')} className="bg-slate-700 px-3 py-2 rounded">X+</button>
                  </div>
                </div>
                <div>
                  <h3>Y Axis</h3>
                  <div className="flex gap-2 mt-2">
                    <button onClick={()=>moveRobot('y','negative')} className="bg-slate-700 px-3 py-2 rounded">Y-</button>
                    <button onClick={()=>moveRobot('y','positive')} className="bg-slate-700 px-3 py-2 rounded">Y+</button>
                  </div>
                </div>
                <div>
                  <h3>Z Axis</h3>
                  <div className="flex gap-2 mt-2">
                    <button onClick={()=>moveRobot('z','negative')} className="bg-slate-700 px-3 py-2 rounded">Z-</button>
                    <button onClick={()=>moveRobot('z','positive')} className="bg-slate-700 px-3 py-2 rounded">Z+</button>
                  </div>
                </div>
                <div>
                  <h3>Rotation</h3>
                  <div className="flex gap-2 mt-2">
                    <button onClick={()=>moveRobot('r','negative')} className="bg-slate-700 px-3 py-2 rounded">R-</button>
                    <button onClick={()=>moveRobot('r','positive')} className="bg-slate-700 px-3 py-2 rounded">R+</button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={homeRobot} className="bg-purple-600 px-4 py-2 rounded">Home</button>
                <button onClick={stopRobot} className="bg-red-600 px-4 py-2 rounded">Stop</button>
              </div>
            </div>

            <div className="bg-slate-800 p-6 rounded border">
              <h2 className="text-xl mb-4">Tool Controls</h2>
              <label className="block text-sm mb-2">Tool</label>
              <select value={tool} onChange={(e)=>setTool(e.target.value)} className="bg-slate-700 px-3 py-2 rounded mb-4">
                <option value="none">None</option>
                <option value="suction">Suction</option>
                <option value="gripper">Gripper</option>
                <option value="pen">Pen Holder</option>
                <option value="3dprint">3D Print</option>
                <option value="laser">Laser</option>
                <option value="solder">Solder</option>
              </select>

              {tool === 'none' ? <p>No tool selected</p> : (
                <div className="flex gap-3">
                  <button onClick={activateTool} className="bg-green-600 px-4 py-2 rounded">Activate {tool}</button>
                  <button onClick={deactivateTool} className="bg-red-600 px-4 py-2 rounded">Deactivate {tool}</button>
                </div>
              )}
            </div>

            <div className="bg-slate-800 p-6 rounded border">
              <h2 className="text-xl mb-4">Activity Log</h2>
              <div className="max-h-64 overflow-y-auto space-y-2 text-sm">
                {logs.map((l,i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-xs text-slate-500">{l.time}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                    <span className={l.type==='error' ? 'text-red-400' : l.type==='success' ? 'text-green-400' : 'text-slate-300'}>
                      {l.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}