"use client";

// Conexión del aula: pide el token a la API y entra a la sala LiveKit. Si el servidor no
// tiene LiveKit configurado (o la conexión falla), el aula sigue en modo local con el
// tutor IA simulado. Expone presencia, micrófono, cámara y audio de los demás.

import { useEffect, useRef, useState } from "react";
import {
  DisconnectReason,
  ParticipantKind,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteAudioTrack,
  type RemoteTrack,
  type VideoTrack,
} from "livekit-client";
import { api } from "@/lib/api";
import { LocalTransport, type ClassroomTransport } from "@/lib/classroom/transport";
import { LiveKitTransport } from "@/lib/classroom/livekit-transport";

export type RoomMode = "connecting" | "local" | "livekit";

export interface ParticipantMedia {
  connected: boolean;
  micOn: boolean;
  camOn: boolean;
  video: VideoTrack | null;
}

const OFFLINE: ParticipantMedia = { connected: false, micOn: false, camOn: false, video: null };

export function useClassroomRoom(opts: {
  sessionId: string;
  userId: string | null;
  enabled: boolean;
  isAi: boolean;
  aiActor: string | null;
  myName: string;
  voice: boolean;
  onRoomClosed: () => void;
  onMediaError: (message: string) => void;
}) {
  const { sessionId, userId, enabled, isAi, aiActor, myName, voice } = opts;
  const [conn, setConn] = useState<{ mode: RoomMode; transport: ClassroomTransport | null; room: Room | null }>({
    mode: "connecting",
    transport: null,
    room: null,
  });
  const [, setTick] = useState(0);
  const [pending, setPending] = useState({ mic: false, cam: false });
  const pendingRef = useRef({ mic: false, cam: false });
  const callbacks = useRef({ onRoomClosed: opts.onRoomClosed, onMediaError: opts.onMediaError });

  useEffect(() => {
    callbacks.current = { onRoomClosed: opts.onRoomClosed, onMediaError: opts.onMediaError };
  }, [opts.onRoomClosed, opts.onMediaError]);

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    let room: Room | null = null;
    let transport: ClassroomTransport | null = null;
    const bump = () => setTick((t) => t + 1);

    const goLocal = () => {
      transport = new LocalTransport();
      setConn({ mode: "local", transport, room: null });
    };

    (async () => {
      const token = await api.roomToken(userId, sessionId).catch(() => null);
      if (cancelled) return;
      if (!token?.livekitUrl || !token.token) return goLocal();

      const lkRoom = new Room({ adaptiveStream: true, dynacast: true });
      room = lkRoom;
      const audioEls = new Map<string, HTMLMediaElement>();
      lkRoom
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.style.display = "none";
            document.body.appendChild(el);
            audioEls.set(track.sid ?? String(audioEls.size), el);
          }
          bump();
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach().forEach((el) => el.remove());
          if (track.sid) audioEls.delete(track.sid);
          bump();
        })
        .on(RoomEvent.ParticipantConnected, bump)
        .on(RoomEvent.ParticipantDisconnected, bump)
        .on(RoomEvent.TrackMuted, bump)
        .on(RoomEvent.TrackUnmuted, bump)
        .on(RoomEvent.LocalTrackPublished, bump)
        .on(RoomEvent.LocalTrackUnpublished, bump)
        .on(RoomEvent.MediaDevicesError, bump)
        .on(RoomEvent.ParticipantPermissionsChanged, bump)
        .on(RoomEvent.AudioPlaybackStatusChanged, bump)
        .on(RoomEvent.Reconnected, bump)
        .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          audioEls.forEach((el) => el.remove());
          audioEls.clear();
          bump();
          if (!cancelled && reason === DisconnectReason.ROOM_DELETED) callbacks.current.onRoomClosed();
        });

      // Los manejadores se registran antes de conectar para no perder lo primero que mande el agente
      transport = new LiveKitTransport(lkRoom, aiActor, myName);
      try {
        await lkRoom.connect(token.livekitUrl, token.token);
      } catch {
        transport.close();
        transport = null;
        lkRoom.disconnect();
        room = null;
        if (!cancelled) {
          callbacks.current.onMediaError("No pudimos conectar el audio en vivo; seguimos en modo local.");
          goLocal();
        }
        return;
      }
      if (cancelled) return;
      setConn({ mode: "livekit", transport, room: lkRoom });
      if (isAi) {
        // Con un tutor IA se habla: el micrófono arranca encendido
        await lkRoom.localParticipant.setMicrophoneEnabled(true).catch(() =>
          callbacks.current.onMediaError("No pudimos usar tu micrófono. Puedes escribirle por el chat."),
        );
      }
    })();

    return () => {
      cancelled = true;
      transport?.close();
      room?.disconnect();
    };
  }, [enabled, userId, sessionId, isAi, aiActor, myName]);

  const room = conn.room;

  // Volumen de la voz de los demás (botón de parlante del aula)
  useEffect(() => {
    if (!room) return;
    for (const p of room.remoteParticipants.values())
      for (const pub of p.audioTrackPublications.values()) (pub.track as RemoteAudioTrack | undefined)?.setVolume(voice ? 1 : 0);
  });

  // Una cámara apagada queda silenciada (la publicación sigue con su track), así que la
  // fuente de verdad es "publicada y no silenciada", no solo la existencia del track.
  const mediaOf = (p: Participant | undefined): ParticipantMedia => {
    if (!p) return OFFLINE;
    const cam = p.getTrackPublication(Track.Source.Camera);
    const video = cam && !cam.isMuted ? ((cam.videoTrack as VideoTrack | undefined) ?? null) : null;
    return { connected: true, micOn: p.isMicrophoneEnabled, camOn: !!video, video };
  };

  const toggle = async (kind: "mic" | "cam", message: string) => {
    if (!room || pendingRef.current[kind]) return;
    pendingRef.current[kind] = true;
    setPending({ ...pendingRef.current });
    try {
      const lp = room.localParticipant;
      if (kind === "mic") await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled);
      else await lp.setCameraEnabled(!lp.isCameraEnabled);
    } catch {
      callbacks.current.onMediaError(message);
    } finally {
      pendingRef.current[kind] = false;
      setPending({ ...pendingRef.current });
    }
  };

  return {
    mode: conn.mode,
    transport: conn.transport,
    room,
    /** Presencia y medios de una persona por su identidad "profile:<id>". */
    media(identity: string): ParticipantMedia {
      if (!room) return OFFLINE;
      if (identity === room.localParticipant.identity) return mediaOf(room.localParticipant);
      return mediaOf(room.remoteParticipants.get(identity));
    },
    agent(): ParticipantMedia {
      if (!room) return OFFLINE;
      return mediaOf([...room.remoteParticipants.values()].find((p) => p.kind === ParticipantKind.AGENT));
    },
    audioBlocked: !!room && !room.canPlaybackAudio,
    startAudio: () => room?.startAudio(),
    micPending: pending.mic,
    camPending: pending.cam,
    toggleMic: () => toggle("mic", "No pudimos acceder a tu micrófono."),
    toggleCam: () => toggle("cam", "No pudimos acceder a tu cámara. Revisa los permisos del navegador."),
  };
}
