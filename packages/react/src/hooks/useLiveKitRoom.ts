import { log, setupLiveKitRoom } from '@livekit/components-core';
import { Room, MediaDeviceFailure, RoomEvent, ConnectionState } from 'livekit-client';
import * as React from 'react';
import type { HTMLAttributes } from 'react';

import type { LiveKitRoomProps } from '../components';
import { mergeProps } from '../mergeProps';

const defaultRoomProps: Partial<LiveKitRoomProps> = {
  connect: true,
  audio: false,
  video: false,
};

/** @public */
export function useLiveKitRoom<T extends HTMLElement>(
  props: LiveKitRoomProps,
): {
  room: Room | undefined;
  htmlProps: HTMLAttributes<T>;
} {
  const {
    token,
    serverUrl,
    options,
    room: passedRoom,
    connectOptions,
    connect,
    audio,
    video,
    screen,
    onConnected,
    onDisconnected,
    onError,
    onMediaDeviceFailure,
    simulateParticipants,
    ...rest
  } = { ...defaultRoomProps, ...props };
  if (options && passedRoom) {
    log.warn(
      'when using a manually created room, the options object will be ignored. set the desired options directly when creating the room instead.',
    );
  }

  const [room, setRoom] = React.useState<Room | undefined>();

  React.useEffect(() => {
    setRoom(passedRoom ?? new Room(options));
  }, [passedRoom]);

  const htmlProps = React.useMemo(() => {
    const { className } = setupLiveKitRoom();
    return mergeProps(rest, { className }) as HTMLAttributes<T>;
  }, [rest]);

  React.useEffect(() => {
    if (!room) return;
    const onSignalConnected = () => {
      const localP = room.localParticipant;

      log.debug('trying to publish local tracks');
      Promise.all([
        localP.setMicrophoneEnabled(!!audio, typeof audio !== 'boolean' ? audio : undefined),
        localP.setCameraEnabled(!!video, typeof video !== 'boolean' ? video : undefined),
        localP.setScreenShareEnabled(!!screen, typeof screen !== 'boolean' ? screen : undefined),
      ]).catch((e) => {
        log.warn(e);
        onError?.(e as Error);
      });
    };

    const onMediaDeviceError = (e: Error) => {
      const mediaDeviceFailure = MediaDeviceFailure.getFailure(e);
      onMediaDeviceFailure?.(mediaDeviceFailure);
    };
    room.on(RoomEvent.SignalConnected, onSignalConnected);
    room.on(RoomEvent.MediaDevicesError, onMediaDeviceError);

    return () => {
      room.off(RoomEvent.SignalConnected, onSignalConnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDeviceError);
    };
  }, [room, audio, video, screen, onError]);

  React.useEffect(() => {
    if (!room) return;

    if (simulateParticipants) {
      room.simulateParticipants({
        participants: {
          count: simulateParticipants,
        },
        publish: {
          audio: true,
          useRealTracks: true,
        },
      });
      return;
    }
    if (!token) {
      log.debug('no token yet');
      return;
    }
    if (!serverUrl) {
      log.warn('no livekit url provided');
      onError?.(Error('no livekit url provided'));
      return;
    }
    if (connect) {
      log.debug('connecting');
      room.connect(serverUrl, token, connectOptions).catch((e) => {
        log.warn(e);
        onError?.(e as Error);
      });
    } else {
      log.debug('disconnecting because connect is false');
      room.disconnect();
    }
  }, [
    connect,
    token,
    JSON.stringify(connectOptions),
    room,
    onError,
    serverUrl,
    simulateParticipants,
  ]);

  React.useEffect(() => {
    if (!room) return;
    const connectionStateChangeListener = (state: ConnectionState) => {
      switch (state) {
        case ConnectionState.Disconnected:
          if (onDisconnected) onDisconnected();
          break;
        case ConnectionState.Connected:
          if (onConnected) onConnected();
          break;

        default:
          break;
      }
    };
    room.on(RoomEvent.ConnectionStateChanged, connectionStateChangeListener);
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, connectionStateChangeListener);
    };
  }, [token, onConnected, onDisconnected, room]);

  React.useEffect(() => {
    if (!room) return;
    return () => {
      log.info('disconnecting on onmount');
      room.disconnect();
    };
  }, [room]);

  return { room, htmlProps };
}
