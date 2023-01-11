import * as React from 'react';
import { Participant, Track, TrackPublication } from 'livekit-client';
import { setupParticipantTile } from '@livekit/components-core';
import { ConnectionQualityIndicator } from '../components/participant/ConnectionQualityIndicator';
import { MediaTrack } from '../components/participant/MediaTrack';
import { ParticipantName } from '../components/participant/ParticipantName';
import { TrackMutedIndicator } from '../components/participant/TrackMutedIndicator';
import {
  useMaybeParticipantContext,
  ParticipantContext,
  useEnsureParticipant,
  useMaybeLayoutContext,
} from '../context';
import { useIsMuted, useIsSpeaking } from '../hooks';
import { mergeProps } from '../utils';

export interface ParticipantClickEvent {
  participant?: Participant;
  publication?: TrackPublication;
}

export type ParticipantTileProps = React.HTMLAttributes<HTMLDivElement> & {
  participant?: Participant;
  trackSource?: Track.Source;
  onParticipantClick?: (evt: ParticipantClickEvent) => void;
};

export function useParticipantTile<T extends React.HTMLAttributes<HTMLElement>>({
  participant,
  props,
}: {
  participant: Participant;
  props: T;
}) {
  const mergedProps = React.useMemo(() => {
    const { className } = setupParticipantTile();
    return mergeProps(props, { className });
  }, [props]);
  const isVideoMuted = useIsMuted({ source: Track.Source.Camera, participant });
  const isAudioMuted = useIsMuted({ source: Track.Source.Microphone, participant });
  const isSpeaking = useIsSpeaking(participant);
  return {
    elementProps: {
      'data-lk-audio-muted': isAudioMuted,
      'data-lk-video-muted': isVideoMuted,
      'data-lk-speaking': isSpeaking,
      'data-lk-local-participant': participant.isLocal,
      ...mergedProps,
    },
  };
}

export function ParticipantContextIfNeeded(
  props: React.PropsWithChildren<{
    participant?: Participant;
  }>,
) {
  const hasContext = !!useMaybeParticipantContext();
  return props.participant && !hasContext ? (
    <ParticipantContext.Provider value={props.participant}>
      {props.children}
    </ParticipantContext.Provider>
  ) : (
    <>{props.children}</>
  );
}

/**
 * The ParticipantTile component is the base utility wrapper for displaying a visual representation of a participant.
 * This component can be used as a child of the `ParticipantLoop` component or independently if a participant is passed as a property.
 *
 * @example
 * ```tsx
 * {...}
 *   <ParticipantTile>
 *     {...}
 *   </ParticipantTile>
 * {...}
 * ```
 *
 * @see `ParticipantLoop` component
 */
export const ParticipantTile = ({
  participant,
  children,
  onParticipantClick,
  trackSource,
  ...htmlProps
}: ParticipantTileProps) => {
  const p = useEnsureParticipant(participant);
  const { elementProps } = useParticipantTile({ participant: p, props: htmlProps });

  const pinContext = useMaybeLayoutContext().pin;

  const clickHandler = (evt: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    elementProps.onClick?.(evt);
    onParticipantClick?.({ participant: p });
    if (pinContext.dispatch && trackSource) {
      const track = p.getTrack(trackSource);
      if (track) {
        pinContext.dispatch({
          msg: 'set_pin',
          trackParticipantPair: {
            participant: p,
            track,
          },
        });
      }
    }
  };

  return (
    <div style={{ position: 'relative' }} {...elementProps} onClick={clickHandler}>
      <ParticipantContextIfNeeded participant={participant}>
        {children ?? (
          <>
            {/* <AudioVisualizer /> */}
            <MediaTrack source={trackSource ?? Track.Source.Camera}></MediaTrack>
            <div className="lk-participant-metadata">
              <div className="lk-participant-metadata-item">
                {trackSource === Track.Source.Camera ? (
                  <>
                    <TrackMutedIndicator source={Track.Source.Microphone}></TrackMutedIndicator>
                    <TrackMutedIndicator source={Track.Source.Camera}></TrackMutedIndicator>
                    <ParticipantName />
                  </>
                ) : (
                  <ParticipantName>&apos;s screen share</ParticipantName>
                )}
              </div>
              <div className="lk-participant-metadata-item">
                <ConnectionQualityIndicator />
              </div>
            </div>
          </>
        )}
      </ParticipantContextIfNeeded>
    </div>
  );
};