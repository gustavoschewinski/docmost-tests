import React, { useEffect, useState } from 'react';
import { TextInput, Select, Switch, Button, Stack, Box, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { createSyncConfig, updateSyncConfig } from '../services/sync-service';
import { ISyncConfig } from '../types/sync.types';
import { Octokit } from '@octokit/rest';
import { importPage, deletePage, getRecentChanges } from '@/features/page/services/page-service';
import { getSpaces } from '@/features/space/services/space-service';
import { ISpace } from '@/features/space/types/space.types';
import { useNavigate } from 'react-router-dom';
import { buildPageUrl } from '@/features/page/page.utils';

interface SyncConfigFormProps {
  initialValues?: Partial<ISyncConfig>;
  onSuccess?: () => void;
}

export const SyncConfigForm: React.FC<SyncConfigFormProps> = ({
  initialValues,
  onSuccess,
}) => {
  const [spaces, setSpaces] = useState<ISpace[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  console.log(import.meta.env.VITE_GITHUB_ACCESS_TOKEN);

  const form = useForm({
    initialValues: initialValues || {
      name: 'GitHub Docs Sync',
      schedule: '0 0 * * 0',
      provider: 'github',
      enabled: true,
      sourceConfig: {
        repository: 'digilabmuc/digilabmuc',
        branch: 'main',
        path: ''
      },
      targetConfig: {
        updateExisting: true,
        spaceId: ''
      },
      credentials: {
        accessToken: import.meta.env.VITE_GITHUB_ACCESS_TOKEN
      }
    },
  });
  const isEdit = !!initialValues?.id;

  useEffect(() => {
    const fetchSpaces = async () => {
      setLoading(true);
      console.log('fetching spaces');
      
      try {
        const response = await getSpaces();
        console.log(response);
        const spacesList = Array.isArray(response) ? response : response.items || [];
        setSpaces(spacesList);
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: 'Failed to fetch spaces',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSpaces();
  }, []);

  // Add effect to check for stale pages and auto-sync
  useEffect(() => {
    const checkAndAutoSync = async () => {
      const spaceId = form.values.targetConfig?.spaceId;
      if (!spaceId) return;

      try {
        const recentChanges = await getRecentChanges(spaceId);
        if (!recentChanges?.items?.length) return;

        const lastUpdate = new Date(recentChanges.items[0].updatedAt);
        console.log("lastUpdate", lastUpdate);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        console.log("oneDayAgo", oneDayAgo);

        if (lastUpdate < oneDayAgo) {
          notifications.show({
            title: 'Auto-sync triggered',
            message: 'Pages have not been updated in over a day. Starting sync...',
            color: 'blue',
          });
          await testConnection();
        }
      } catch (error) {
        console.error('Failed to check recent changes:', error);
      }
    };

    if (form.values.enabled) {
      checkAndAutoSync();
    }
  }, [form.values.targetConfig?.spaceId, form.values.enabled]);

  const onFinish = async (values: Partial<ISyncConfig>) => {
    try {
      if (isEdit) {
        await updateSyncConfig({ ...values, id: initialValues.id });
      } else {
        await createSyncConfig(values);
      }
      notifications.show({
        title: 'Success',
        message: `Sync configuration ${isEdit ? 'updated' : 'created'} successfully`,
        color: 'green',
      });
      onSuccess?.();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to save sync configuration',
        color: 'red',
      });
    }
  };

  const testConnection = async () => {
    const values = form.values;
    if (!values.sourceConfig?.repository || !values.credentials?.accessToken || !values.targetConfig?.spaceId) {
      notifications.show({
        title: 'Error',
        message: 'Please fill in repository, access token, and target space',
        color: 'red',
      });
      return;
    }

    try {
      const octokit = new Octokit({
        auth: values.credentials.accessToken,
      });

      const [owner, repo] = values.sourceConfig.repository.split('/');
      const path = values.sourceConfig.path || '';
      const branch = values.sourceConfig.branch || 'main';

      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      const contents = Array.isArray(response.data) ? response.data : [response.data];
      const markdownFiles = contents.filter(item => item.type === 'file' && item.name.endsWith('.md'));
      
      notifications.show({
        title: 'Found files',
        message: `Found ${markdownFiles.length} markdown files. Starting import...`,
        color: 'blue',
      });

      // Get list of existing pages to delete
      const recentChanges = await getRecentChanges(values.targetConfig.spaceId);
      const existingPages = recentChanges?.items || [];

      // Delete existing pages first
      for (const page of existingPages) {
        try {
          await deletePage(page.id);
          notifications.show({
            title: 'Cleanup',
            message: `Deleted existing page: ${page.title}`,
            color: 'yellow',
          });
        } catch (error) {
          notifications.show({
            title: 'Warning',
            message: `Failed to delete page ${page.title}: ${error.message}`,
            color: 'orange',
          });
        }
      }

      let lastImportedPage = null;

      // Import new files
      for (const file of markdownFiles) {
        try {
          const blob = await octokit.git.getBlob({
            owner,
            repo,
            file_sha: file.sha,
          });

          const content = atob(blob.data.content);
          const fileObj = new File([new TextEncoder().encode(content)], file.name, {
            type: 'text/markdown',
          });

          const importedPage = await importPage(fileObj, values.targetConfig.spaceId);
          lastImportedPage = importedPage;
          
          notifications.show({
            title: 'Success',
            message: `Imported ${file.name}`,
            color: 'green',
          });
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: `Failed to import ${file.name}: ${error.message}`,
            color: 'red',
          });
        }
      }

      notifications.show({
        title: 'Complete',
        message: `Import process completed`,
        color: 'green',
      });

      // Navigate to the last imported page
      if (lastImportedPage) {
        const space = spaces.find(s => s.id === values.targetConfig.spaceId);
        if (space) {
          const pageUrl = buildPageUrl(space.slug, lastImportedPage.slugId, lastImportedPage.title);
          navigate(pageUrl);
        }
      }

    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to connect to GitHub',
        color: 'red',
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(onFinish)}>
      <Stack gap="sm" style={{paddingTop: '20px'}}>
        
        <Text size="md" fw={500} style={{paddingBottom: '10px'}}>
          Synchronization settings
        </Text>

        <TextInput
          label="Configuration Name"
          placeholder="My GitHub Sync"
          {...form.getInputProps('name')}
        />

        <TextInput
          label="GitHub Repository"
          placeholder="owner/repository"
          {...form.getInputProps('sourceConfig.repository')}
        />

        <TextInput
          label="Branch"
          placeholder="main"
          {...form.getInputProps('sourceConfig.branch')}
        />

        <TextInput
          label="Path"
          placeholder=""
          {...form.getInputProps('sourceConfig.path')}
        />

        <TextInput
          label="GitHub Access Token"
          placeholder="ghp_..." 
          type="password"
          description={form.values.credentials?.accessToken ? "Token is set" : "Enter your GitHub access token"}         
          {...form.getInputProps('credentials.accessToken')}
        />

        <Select
          label="Target Space"
          placeholder="Select a space"
          data={spaces.map(space => ({
            value: space.id,
            label: space.name
          }))}
          disabled={loading}
          {...form.getInputProps('targetConfig.spaceId')}
        />

        <Button 
          variant="outline"
          onClick={testConnection} 
          mb="sm"
          disabled={!form.values.sourceConfig?.repository || !form.values.credentials?.accessToken}
        >
          Deploy Connection
        </Button>
      </Stack>
    </form>
  );
}; 