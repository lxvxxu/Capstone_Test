import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Mic, MicOff, Video, VideoOff, MessageSquare, Activity, RefreshCw, User } from 'lucide-react';

// 가상의 3D 아바타 컴포넌트 (수어 동작을 시각화)
const AvatarDisplay = ({ action }) => {
  let animationClass = "";
  let emoji = "😐"; // 기본 대기 상태

  if (action === "HELLO") {
    animationClass = "animate-bounce";
    emoji = "👋";
  } else if (action === "THANK_YOU") {
    animationClass = "animate-pulse";
    emoji = "🙇";
  } else if (action === "LOVE") {
    animationClass = "animate-ping"; // 하트비트 효과
    emoji = "❤️";
  } else if (action === "YES") {
    animationClass = "animate-bounce";
    emoji = "⭕";
  } else if (action === "NO") {
    animationClass = "animate-shake"; // 좌우 흔들기 (커스텀 필요하지만 bounce로 대체)
    emoji = "❌";
  }

  return (
    <div className={`flex flex-col items-center justify-center h-48 w-full bg-gray-900 rounded-lg border-2 border-indigo-500/50 transition-all duration-300`}>
      <div className={`text-6xl transition-all duration-500 ${animationClass}`}>
        {emoji}
      </div>
      <p className="mt-4 text-white font-mono text-sm">3D Avatar Proxy</p>
      <p className="text-indigo-400 text-xs font-bold mt-1">{action || "Waiting..."}</p>
    </div>
  );
};

