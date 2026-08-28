import isElectron from 'is-electron';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './mini-player.module.css';

import { useItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { usePlayerQueue, usePlayerSong } from '/@/renderer/store';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem } from '/@/shared/types/domain-types';

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
    const { mediaPlayByIndex } = usePlayer();
    const currentSong = usePlayerSong();
    const queue = usePlayerQueue();
    const imageUrl = useItemImageUrl({
        id: currentSong?.imageId,
        imageUrl: currentSong?.imageUrl,
        itemType: LibraryItem.SONG,
        serverId: currentSong?._serverId,
        size: 600,
    });

    return (
        <div className={styles.root}>
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
            </div>
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
                                    <span className={styles['artist-name']}>{song.artistName}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </section>
        </div>
    );
};
