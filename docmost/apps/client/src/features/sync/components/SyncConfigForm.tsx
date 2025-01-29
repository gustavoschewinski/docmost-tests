import React, { useEffect, useState } from 'react';
import { TextInput, Select, Switch, Button, Stack, Box } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { createSyncConfig, updateSyncConfig } from '../services/sync-service';
import { ISyncConfig } from '../types/sync.types';
import { Octokit } from '@octokit/rest';
import { importPage } from '@/features/page/services/page-service';
import { getSpaces } from '@/features/space/services/space-service';
import { ISpace } from '@/features/space/types/space.types';

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
        updateExisting: true
      },
      credentials: {
        accessToken: ''
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

          await importPage(fileObj, values.targetConfig.spaceId);
          
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
      <Stack spacing="sm" pt="sm">
        <TextInput
          label="Configuration Name"
          placeholder="My GitHub Sync"
          {...form.getInputProps('name')}
        />

        <TextInput
          label="Schedule (Cron Expression)"
          placeholder="0 0 * * 0"
          {...form.getInputProps('schedule')}
          tooltip="e.g., '0 0 * * 0' for weekly on Sunday at midnight"
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
          placeholder="docs/"
          {...form.getInputProps('sourceConfig.path')}
        />

        <TextInput
          label="GitHub Access Token"
          placeholder="ghp_..."
          {...form.getInputProps('credentials.accessToken')}
        />

        <Select
          label="Target Space"
          placeholder="Select a space"
          data={spaces.map(space => ({
            value: space.id,
            label: space.name
          }))}
          loading={loading}
          {...form.getInputProps('targetConfig.spaceId')}
        />

        <Switch
          label="Update existing pages"
          {...form.getInputProps('targetConfig.updateExisting')}
        />

        <Switch
          label="Enable sync"
          {...form.getInputProps('enabled')}
        />

        <Button 
          variant="outline" 
          onClick={testConnection} 
          mb="sm"
          disabled={!form.values.sourceConfig?.repository || !form.values.credentials?.accessToken}
        >
          Test Connection
        </Button>

        <Button type="submit">
          {isEdit ? 'Update' : 'Create'} Sync Configuration
        </Button>
      </Stack>
    </form>
  );
}; 