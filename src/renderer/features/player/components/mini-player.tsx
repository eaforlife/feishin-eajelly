import isElectron from 'is-electron';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './mini-player.module.css';

import { useItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { Lyrics } from '/@/renderer/features/lyrics/lyrics';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import {
    usePlayerMuted,
    usePlayerQueue,
    usePlayerRepeat,
    usePlayerShuffle,
    usePlayerSong,
    usePlayerStatus,
    usePlayerVolume,
} from '/@/renderer/store';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem } from '/@/shared/types/domain-types';
import { PlayerRepeat, PlayerShuffle, PlayerStatus } from '/@/shared/types/types';

const browser = isElectron() ? window.api.browser : null;
const CONTROLS_IDLE_TIMEOUT = 10_000;

export const MiniPlayer = () => {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => browser?.miniPlayerModeListener(setEnabled), []);

    useEffect(() => {
        if (!enabled) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') browser?.setMiniPlayerMode(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);

    if (!enabled) return null;

    return <MiniPlayerContent />;
};

const MiniPlayerContent = () => {
    const { t } = useTranslation();
    const [queueVisible, setQueueVisible] = useState(false);
    const [showLyrics, setShowLyrics] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [volumeVisible, setVolumeVisible] = useState(false);
    const {
        mediaNext,
        mediaPlayByIndex,
        mediaPrevious,
        mediaToggleMute,
        mediaTogglePlayPause,
        setVolume,
        toggleRepeat,
        toggleShuffle,
    } = usePlayer();
    const currentSong = usePlayerSong();
    const muted = usePlayerMuted();
    const queue = usePlayerQueue();
    const repeat = usePlayerRepeat();
    const shuffle = usePlayerShuffle();
    const status = usePlayerStatus();
    const volume = usePlayerVolume();
    const imageUrl = useItemImageUrl({
        id: currentSong?.imageId,
        imageUrl: currentSong?.imageUrl,
        itemType: LibraryItem.SONG,
        serverId: currentSong?._serverId,
        size: 600,
    });

    const playPauseLabel = status === PlayerStatus.PLAYING ? t('player.pause') : t('player.play');
    const volumeIcon = muted ? 'volumeMute' : volume > 50 ? 'volumeMax' : 'volumeNormal';

    useEffect(() => {
        let timeoutId: number;
        const handleActivity = () => {
            setControlsVisible(true);
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => setControlsVisible(false), CONTROLS_IDLE_TIMEOUT);
        };

        handleActivity();
        window.addEventListener('focusin', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('pointerdown', handleActivity);
        window.addEventListener('pointermove', handleActivity);

        return () => {
            window.clearTimeout(timeoutId);
            window.removeEventListener('focusin', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('pointerdown', handleActivity);
            window.removeEventListener('pointermove', handleActivity);
        };
    }, []);

    return (
        <div className={styles.root} data-controls-visible={controlsVisible}>
            <div className={styles.cover}>
                {queueVisible ? (
                    <section className={styles.queue}>
                        <h2 className={styles.heading}>{t('player.queue')}</h2>
                        <ol className={styles['queue-list']}>
                            {queue.map((song, index) => {
                                const isCurrent = song._uniqueId === currentSong?._uniqueId;

                                return (
                                    <li key={song._uniqueId}>
                                        <button
                                            aria-current={isCurrent ? 'true' : undefined}
                                            className={styles['queue-item']}
                                            onClick={() => mediaPlayByIndex(index)}
                                            type="button"
                                        >
                                            <span className={styles['song-name']}>{song.name}</span>
                                            <span className={styles['artist-name']}>
                                                {song.artistName}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                ) : showLyrics ? (
                    <div className={styles.lyrics}>
                        <Lyrics
                            fadeOutNoLyricsMessage={false}
                            settingsKey="miniPlayer"
                            showControls={false}
                        />
                    </div>
                ) : imageUrl ? (
                    <img
                        alt={currentSong?.name || ''}
                        className={styles.artwork}
                        draggable={false}
                        src={imageUrl}
                    />
                ) : (
                    <div className={styles.placeholder}>
                        <Icon color="muted" icon="itemAlbum" size="25%" />
                    </div>
                )}
                {!queueVisible && currentSong && (
                    <div className={styles['now-playing']}>
                        <Icon
                            className={
                                status === PlayerStatus.PLAYING ? styles['playing-icon'] : undefined
                            }
                            icon={status === PlayerStatus.PLAYING ? 'mediaPlay' : 'mediaPause'}
                        />
                        <div className={styles['now-playing-details']}>
                            <span className={styles['now-playing-title']}>{currentSong.name}</span>
                            <span className={styles['now-playing-artist']}>
                                {currentSong.artistName}
                            </span>
                        </div>
                    </div>
                )}
                <button
                    aria-label={t('player.exitMiniPlayer')}
                    className={styles.restore}
                    onClick={() => browser?.setMiniPlayerMode(false)}
                    title={t('player.exitMiniPlayer')}
                    type="button"
                >
                    <Icon icon="appWindow" />
                </button>
                {volumeVisible && (
                    <div className={styles['volume-panel']}>
                        <button
                            aria-label={muted ? t('player.muted') : t('player.mute')}
                            className={styles['volume-mute']}
                            onClick={mediaToggleMute}
                            title={muted ? t('player.muted') : t('player.mute')}
                            type="button"
                        >
                            <Icon icon={volumeIcon} />
                        </button>
                        <input
                            aria-label={t('player.volume')}
                            className={styles['volume-slider']}
                            max={100}
                            min={0}
                            onChange={(event) => setVolume(Number(event.currentTarget.value))}
                            type="range"
                            value={volume}
                        />
                        <span className={styles['volume-value']}>{muted ? 0 : volume}%</span>
                    </div>
                )}
                <div className={styles.controls}>
                    <button
                        aria-label={t('player.shuffle')}
                        aria-pressed={shuffle !== PlayerShuffle.NONE}
                        className={styles.control}
                        disabled={!currentSong}
                        onClick={toggleShuffle}
                        title={t('player.shuffle')}
                        type="button"
                    >
                        <Icon icon="mediaShuffle" />
                    </button>
                    <button
                        aria-label={t('player.previous')}
                        className={styles.control}
                        disabled={!currentSong}
                        onClick={() => mediaPrevious(false)}
                        title={t('player.previous')}
                        type="button"
                    >
                        <Icon icon="mediaPrevious" />
                    </button>
                    <button
                        aria-label={playPauseLabel}
                        className={styles.control}
                        disabled={!currentSong}
                        onClick={mediaTogglePlayPause}
                        title={playPauseLabel}
                        type="button"
                    >
                        <Icon icon={status === PlayerStatus.PLAYING ? 'mediaPause' : 'mediaPlay'} />
                    </button>
                    <button
                        aria-label={t('player.next')}
                        className={styles.control}
                        disabled={!currentSong}
                        onClick={() => mediaNext(false)}
                        title={t('player.next')}
                        type="button"
                    >
                        <Icon icon="mediaNext" />
                    </button>
                    <button
                        aria-label={t('player.repeat')}
                        aria-pressed={repeat !== PlayerRepeat.NONE}
                        className={styles.control}
                        disabled={!currentSong}
                        onClick={toggleRepeat}
                        title={t('player.repeat')}
                        type="button"
                    >
                        <Icon
                            fill={repeat === PlayerRepeat.NONE ? 'default' : 'primary'}
                            icon={repeat === PlayerRepeat.ONE ? 'mediaRepeatOne' : 'mediaRepeat'}
                        />
                    </button>
                    <button
                        aria-label={t('player.lyrics')}
                        aria-pressed={showLyrics}
                        className={styles.control}
                        disabled={!currentSong}
                        onClick={async () => {
                            if (queueVisible) {
                                await browser?.setMiniPlayerQueueVisible(false);
                                setQueueVisible(false);
                                setShowLyrics(true);
                                return;
                            }

                            setShowLyrics((visible) => !visible);
                        }}
                        title={t('player.lyrics')}
                        type="button"
                    >
                        <Icon icon="microphone" />
                    </button>
                    <button
                        aria-label={t('player.volume')}
                        aria-pressed={volumeVisible}
                        className={styles.control}
                        onClick={() => setVolumeVisible((visible) => !visible)}
                        title={t('player.volume')}
                        type="button"
                    >
                        <Icon icon={volumeIcon} />
                    </button>
                    <button
                        aria-label={t('player.queue')}
                        aria-pressed={queueVisible}
                        className={styles.control}
                        onClick={async () => {
                            const visible = await browser?.setMiniPlayerQueueVisible(!queueVisible);
                            setQueueVisible(visible ?? false);
                        }}
                        title={t('player.queue')}
                        type="button"
                    >
                        <Icon icon="queue" />
                    </button>
                </div>
            </div>
        </div>
    );
};
