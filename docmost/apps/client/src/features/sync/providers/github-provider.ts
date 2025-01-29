import { ISyncProvider } from '../services/sync-provider.interface';
import { ISyncConfig } from '../types/sync.types';
import { importPage } from '@/features/page/services/page-service';
import { Octokit } from '@octokit/rest';

export class GitHubSyncProvider implements ISyncProvider {
  name = 'github';

  async validateConfig(config: ISyncConfig): Promise<boolean> {
    const required = ['repository', 'branch', 'path'];
    return required.every(key => config.sourceConfig[key]);
  }

  async sync(config: ISyncConfig): Promise<void> {
    const octokit = new Octokit({
      auth: config.credentials?.accessToken,
    });

    const { repository, branch, path } = config.sourceConfig;
    const [owner, repo] = repository.split('/');

    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      const content = Array.isArray(response.data) 
        ? response.data 
        : [response.data];

      for (const file of content) {
        if (file.type === 'file') {
          const blob = await octokit.git.getBlob({
            owner,
            repo,
            file_sha: file.sha,
          });

          const fileContent = Buffer.from(blob.data.content, 'base64');
          const fileObj = new File([fileContent], file.name, {
            type: 'text/markdown',
          });

          await importPage(fileObj, config.targetConfig.spaceId);
        }
      }
    } catch (error) {
      console.error('GitHub sync failed:', error);
      throw error;
    }
  }
}