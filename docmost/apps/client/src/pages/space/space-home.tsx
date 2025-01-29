import {Container} from "@mantine/core";
import SpaceHomeTabs from "@/features/space/components/space-home-tabs.tsx";
import {useParams} from "react-router-dom";
import {useGetSpaceBySlugQuery} from "@/features/space/queries/space-query.ts";
import {getAppName} from "@/lib/config.ts";
import {Helmet} from "react-helmet-async";
import { useEffect } from "react";
import { getRecentChanges } from "@/features/page/services/page-service";
import { notifications } from "@mantine/notifications";
import { runSync } from "@/features/sync/components/SyncConfigForm";

export default function SpaceHome() {
    const {spaceSlug} = useParams();
    const {data: space} = useGetSpaceBySlugQuery(spaceSlug);

    useEffect(() => {
        const checkAndAutoSync = async () => {
            if (space?.name !== "Projects") return;

            try {
                const recentChanges = await getRecentChanges(space.id);
                if (!recentChanges?.items?.length) return;

                const lastUpdate = new Date(recentChanges.items[0].updatedAt);
                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);

                if (lastUpdate < oneDayAgo) {
                    console.log("Auto-sync triggered");
                    notifications.show({
                        title: 'Auto-sync triggered',
                        message: 'Projects space has not been updated in over 2 minutes. Starting sync...',
                        color: 'blue',
                    });
                    
                    // Run sync with default values
                    const syncValues = {
                        sourceConfig: {
                            repository: 'digilabmuc/digilabmuc',
                            branch: 'main',
                            path: '/readmes'
                        },
                        targetConfig: {
                            spaceId: space.id
                        },
                        credentials: {
                            accessToken: import.meta.env.VITE_GITHUB_ACCESS_TOKEN
                        }
                    };
                    
                    await runSync(syncValues, [space], undefined);
                }
            } catch (error) {
                console.error('Failed to check recent changes:', error);
            }
        };

        if (space) {
            checkAndAutoSync();
        }
    }, [space]);

    return (
        <>
            <Helmet>
                <title>{space?.name || 'Overview'} - {getAppName()}</title>
            </Helmet>
            <Container size={"800"} pt="xl">
                {space && <SpaceHomeTabs/>}
            </Container>
        </>
    );
}
