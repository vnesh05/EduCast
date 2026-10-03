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
  RefreshCw
} from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
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
  const [isStudentMuted, setIsStudentMuted] = useState(false);

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
  const remoteStreamRef = useRef(null);
  const pendingCandidatesRef = useRef({}); // socketId -> RTCIceCandidate[]

  const stopAllMediaTracks = () => {
    // 1. Unbind video elements and stop hardware tracks
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

    // 2. Stop local stream tracks explicitly
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

  const handleEndSession = async () => {
    try {
      stopAllMediaTracks();
      await apiRequest(`/api/sessions/${sessionId}/end`, { method: 'POST' });
      if (onLeave) onLeave();
    } catch (err) {
      alert(err.message || 'Failed to end session');
    }
  };

  // Auto-play remote stream on video element when received with autoplay policy fallback
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => {
        console.warn('Autoplay prevented in useEffect, muting to allow instant playback:', err);
        setIsStudentMuted(true);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.muted = true;
          remoteVideoRef.current.play().catch(e => console.error('Play retry error:', e));
        }
      });
    }
  }, [remoteStream]);

  // Load Session Info & History Chat with cancellation and deduplication
  useEffect(() => {
    let active = true;
    async function initSession() {
      try {
        const sessionRes = await apiRequest(`/api/sessions/${sessionId}`);
        if (!active) return;
        setSession(sessionRes.session);

        const chatRes = await apiRequest(`/api/sessions/${sessionId}/chat`);
        if (!active) return;
        if (chatRes.messages) {
          setMessages(prev => {
            const map = new Map();
            chatRes.messages.forEach(m => map.set(m.id, m));
            prev.forEach(m => map.set(m.id, m));
            return Array.from(map.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          });
        }
      } catch (err) {
        if (active) setError(err.message || 'Failed to load session');
      } finally {
        if (active) setLoading(false);
      }
    }
    initSession();
    return () => {
      active = false;
    };
  }, [sessionId]);

  // Student Attendance & Watch-Time Tracking
  useEffect(() => {
    if (!session || session.isInstructor) return;

    // Initial check-in ping
    apiRequest(`/api/sessions/${sessionId}/attendance`, {
      method: 'POST',
      body: JSON.stringify({ durationSeconds: 10 })
    }).catch(() => {});

    // Periodic attendance interval
    const interval = setInterval(async () => {
      try {
        await apiRequest(`/api/sessions/${sessionId}/attendance`, {
          method: 'POST',
          body: JSON.stringify({ durationSeconds: 30 })
        });
      } catch (e) {
        console.warn('Attendance ping error:', e.message);
      }
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [session, sessionId]);

  // Helper: Flush queued ICE candidates when remote description is ready
  const processPendingCandidates = async (socketId, pc) => {
    if (pendingCandidatesRef.current[socketId]) {
      const candidates = pendingCandidatesRef.current[socketId];
      delete pendingCandidatesRef.current[socketId];
      for (const candidate of candidates) {
        try {
          if (candidate && (candidate.candidate || candidate.sdpMid !== undefined)) {
            await pc.addIceCandidate(candidate);
          }
        } catch (err) {
          console.warn('Queued ICE candidate warning:', err);
        }
      }
    }
  };

  // Helper for student to explicitly request or re-request live stream from instructor
  const handleRequestStream = () => {
    if (socketRef.current && !session?.isInstructor) {
      console.log('🔄 Requesting instructor live stream from room...');
      socketRef.current.emit('request-stream', { sessionId });
    }
  };

  // Student auto-retry: If connected and stream not received after 2.5 seconds, ping for stream
  useEffect(() => {
    if (session && !session.isInstructor && !remoteStream && connectionState === 'connected') {
      const timer = setTimeout(() => {
        handleRequestStream();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [session, remoteStream, connectionState]);

  // Initialize Media Stream & Socket Signaling Connection
  useEffect(() => {
    if (!session) return;

    let isCancelled = false;
    let localMediaStream = null;
    let socketInstance = null;
    const token = localStorage.getItem('classhub_access_token');

    async function startMediaAndSocket() {
      // 1. If Instructor, capture local webcam/mic with graceful fallback
      if (session.isInstructor) {
        try {
          localMediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (mediaErr) {
          console.warn('Could not acquire both video and audio, falling back to video only or audio only:', mediaErr);
          try {
            localMediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (vErr) {
            try {
              localMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (aErr) {
              console.warn('Could not access camera or microphone:', aErr);
            }
          }
        }

        // If unmounted or cancelled while awaiting media stream, stop tracks and abort immediately!
        if (isCancelled) {
          if (localMediaStream) {
            localMediaStream.getTracks().forEach(track => {
              try { track.stop(); } catch (e) {}
            });
          }
          return;
        }

        if (localMediaStream) {
          setLocalStream(localMediaStream);
          localStreamRef.current = localMediaStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localMediaStream;
          }
        }
      }

      if (isCancelled) return;

      // Disconnect any lingering socket from a previous render
      if (socketRef.current) {
        try {
          socketRef.current.off('receive-chat');
          socketRef.current.disconnect();
          socketRef.current = null;
        } catch (e) {}
      }

      // 2. Initialize Socket.IO Signaling Connection
      try {
        const socketUrl = import.meta.env.VITE_SOCKET_URL || 
          (window.location.port === '5173' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:5000' 
            : window.location.origin);

        const socket = io(socketUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000
        });
        socketInstance = socket;
        socketRef.current = socket;

        socket.on('connect', () => {
          if (isCancelled) {
            socket.disconnect();
            return;
          }
          setConnectionState('connected');
          socket.emit('join-room', { sessionId });
          // If Student, request live stream immediately upon connection
          if (!session.isInstructor) {
            socket.emit('request-stream', { sessionId });
          }
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

        // Broadcast notification when live session is ended by instructor
        socket.on('session-ended', ({ reason }) => {
          stopAllMediaTracks();
          if (onLeave) onLeave();
        });

        // Room Peers Notification (existing users when we join)
        socket.on('room-peers', ({ peers }) => {
          setConnectedPeersCount(peers.length + 1);
          if (session.isInstructor) {
            const stream = localStreamRef.current || localMediaStream;
            if (stream) {
              peers.forEach(peer => createPeerConnection(peer.socketId, stream));
            }
          }
        });

        // New User Joined Notification
        socket.on('user-joined', ({ socketId }) => {
          if (session.isInstructor) {
            const stream = localStreamRef.current || localMediaStream;
            if (stream) {
              createPeerConnection(socketId, stream);
            }
          }
        });

        // Student Requests Stream from Instructor
        socket.on('request-stream', ({ studentSocketId }) => {
          if (session.isInstructor) {
            console.log('📡 Instructor received request-stream from student:', studentSocketId);
            const stream = localStreamRef.current || localMediaStream;
            if (stream) {
              createPeerConnection(studentSocketId, stream);
            }
          }
        });

        // Receive SDP Offer (Student side)
        socket.on('receive-offer', async ({ senderSocketId, sdp }) => {
          try {
            console.log('📥 Student received SDP offer from instructor:', senderSocketId);
            const pc = createStudentPeerConnection(senderSocketId);
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await processPendingCandidates(senderSocketId, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('signal-answer', { targetSocketId: senderSocketId, sdp: answer });
            console.log('📤 Student sent SDP answer to instructor');
          } catch (offerErr) {
            console.error('Error handling received offer:', offerErr);
          }
        });

        // Receive SDP Answer (Instructor side)
        socket.on('receive-answer', async ({ senderSocketId, sdp }) => {
          try {
            console.log('📥 Instructor received SDP answer from student:', senderSocketId);
            const pc = peerConnectionsRef.current[senderSocketId];
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));
              await processPendingCandidates(senderSocketId, pc);
            }
          } catch (ansErr) {
            console.error('Error handling received answer:', ansErr);
          }
        });

        // Receive ICE Candidate
        socket.on('receive-candidate', async ({ senderSocketId, candidate }) => {
          if (!candidate) return;
          const pc = peerConnectionsRef.current[senderSocketId];
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              if (candidate.candidate || candidate.sdpMid !== undefined) {
                await pc.addIceCandidate(candidate);
              }
            } catch (e) {
              console.warn('Error adding ICE candidate:', e);
            }
          } else {
            if (!pendingCandidatesRef.current[senderSocketId]) {
              pendingCandidatesRef.current[senderSocketId] = [];
            }
            pendingCandidatesRef.current[senderSocketId].push(candidate);
          }
        });

        // Real-Time Chat Received (with strict ID deduplication)
        socket.on('receive-chat', (newMsg) => {
          if (!newMsg || !newMsg.id) return;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) {
              return prev; // Ignore duplicate
            }
            return [...prev, newMsg];
          });
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
      isCancelled = true;
      if (socketInstance) {
        socketInstance.off('receive-chat');
        socketInstance.disconnect();
      }
      if (socketRef.current) {
        socketRef.current.off('receive-chat');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (localMediaStream) {
        localMediaStream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
      }
      stopAllMediaTracks();
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};
    };
  }, [session]);

  // Helper: Create PeerConnection for Instructor sending stream
  const createPeerConnection = async (targetSocketId, stream) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      try {
        peerConnectionsRef.current[targetSocketId].close();
      } catch (e) {}
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[targetSocketId] = pc;

    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          pc.addTrack(track, stream);
        } catch (e) {
          console.warn('Error adding track to peer connection:', e);
        }
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          targetSocketId,
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`Instructor ICE state for peer ${targetSocketId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.warn(`ICE failed for peer ${targetSocketId}, attempting restart...`);
        pc.restartIce();
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (socketRef.current) {
        socketRef.current.emit('signal-offer', { targetSocketId, sdp: offer });
        console.log('📤 Instructor sent SDP offer to', targetSocketId);
      }
    } catch (offerCreateErr) {
      console.error('Error creating offer for peer:', offerCreateErr);
    }
    return pc;
  };

  // Helper: Create PeerConnection for Student receiving stream
  const createStudentPeerConnection = (senderSocketId) => {
    if (peerConnectionsRef.current[senderSocketId]) {
      try {
        peerConnectionsRef.current[senderSocketId].close();
      } catch (e) {}
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[senderSocketId] = pc;

    // Explicitly add transceivers to receive video and audio
    try {
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    } catch (e) {
      console.warn('Transceiver add warning:', e);
    }

    pc.ontrack = (event) => {
      console.log('🎥 Student received track:', event.track.kind, event.streams);
      let stream = event.streams && event.streams[0];
      if (!stream) {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
        stream = remoteStreamRef.current;
      } else {
        remoteStreamRef.current = stream;
      }

      setRemoteStream(stream);

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch((err) => {
          console.warn('Autoplay prevented in ontrack, muting to allow instant playback:', err);
          setIsStudentMuted(true);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.muted = true;
            remoteVideoRef.current.play().catch(e => console.error('Play retry error:', e));
          }
        });
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          targetSocketId: senderSocketId,
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`Student ICE state:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.warn(`Student ICE state failed, attempting restart...`);
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

            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{session?.title}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} color="var(--accent-primary)" /> {connectedPeersCount} Online
            </span>
            
            {session?.isInstructor ? (
              <button 
                onClick={handleEndSession} 
                className="btn btn-danger" 
                style={{ padding: '6px 14px', fontSize: '0.85rem', gap: '6px' }}
              >
                <LogOut size={16} /> End Live Stream
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
              <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video 
                  ref={(el) => {
                    remoteVideoRef.current = el;
                    if (el && remoteStream && el.srcObject !== remoteStream) {
                      el.srcObject = remoteStream;
                      el.play().catch(err => {
                        console.warn('Autoplay blocked in ref callback, muting to allow video render:', err);
                        setIsStudentMuted(true);
                        el.muted = true;
                        el.play().catch(e => console.error('Play retry error:', e));
                      });
                    }
                  }}
                  autoPlay 
                  playsInline 
                  muted={isStudentMuted}
                  style={{
                    width: '100%',
                    maxHeight: '100%',
                    borderRadius: '12px',
                    objectFit: 'contain',
                    background: '#111827',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
                  }}
                />

                {isStudentMuted && (
                  <button 
                    onClick={() => {
                      setIsStudentMuted(false);
                      if (remoteVideoRef.current) {
                        remoteVideoRef.current.muted = false;
                        remoteVideoRef.current.play().catch(() => {});
                      }
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '24px',
                      left: '24px',
                      background: 'rgba(0, 0, 0, 0.85)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '24px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                      zIndex: 10
                    }}
                  >
                    <MicOff size={16} color="#f43f5e" /> Audio Muted (Click to Unmute)
                  </button>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <Video size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <h3>Waiting for Instructor's Live Stream...</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>WebRTC Peer connection is negotiating via Socket.IO signaling</p>
                <button 
                  onClick={handleRequestStream}
                  className="btn btn-secondary"
                  style={{ marginTop: '16px', fontSize: '0.85rem', padding: '8px 18px', gap: '6px' }}
                >
                  <RefreshCw size={14} /> Request / Refresh Stream
                </button>
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
          {session?.isInstructor ? (
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                onClick={() => {
                  const newMuted = !isStudentMuted;
                  setIsStudentMuted(newMuted);
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.muted = newMuted;
                    if (!newMuted) remoteVideoRef.current.play().catch(() => {});
                  }
                }}
                className={`btn ${isStudentMuted ? 'btn-danger' : 'btn-secondary'}`}
                style={{ gap: '8px', fontSize: '0.85rem' }}
                title={isStudentMuted ? 'Unmute Live Audio' : 'Mute Live Audio'}
              >
                {isStudentMuted ? <MicOff size={16} /> : <Mic size={16} />}
                {isStudentMuted ? 'Stream Muted' : 'Audio On'}
              </button>

              <button 
                onClick={handleRequestStream}
                className="btn btn-secondary"
                style={{ gap: '8px', fontSize: '0.85rem' }}
                title="Refresh WebRTC live stream connection"
              >
                <RefreshCw size={16} /> Refresh Stream
              </button>
            </div>
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
