import {Container} from "@mantine/core";
import SpaceHomeTabs from "@/features/space/components/space-home-tabs.tsx";
import {useParams} from "react-router-dom";
import {useGetSpaceBySlugQuery} from "@/features/space/queries/space-query.ts";
import {getAppName} from "@/lib/config.ts";
import {Helmet} from "react-helmet-async";
import {useEffect} from "react";
import {getRecentChanges} from "@/features/page/services/page-service";
import {notifications} from "@mantine/notifications";
import {Octokit} from "@octokit/rest";

export default function SpaceHome() {
    const {spaceSlug} = useParams();
    const {data: space} = useGetSpaceBySlugQuery(spaceSlug);

    useEffect(() => {
        const checkAndAutoSync = async () => {
            if (!space?.id) return;

            try {
                const recentChanges = await getRecentChanges(space.id);
                if (!recentChanges?.items?.length) return;

                const lastUpdate = new Date(recentChanges.items[0].updatedAt);
                console.log("lastUpdate", lastUpdate);
                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                console.log("oneDayAgo", oneDayAgo);

                if (lastUpdate < oneDayAgo) {
                    notifications.show({
                        title: 'Auto-sync needed',
                        message: 'Pages have not been updated in over a day. Please check sync settings.',
                        color: 'blue',
                    });
                }
            } catch (error) {
                console.error('Failed to check recent changes:', error);
            }
        };

        checkAndAutoSync();
    }, [space?.id]);

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