export default function SignLanguageBridge() {
  // --- State ---
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  
  // 수어 인식 데이터 (AI 시뮬레이션)
  const [recognizedGesture, setRecognizedGesture] = useState("");
  const [receivedGesture, setReceivedGesture] = useState("");
  const [chatLog, setChatLog] = useState([]);

  // --- Refs for WebRTC ---
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const dataChannel = useRef(null);

  // --- 1. WebRTC Setup (Loopback for Demo) ---
  // 실제 프로젝트에서는 Signaling Server(Socket.io/Stomp)를 통해 SDP를 교환해야 합니다.
  // 여기서는 한 브라우저 내에서 두 개의 PC(PeerConnection)를 만들어 직접 연결합니다.
  
  const startCall = async () => {
    setIsConnecting(true);
    setConnectionStatus("Initializing Media...");

    try {
      // 1. Get User Media (Camera)
      // 데모 환경상 실제 카메라가 없을 경우를 대비해 캔버스로 대체하거나 에러 처리
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => {
        // 카메라 실패시 캔버스로 더미 스트림 생성 (미리보기 환경 대응)
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#333'; ctx.fillRect(0,0,640,480);
        ctx.fillStyle = '#fff'; ctx.font = '30px Arial'; ctx.fillText('Camera Simulator', 200, 240);
        return canvas.captureStream(30);
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      setConnectionStatus("Connecting Peers...");

      // 2. Setup Loopback Peer Connection (Mocking Remote)
      // 실제 구현: pc1 = new RTCPeerConnection(config);
      const pc1 = new RTCPeerConnection(); // Sender (Local)
      const pc2 = new RTCPeerConnection(); // Receiver (Remote)

      peerConnection.current = pc1;

      // 3. Add Ice Candidates
      pc1.onicecandidate = e => e.candidate && pc2.addIceCandidate(e.candidate);
      pc2.onicecandidate = e => e.candidate && pc1.addIceCandidate(e.candidate);

      // 4. Handle Remote Stream
      pc2.ontrack = e => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      // 5. Add Local Tracks to PC1
      stream.getTracks().forEach(track => pc1.addTrack(track, stream));

      // --- 🔥 CORE DIFFERENTIATION: DATA CHANNEL ---
      // 6. Setup Data Channel (The "Metadata" Pipeline)
      const dc = pc1.createDataChannel("sign-language-meta");
      dataChannel.current = dc;

      dc.onopen = () => {
        setConnectionStatus("Connected & DataChannel Open 🟢");
        console.log("Data Channel Open");
      };

      // PC2 handles incoming data channel
      pc2.ondatachannel = (e) => {
        const receiveChannel = e.channel;
        receiveChannel.onmessage = (event) => {
          // Handle incoming AI metadata
          const data = JSON.parse(event.data);
          console.log("Received via WebRTC:", data);
          
          if (data.type === 'GESTURE') {
            setReceivedGesture(data.value);
            setChatLog(prev => [...prev, { role: 'Them', text: `(수어 인식) ${data.value}`, type: 'gesture' }]);
          } else if (data.type === 'TEXT') {
            setChatLog(prev => [...prev, { role: 'Them', text: data.value, type: 'text' }]);
          }
        };
      };

      // 7. Create Offer/Answer
      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);

      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);

      setIsConnecting(false);

    } catch (err) {
      console.error("Setup failed:", err);
      setConnectionStatus("Connection Failed 🔴");
      setIsConnecting(false);
    }
  };

  // --- AI Simulation Logic ---
  // 실제로는 Python AI 서버에서 WebSocket으로 받은 데이터를 여기서 처리합니다.
  const simulateAIDetection = (gestureName) => {
    setRecognizedGesture(gestureName);
    
    // Send via WebRTC Data Channel
    if (dataChannel.current && dataChannel.current.readyState === 'open') {
      const payload = {
        type: 'GESTURE',
        value: gestureName,
        timestamp: Date.now(),
        confidence: 0.98
      };
      dataChannel.current.send(JSON.stringify(payload));
      
      // Log local side
      setChatLog(prev => [...prev, { role: 'Me', text: `(수어 전송) ${gestureName}`, type: 'gesture' }]);
    } else {
      alert("먼저 연결을 시작해주세요!");
    }
  };

  const sendTextMessage = (text) => {
    if (!text) return;
    if (dataChannel.current && dataChannel.current.readyState === 'open') {
      dataChannel.current.send(JSON.stringify({ type: 'TEXT', value: text }));
      setChatLog(prev => [...prev, { role: 'Me', text: text, type: 'text' }]);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (localStream) localStream.getTracks().forEach(track => track.stop());
      if (peerConnection.current) peerConnection.current.close();
    };
  }, []);


  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white font-sans overflow-hidden">
      
      {/* Header */}
      <header className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-lg z-10">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              SignLink Bridge
            </h1>
            <p className="text-xs text-slate-400">AI Multimodal WebRTC Platform</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${connectionStatus.includes("Connected") ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            <div className={`w-2 h-2 rounded-full ${connectionStatus.includes("Connected") ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
            {connectionStatus}
          </div>
          <button 
            onClick={startCall} 
            disabled={connectionStatus.includes("Connected")}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isConnecting ? "animate-spin" : ""}`} />
            {connectionStatus.includes("Connected") ? "Connected" : "Start Session"}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Panel: Signer (Me) */}
        <section className="flex-1 flex flex-col border-r border-slate-700 relative bg-slate-900/50">
          <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded-md text-sm font-bold text-yellow-400 flex items-center gap-2 backdrop-blur-sm">
            <User className="w-4 h-4" /> Me (청각장애인/수어 화자)
          </div>
          
          {/* Video Area */}
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden group">
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
            />
            
            {/* AI Detection Overlay (Simulation) */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-11/12 max-w-md">
               <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-xl border border-slate-600 shadow-2xl">
                 <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                      <Activity className="w-3 h-3" /> AI Gesture Recognition (Sim)
                    </h3>
                    <span className="text-[10px] text-slate-400">MediaPipe v0.10.0 Connected</span>
                 </div>
                 
                 <div className="grid grid-cols-3 gap-2">
                   {['HELLO', 'THANK_YOU', 'LOVE', 'YES', 'NO'].map((gesture) => (
                     <button
                        key={gesture}
                        onClick={() => simulateAIDetection(gesture)}
                        className="bg-slate-700 hover:bg-cyan-600 text-white text-xs py-3 rounded transition-colors font-bold border border-slate-600 hover:border-cyan-400 active:scale-95"
                     >
                       {gesture}
                     </button>
                   ))}
                 </div>
                 <p className="text-[10px] text-center mt-2 text-slate-500">
                   * 클릭하여 AI가 수어를 인식한 상황을 시뮬레이션하세요.
                 </p>
               </div>
            </div>
          </div>
        </section>

        {/* Right Panel: Receiver (Them) */}
        <section className="flex-1 flex flex-col bg-slate-950">
          <div className="absolute top-4 right-4 z-10 bg-black/60 px-3 py-1 rounded-md text-sm font-bold text-green-400 flex items-center gap-2 backdrop-blur-sm">
            Remote (비장애인/수신자) <User className="w-4 h-4" />
          </div>

          {/* Remote Video & Avatar Overlay */}
          <div className="relative flex-1 bg-black flex flex-col items-center justify-center p-4">
            <div className="absolute inset-0 opacity-30">
               {/* Loopback demo: Remote video is just local stream mirrored, but conceptually it's the other person */}
               <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>

            {/* 🔥 The "Multimodal" Output Area */}
            <div className="z-10 w-full max-w-sm space-y-4">
              
              {/* 3D Avatar Representation */}
              <div className="bg-black/40 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-xl">
                <h4 className="text-xs text-gray-400 mb-2 text-center uppercase tracking-widest">Real-time Translation</h4>
                <AvatarDisplay action={receivedGesture} />
              </div>

              {/* Text Translation Stream */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 min-h-[100px] border border-white/5">
                 <h5 className="text-xs text-indigo-300 font-bold mb-2">LIVE TEXT STREAM</h5>
                 <p className="text-lg font-medium text-white animate-fade-in">
                   {receivedGesture ? 
                     `"${receivedGesture === 'HELLO' ? '안녕하세요!' : 
                       receivedGesture === 'THANK_YOU' ? '감사합니다.' : 
                       receivedGesture === 'LOVE' ? '사랑합니다.' : receivedGesture}"` 
                     : <span className="text-gray-500 text-sm italic">Waiting for signal...</span>
                   }
                 </p>
              </div>

            </div>
          </div>

        </section>
      </main>

      {/* Logs / Debugger (Bottom) */}
      <div className="h-48 bg-slate-900 border-t border-slate-800 p-4 overflow-y-auto font-mono text-sm">
        <h4 className="text-xs text-slate-500 font-bold mb-2 sticky top-0 bg-slate-900 pb-2 border-b border-slate-800 w-full">
          SYSTEM LOG & DATA CHANNEL PACKETS
        </h4>
        <div className="space-y-1">
          {chatLog.map((log, idx) => (
             <div key={idx} className={`flex gap-2 ${log.role === 'Me' ? 'text-slate-400' : 'text-green-400 font-bold'}`}>
               <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span>
               <span className="w-12">{log.role}:</span>
               <span>{log.text}</span>
             </div>
          ))}
          {chatLog.length === 0 && <div className="text-slate-600 italic">System ready. Start session to begin logging.</div>}
        </div>
      </div>
    </div>
  );
}
