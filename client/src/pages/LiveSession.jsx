import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  LogOut, 
  Send, 
  Users, 
  MessageSquare, 
  Radio, 
  ShieldAlert, 
  RefreshCw,
  Film,
  Disc
} from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function LiveSession({ sessionId, onLeave }) {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Media States
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // VOD Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [isUploadingVod, setIsUploadingVod] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Chat & Socket States
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [connectedPeersCount, setConnectedPeersCount] = useState(1);
  const [connectionState, setConnectionState] = useState('connecting'); // connecting, connected, reconnecting, disconnected

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const chatBottomRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef({}); // socketId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef({}); // socketId -> RTCIceCandidate[]

  // Timer tick during recording
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingSec(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadVodBlob = async (blob, durationSec) => {
    setIsUploadingVod(true);
    try {
      const token = localStorage.getItem('classhub_access_token');
      const formData = new FormData();
      formData.append('video', blob, `session-${sessionId}-${Date.now()}.webm`);
      formData.append('durationSec', durationSec || 1);

      const res = await fetch(`/api/sessions/${sessionId}/recordings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to upload VOD recording');
      }

      return true;
    } catch (err) {
      console.error('VOD upload error:', err);
      return false;
    } finally {
      setIsUploadingVod(false);
    }
  };

  const startRecordingStream = (customStream) => {
    const stream = customStream || localStreamRef.current || localStream;
    if (!stream) {
      console.warn('Local media stream is not active to record.');
      return false;
    }

    try {
      recordedChunksRef.current = [];
      let options;
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          options = { mimeType: 'video/webm;codecs=vp8,opus' };
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          options = { mimeType: 'video/webm' };
        }
      }

      let recorder;
      try {
        recorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(); // Continuous smooth recording without timeslices to ensure clear audio sync
      setIsRecording(true);
      setRecordingSec(0);
      return true;
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      return false;
    }
  };

  const stopRecordingStream = () => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        setIsRecording(false);
        const mime = recorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        resolve(blob);
      };

      try {
        recorder.stop();
      } catch (e) {
        setIsRecording(false);
        resolve(null);
      }
    });
  };

  const stopAllMediaTracks = () => {
    // 1. Stop MediaRecorder if running
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }

    // 2. Unbind video elements and stop hardware tracks
    if (localVideoRef.current) {
      if (localVideoRef.current.srcObject) {
        const s = localVideoRef.current.srcObject;
        if (s.getTracks) s.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
      }
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject) {
        const s = remoteVideoRef.current.srcObject;
        if (s.getTracks) s.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
      }
      remoteVideoRef.current.srcObject = null;
    }

    // 3. Stop local stream tracks explicitly
    const stream = localStreamRef.current || localStream;
    if (stream && stream.getTracks) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
    }

    localStreamRef.current = null;
    setLocalStream(null);
  };

  const handleEndSessionAndSaveVod = async () => {
    try {
      setIsUploadingVod(true);
      let blob = null;
      let duration = recordingSec;

      if (isRecording) {
        blob = await stopRecordingStream();
      }

      if (blob && blob.size > 0) {
        await uploadVodBlob(blob, duration);
      }

      stopAllMediaTracks();
      await apiRequest(`/api/sessions/${sessionId}/end`, { method: 'POST' });
      if (onLeave) onLeave();
    } catch (err) {
      alert(err.message || 'Failed to end session');
    } finally {
      setIsUploadingVod(false);
    }
  };

  // Auto-play remote stream on video element when received
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => console.log('Autoplay play error:', err));
    }
  }, [remoteStream]);

  // Load Session Info & History Chat
  useEffect(() => {
    async function initSession() {
      try {
        const sessionRes = await apiRequest(`/api/sessions/${sessionId}`);
        setSession(sessionRes.session);

        const chatRes = await apiRequest(`/api/sessions/${sessionId}/chat`);
        setMessages(chatRes.messages || []);
      } catch (err) {
        setError(err.message || 'Failed to load session');
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, [sessionId]);

  // Helper: Flush queued ICE candidates when remote description is ready
  const processPendingCandidates = async (socketId, pc) => {
    if (pendingCandidatesRef.current[socketId]) {
      const candidates = pendingCandidatesRef.current[socketId];
      delete pendingCandidatesRef.current[socketId];
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding queued ICE candidate:', err);
        }
      }
    }
  };

  // Initialize Media Stream & Socket Signaling Connection
  useEffect(() => {
    if (!session) return;

    let localMediaStream = null;
    const token = localStorage.getItem('classhub_access_token');

    async function startMediaAndSocket() {
      try {
        // If Instructor, capture local webcam/mic and auto-start recording
        if (session.isInstructor) {
          localMediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setLocalStream(localMediaStream);
          localStreamRef.current = localMediaStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localMediaStream;
          }
          // Auto-start stream recording for instant VOD creation
          setTimeout(() => {
            startRecordingStream(localMediaStream);
          }, 500);
        }

        // Initialize Socket.IO connection (target backend explicitly or fallback to proxy)
        const socketUrl = import.meta.env.VITE_SOCKET_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);
        const socket = io(socketUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          setConnectionState('connected');
          socket.emit('join-room', { sessionId });
        });

        socket.on('connect_error', (err) => {
          console.error('Socket connection error:', err.message);
          setConnectionState('disconnected');
          setError(`Signaling connection error: ${err.message}`);
        });

        socket.on('disconnect', () => {
          setConnectionState('reconnecting');
        });

        // Authoritative Room User Count from Server
        socket.on('room-user-count', ({ count }) => {
          if (typeof count === 'number' && count > 0) {
            setConnectedPeersCount(count);
          }
        });

        // Broadcast notification when live session is ended by instructor reload or disconnect
        socket.on('session-ended', ({ reason }) => {
          stopAllMediaTracks();
          if (onLeave) onLeave();
        });

        // Room Peers Notification (existing users when we join)
        socket.on('room-peers', ({ peers }) => {
          setConnectedPeersCount(peers.length + 1);
          if (session.isInstructor) {
            const stream = localStreamRef.current || localMediaStream;
            peers.forEach(peer => createPeerConnection(peer.socketId, stream));
          }
        });

        // New User Joined Notification
        socket.on('user-joined', ({ socketId }) => {
          if (session.isInstructor) {
            const stream = localStreamRef.current || localMediaStream;
            createPeerConnection(socketId, stream);
          }
        });

        // Receive SDP Offer (Student side)
        socket.on('receive-offer', async ({ senderSocketId, sdp }) => {
          const pc = createStudentPeerConnection(senderSocketId);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await processPendingCandidates(senderSocketId, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal-answer', { targetSocketId: senderSocketId, sdp: answer });
        });

        // Receive SDP Answer (Instructor side)
        socket.on('receive-answer', async ({ senderSocketId, sdp }) => {
          const pc = peerConnectionsRef.current[senderSocketId];
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await processPendingCandidates(senderSocketId, pc);
          }
        });

        // Receive ICE Candidate
        socket.on('receive-candidate', async ({ senderSocketId, candidate }) => {
          const pc = peerConnectionsRef.current[senderSocketId];
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error('Error adding ICE candidate:', e);
            }
          } else {
            if (!pendingCandidatesRef.current[senderSocketId]) {
              pendingCandidatesRef.current[senderSocketId] = [];
            }
            pendingCandidatesRef.current[senderSocketId].push(candidate);
          }
        });

        // Real-Time Chat Received
        socket.on('receive-chat', (newMsg) => {
          setMessages(prev => [...prev, newMsg]);
        });

        // User Disconnected
        socket.on('user-left', ({ socketId }) => {
          setConnectedPeersCount(prev => Math.max(1, prev - 1));
          if (peerConnectionsRef.current[socketId]) {
            peerConnectionsRef.current[socketId].close();
            delete peerConnectionsRef.current[socketId];
          }
          delete pendingCandidatesRef.current[socketId];
        });

      } catch (err) {
        console.error('Media/Socket initialization error:', err);
        setError('Could not access media devices or signaling server. Please check camera/mic permissions.');
      }
    }

    startMediaAndSocket();

    return () => {
      // Cleanup camera/mic media tracks, peer connections, and sockets on unmount
      if (localMediaStream) {
        localMediaStream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
      }
      stopAllMediaTracks();
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [session]);

  // Helper: Create PeerConnection for Instructor sending stream
  const createPeerConnection = async (targetSocketId, stream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[targetSocketId] = pc;

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    // Connection Recovery & Reconnect handling
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn(`ICE state ${pc.iceConnectionState} for peer ${targetSocketId}, attempting restart...`);
        pc.restartIce();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (socketRef.current) {
      socketRef.current.emit('signal-offer', { targetSocketId, sdp: offer });
    }
    return pc;
  };

  // Helper: Create PeerConnection for Student receiving stream
  const createStudentPeerConnection = (senderSocketId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[senderSocketId] = pc;

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch((err) => console.log('Autoplay play error:', err));
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          targetSocketId: senderSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn(`Student ICE state ${pc.iceConnectionState}, attempting restart...`);
        pc.restartIce();
      }
    };

    return pc;
  };

  // Toggle Microphone
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMicOn;
      });
      setIsMicOn(!isMicOn);
    }
  };

  // Toggle Camera
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOn;
      });
      setIsVideoOn(!isVideoOn);
    }
  };

  // Toggle Screen Share (Instructor)
  const toggleScreenShare = async () => {
    if (!session?.isInstructor) return;
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const videoTrack = screenStream.getVideoTracks()[0];

        // Replace video track on all peer connections
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });

        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        setIsScreenSharing(true);

        videoTrack.onended = () => {
          revertToCameraStream();
        };
      } else {
        revertToCameraStream();
      }
    } catch (err) {
      console.error('Screen sharing error:', err);
    }
  };

  const revertToCameraStream = () => {
    if (localStream) {
      const cameraVideoTrack = localStream.getVideoTracks()[0];
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && cameraVideoTrack) sender.replaceTrack(cameraVideoTrack);
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
    }
    setIsScreenSharing(false);
  };

  // Send Chat Message
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current) return;
    socketRef.current.emit('send-chat', {
      sessionId,
      content: chatInput
    });
    setChatInput('');
  };

  // Scroll to bottom of chat when new message arrives
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // End Session (Instructor action)
  const handleEndSession = async () => {
    try {
      await apiRequest(`/api/sessions/${sessionId}/end`, { method: 'POST' });
      if (onLeave) onLeave();
    } catch (err) {
      alert(err.message || 'Failed to end session');
    }
  };

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading live classroom environment...</div>;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 340px',
      height: 'calc(100vh - 70px)',
      background: 'var(--bg-dark)'
    }} className="animate-fade-in">
      
      {/* Left Column: Stage & Video Controls */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
        background: '#04070d'
      }}>
        {/* Top Session Title Bar */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(17, 24, 39, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(244, 63, 94, 0.15)',
              color: '#f43f5e',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              <Radio size={14} className="animate-pulse" /> LIVE STREAM
            </span>

            {isRecording && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: 'rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                <Disc size={14} className="animate-pulse" /> REC {formatTimer(recordingSec)}
              </span>
            )}

            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{session?.title}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} color="var(--accent-primary)" /> {connectedPeersCount} Online
            </span>
            
            {session?.isInstructor ? (
              <button 
                onClick={handleEndSessionAndSaveVod} 
                disabled={isUploadingVod}
                className="btn btn-danger" 
                style={{ padding: '6px 14px', fontSize: '0.85rem', gap: '6px' }}
              >
                <LogOut size={16} /> {isUploadingVod ? 'Ending & Saving VOD...' : 'End Live Stream'}
              </button>
            ) : (
              <button onClick={onLeave} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                <LogOut size={16} /> Leave Room
              </button>
            )}
          </div>
        </div>

        {/* Video Player Stage */}
        <div style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: '#000'
        }}>
          {session?.isInstructor ? (
            // Instructor local video stream
            <video 
              ref={localVideoRef}
              autoPlay 
              playsInline 
              muted 
              style={{
                width: '100%',
                maxHeight: '100%',
                borderRadius: '12px',
                objectFit: 'contain',
                background: '#111827',
                boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
              }}
            />
          ) : (
            // Student receiving remote video stream
            remoteStream ? (
              <video 
                ref={remoteVideoRef}
                autoPlay 
                playsInline 
                style={{
                  width: '100%',
                  maxHeight: '100%',
                  borderRadius: '12px',
                  objectFit: 'contain',
                  background: '#111827',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <Video size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <h3>Waiting for Instructor's Live Stream...</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>WebRTC Peer connection is negotiating via Socket.IO signaling</p>
              </div>
            )
          )}

          {/* Reconnect / Connection Status Badge */}
          {connectionState !== 'connected' && (
            <div style={{
              position: 'absolute',
              top: '36px',
              left: '36px',
              background: 'rgba(245, 158, 11, 0.9)',
              color: '#000',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <RefreshCw size={14} className="spin" /> Reconnecting signal...
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div style={{
          padding: '16px 24px',
          background: 'rgba(17, 24, 39, 0.8)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}>
          {session?.isInstructor && (
            <>
              <button 
                onClick={toggleMic} 
                className={`btn ${isMicOn ? 'btn-secondary' : 'btn-danger'}`}
                style={{ borderRadius: '50%', width: '44px', height: '44px', padding: 0 }}
                title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>

              <button 
                onClick={toggleVideo} 
                className={`btn ${isVideoOn ? 'btn-secondary' : 'btn-danger'}`}
                style={{ borderRadius: '50%', width: '44px', height: '44px', padding: 0 }}
                title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
              </button>

              <button 
                onClick={toggleScreenShare} 
                className={`btn ${isScreenSharing ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '50%', width: '44px', height: '44px', padding: 0 }}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                <Monitor size={20} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right Column: Persisted Real-Time Live Chat */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-card)',
        height: '100%'
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '1rem'
        }}>
          <MessageSquare size={18} color="var(--accent-primary)" /> Live Classroom Chat
        </div>

        {/* Message Feed */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '40px' }}>
              No messages yet. Say hello to the class!
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              const isInstructorMsg = msg.sender?.role === 'INSTRUCTOR';
              return (
                <div key={msg.id || Math.random()} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '4px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                  }}>
                    <span style={{ fontWeight: 600, color: isMe ? '#a5b4fc' : '#f3f4f6' }}>
                      {msg.sender?.name || 'User'}
                    </span>
                    {isInstructorMsg && (
                      <span className="badge badge-instructor" style={{ fontSize: '0.6rem', padding: '0px 4px' }}>
                        Instructor
                      </span>
                    )}
                  </div>

                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    maxWidth: '85%',
                    lineHeight: '1.4',
                    background: isMe 
                      ? 'var(--accent-gradient)' 
                      : (isInstructorMsg ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-input)'),
                    color: '#fff',
                    border: !isMe && isInstructorMsg ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-color)'
                  }}>
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat Input Bar */}
        <form onSubmit={handleSendChat} style={{
          padding: '14px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px'
        }}>
          <input 
            type="text"
            className="form-input"
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            style={{ borderRadius: '20px', fontSize: '0.875rem' }}
          />
          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, flexShrink: 0 }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>

    </div>
  );
}
