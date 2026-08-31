"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import type { KedClient } from "@/lib/client";

export interface CallSession {
  roomId: string;
  peerName: string;
  isVideo: boolean;
  callId?: string;
  isIncoming?: boolean;
  initialSdp?: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

export function CallModal({
  client,
  session,
  onClose,
  lang,
}: {
  client: KedClient;
  session: CallSession;
  onClose: () => void;
  lang: string;
}) {
  const [status, setStatus] = useState<"calling" | "ringing" | "connected" | "ended">(
    session.isIncoming ? "ringing" : "calling"
  );
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(!session.isVideo);
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callIdRef = useRef<string>(
    session.callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );

  useEffect(() => {
    let active = true;
    const callId = callIdRef.current;

    async function initMediaAndCall() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: session.isVideo ? { facingMode: "user" } : false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && session.isVideo) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setStatus("connected");
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            void client.sendCallSignal(session.roomId, {
              action: "ice",
              callId,
              candidate: event.candidate.toJSON(),
              senderId: client.userId,
            });
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            setStatus("connected");
          } else if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            setStatus("ended");
          }
        };

        // Wire up signaling listener
        client.onCallSignal = async (roomId, signal) => {
          if (roomId !== session.roomId || signal.callId !== callId) return;

          if (signal.action === "answer" && signal.sdp && !session.isIncoming) {
            try {
              await pc.setRemoteDescription(
                new RTCSessionDescription({ type: "answer", sdp: String(signal.sdp) })
              );
              setStatus("connected");
            } catch {}
          } else if (signal.action === "offer" && signal.sdp && session.isIncoming) {
            try {
              await pc.setRemoteDescription(
                new RTCSessionDescription({ type: "offer", sdp: String(signal.sdp) })
              );
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              void client.sendCallSignal(session.roomId, {
                action: "answer",
                callId,
                sdp: answer.sdp,
                responderId: client.userId,
              });
              setStatus("connected");
            } catch {}
          } else if (signal.action === "ice" && signal.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate as RTCIceCandidateInit));
            } catch {}
          } else if (signal.action === "end_all") {
            setStatus("ended");
          }
        };

        if (session.isIncoming) {
          if (session.initialSdp) {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type: "offer", sdp: session.initialSdp })
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            void client.sendCallSignal(session.roomId, {
              action: "answer",
              callId,
              sdp: answer.sdp,
              responderId: client.userId,
            });
            setStatus("connected");
          } else {
            // Signal join to prompt offer
            void client.sendCallSignal(session.roomId, {
              action: "join",
              callId,
              responderId: client.userId,
            });
          }
        } else {
          // Caller creates offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          // Broadcast Call Invite to all room members
          void client.sendCallSignal(session.roomId, {
            action: "invite",
            callId,
            isVideo: session.isVideo,
            callerId: client.userId,
            callerName: client.username || "Member",
            sdp: offer.sdp,
          });
        }
      } catch {
        setStatus("ended");
      }
    }

    void initMediaAndCall();

    return () => {
      active = false;
      client.onCallSignal = undefined;
      if (timerRef.current) clearInterval(timerRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (peerConnRef.current) {
        peerConnRef.current.close();
      }
    };
  }, [client, session]);

  useEffect(() => {
    if (status === "connected") {
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else if (status === "ended") {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(onClose, 1200);
    }
  }, [status, onClose]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setMicMuted((prev) => !prev);
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setCamOff((prev) => !prev);
    }
  };

  const endCall = () => {
    setStatus("ended");
    void client.sendCallSignal(session.roomId, {
      action: "leave",
      callId: callIdRef.current,
      senderId: client.userId,
    });
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (peerConnRef.current) {
      peerConnRef.current.close();
    }
    onClose();
  };

  const fmtTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl animate-fadeIn">
      <div className="relative flex h-full max-h-[600px] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/20 bg-[#0a0f18] shadow-2xl">
        <div className="row items-center justify-between border-b border-white/10 bg-black/40 px-5 py-3.5">
          <div className="row items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[rgba(79,240,182,.15)] text-[var(--acc)]">
              <Icon name="shield" size={16} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                {session.isVideo ? (lang === "hi" ? "एन्क्रिप्टेड वीडियो कॉल" : "E2EE Video Call") : (lang === "hi" ? "एन्क्रिप्टेड वॉइस कॉल" : "E2EE Voice Call")}
              </h3>
              <p className="mono text-[10px] text-[var(--acc)]">
                {status === "connected" ? `🔒 P2P Encrypted · ${fmtTime(duration)}` : status === "calling" ? (lang === "hi" ? "अन्य सदस्यों को रिंग हो रहा है..." : "Ringing room members...") : (lang === "hi" ? "कॉल समाप्त" : "Call ended")}
              </p>
            </div>
          </div>
          <span className="chip font-mono text-[11px] !border-[var(--acc)] !bg-[rgba(79,240,182,.1)] !text-[#a9ffe2]">
            WebRTC
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black/80 p-4">
          {session.isVideo ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full rounded-2xl object-cover"
              />
              <div className="absolute bottom-4 right-4 h-32 w-24 overflow-hidden rounded-xl border border-white/20 bg-black shadow-lg sm:h-36 sm:w-28">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${camOff ? "hidden" : ""}`}
                />
                {camOff && (
                  <div className="grid h-full w-full place-items-center bg-[#111827] text-xs text-white/50">
                    Camera Off
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-[var(--acc)] bg-[rgba(79,240,182,.1)] shadow-[0_0_35px_rgba(79,240,182,.25)] animate-pulse">
                <Icon name="phone" size={40} className="text-[var(--acc)]" />
              </div>
              <div className="text-center">
                <h4 className="text-lg font-bold text-white">@{session.peerName}</h4>
                <p className="mono text-xs text-white/50 mt-1">
                  {status === "connected" ? fmtTime(duration) : (lang === "hi" ? "P2P एन्क्रिप्टेड वॉइस सिग्नल..." : "Direct P2P Encrypted Audio")}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="row items-center justify-center gap-4 border-t border-white/10 bg-[#080c14] p-4">
          <button
            type="button"
            onClick={toggleMic}
            className={`grid h-12 w-12 place-items-center rounded-full border transition-all ${micMuted ? "border-red-500 bg-red-500/20 text-red-300" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
            title={micMuted ? "Unmute" : "Mute"}
          >
            <Icon name="mic" size={20} />
          </button>

          {session.isVideo && (
            <button
              type="button"
              onClick={toggleCam}
              className={`grid h-12 w-12 place-items-center rounded-full border transition-all ${camOff ? "border-red-500 bg-red-500/20 text-red-300" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
              title={camOff ? "Turn Camera On" : "Turn Camera Off"}
            >
              <Icon name="camera" size={20} />
            </button>
          )}

          <button
            type="button"
            onClick={endCall}
            className="grid h-12 w-16 place-items-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-red-500 active:scale-95"
            title="End Call"
          >
            <Icon name="x" size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}