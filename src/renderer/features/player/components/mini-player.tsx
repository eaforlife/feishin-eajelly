import isElectron from 'is-electron';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './mini-player.module.css';

import { useItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import {
    usePlayerQueue,
    usePlayerRepeat,
    usePlayerShuffle,
    usePlayerSong,
    usePlayerStatus,
} from '/@/renderer/store';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem } from '/@/shared/types/domain-types';
import { PlayerRepeat, PlayerShuffle, PlayerStatus } from '/@/shared/types/types';

const browser = isElectron() ? window.api.browser : null;

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
    const {
        mediaNext,
        mediaPlayByIndex,
        mediaPrevious,
        mediaTogglePlayPause,
        toggleRepeat,
        toggleShuffle,
    } = usePlayer();
    const currentSong = usePlayerSong();
    const queue = usePlayerQueue();
    const repeat = usePlayerRepeat();
    const shuffle = usePlayerShuffle();
    const status = usePlayerStatus();
    const imageUrl = useItemImageUrl({
        id: currentSong?.imageId,
        imageUrl: currentSong?.imageUrl,
        itemType: LibraryItem.SONG,
        serverId: currentSong?._serverId,
        size: 600,
    });

    const playPauseLabel = status === PlayerStatus.PLAYING ? t('player.pause') : t('player.play');

    return (
        <div className={`${styles.root} ${queueVisible ? styles.withQueue : ''}`}>
            <div className={styles.cover}>
                {imageUrl ? (
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
                <button
                    aria-label={t('player.exitMiniPlayer')}
                    className={styles.restore}
                    onClick={() => browser?.setMiniPlayerMode(false)}
                    title={t('player.exitMiniPlayer')}
                    type="button"
                >
                    <Icon icon="appWindow" />
                </button>
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
                            icon={repeat === PlayerRepeat.ONE ? 'mediaRepeatOne' : 'mediaRepeat'}
                        />
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
            {queueVisible && (
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
            )}
        </div>
    );
};
