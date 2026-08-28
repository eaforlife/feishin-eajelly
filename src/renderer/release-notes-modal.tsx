import { closeAllModals, openModal } from '@mantine/modals';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import packageJson from '../../package.json';

import { GITHUB_REPOSITORY_URL } from '/@/renderer/hooks/use-github-releases';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { useLocalStorage } from '/@/shared/hooks/use-local-storage';

const CHANGELOG_URL = `${GITHUB_REPOSITORY_URL}/blob/main/CHANGELOG.md`;
const RELEASE_NOTES: Record<string, string[]> = {
    '1.0.0': [
        'EAJelly now uses HTTPS first, with network-only HTTP fallback and --server-override for manual setup.',
        'Updates and release links now use the EAJelly GitHub repository.',
        'Added Windows migration from Feishin and Windows/macOS release builds.',
        'Added an always-on-top cover-art mini player with playback controls and an expandable queue.',
        'Improved startup behavior and added Jellyfin 12-compatible login handling.',
    ],
    '1.0.1': [
        'The mini player now opens in the lower-right and expands its queue toward the left.',
        'Added a lyrics view that replaces the cover while keeping the mini player compact.',
        'Added a compact volume control with mute and a slider.',
        'Made the repeat and repeat-one controls heavier and easier to see.',
    ],
    '1.0.2': [
        'The mini player is now a DPI-aware 420-pixel square positioned at the top-right.',
        'Queue, cover art, and lyrics now share one frame and display one at a time.',
        'Mini-player lyrics no longer expose editing controls or pointer interactions.',
        'Exit and playback controls now share fade behavior, and the volume popup closes automatically.',
        'ReplayGain track mode is enabled by default for tagged Jellyfin audio.',
    ],
};
const WAIT_FOR_LOCAL_STORAGE = 1000 * 2;

interface ReleaseNotesContentProps {
    onDismiss: () => void;
    version: string;
}

const ReleaseNotesContent = ({ onDismiss, version }: ReleaseNotesContentProps) => {
    const { t } = useTranslation();
    const notes = RELEASE_NOTES[version] ?? ['See the EAJelly changelog for release details.'];

    return (
        <Stack gap="md">
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {notes.map((note) => (
                    <li key={note}>
                        <Text size="sm">{note}</Text>
                    </li>
                ))}
            </ul>
            <Group justify="flex-end">
                <Button
                    component="a"
                    href={CHANGELOG_URL}
                    onClick={onDismiss}
                    rightSection={<Icon icon="externalLink" />}
                    target="_blank"
                    variant="subtle"
                >
                    {t('common.viewReleaseNotes')}
                </Button>
                <Button onClick={onDismiss} variant="filled">
                    {t('common.dismiss')}
                </Button>
            </Group>
        </Stack>
    );
};

interface ReleaseNotesModalContentWrapperProps {
    setDismissRef?: (fn: (() => void) | undefined) => void;
}

const ReleaseNotesModalContentWrapper = ({
    setDismissRef,
}: ReleaseNotesModalContentWrapperProps) => {
    const { version } = packageJson;
    const [, setValue] = useLocalStorage({ key: 'version' });

    const handleDismiss = useCallback(() => {
        setValue(version);
        closeAllModals();
    }, [setValue, version]);

    useEffect(() => {
        setDismissRef?.(handleDismiss);
        return () => setDismissRef?.(undefined);
    }, [handleDismiss, setDismissRef]);

    return <ReleaseNotesContent onDismiss={handleDismiss} version={version} />;
};

export const openReleaseNotesModal = (title: string) => {
    const dismissRef = { current: null as (() => void) | null };

    openModal({
        children: (
            <ReleaseNotesModalContentWrapper
                setDismissRef={(fn) => {
                    dismissRef.current = fn ?? null;
                }}
            />
        ),
        onClose: () => dismissRef.current?.(),
        size: 'xl',
        title,
    });
};

export const ReleaseNotesModal = () => {
    const { version } = packageJson;
    const { t } = useTranslation();
    const dismissRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const valueFromLocalStorage = localStorage.getItem('version');
            const versionString = `"${version}"`;

            if (valueFromLocalStorage !== versionString) {
                openModal({
                    children: (
                        <ReleaseNotesModalContentWrapper
                            setDismissRef={(fn) => {
                                dismissRef.current = fn ?? null;
                            }}
                        />
                    ),
                    onClose: () => dismissRef.current?.(),
                    size: 'xl',
                    title: t('common.newVersion', { version }) as string,
                });
            }
        }, WAIT_FOR_LOCAL_STORAGE);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [t, version]);

    return null;
};
