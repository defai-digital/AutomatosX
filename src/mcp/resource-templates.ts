import type {
  McpResourceTemplate,
  McpResourceTemplateReadResponse
} from './types.js';
import type { ProfileLoader } from '../agents/profile-loader.js';
import type { WorkspaceManager } from '../core/workspace-manager.js';

const AGENT_TEMPLATE_NAME = 'agent_profile';
const AGENT_URI_TEMPLATE = 'agent/{agent}';

const WORKSPACE_PRD_TEMPLATE_NAME = 'workspace_prd_file';
const WORKSPACE_PRD_URI_TEMPLATE = 'workspace/prd/{path}';

const WORKSPACE_TMP_TEMPLATE_NAME = 'workspace_tmp_file';
const WORKSPACE_TMP_URI_TEMPLATE = 'workspace/tmp/{path}';

const RESOURCE_TEMPLATES: McpResourceTemplate[] = [
  {
    name: AGENT_TEMPLATE_NAME,
    uriTemplate: AGENT_URI_TEMPLATE,
    description: 'Render an AutomatosX agent profile by name',
    mimeType: 'text/markdown',
    variableDefinitions: [
      { name: 'agent', description: 'Agent name', required: true }
    ]
  },
  {
    name: WORKSPACE_PRD_TEMPLATE_NAME,
    uriTemplate: WORKSPACE_PRD_URI_TEMPLATE,
    description: 'Read a PRD workspace file (automatosx/PRD)',
    mimeType: 'text/markdown',
    variableDefinitions: [
      { name: 'path', description: 'Relative path under automatosx/PRD', required: true }
    ]
  },
  {
    name: WORKSPACE_TMP_TEMPLATE_NAME,
    uriTemplate: WORKSPACE_TMP_URI_TEMPLATE,
    description: 'Read a temporary workspace file (automatosx/tmp)',
    mimeType: 'text/markdown',
    variableDefinitions: [
      { name: 'path', description: 'Relative path under automatosx/tmp', required: true }
    ]
  }
];

export function listResourceTemplates(): McpResourceTemplate[] {
  return RESOURCE_TEMPLATES;
}

export async function resolveResourceTemplate(
  uri: string,
  variables: Record<string, string> | undefined,
  profileLoader: ProfileLoader,
  workspaceManager: WorkspaceManager
): Promise<McpResourceTemplateReadResponse> {
  if (uri === AGENT_URI_TEMPLATE) {
    const agent = variables?.agent;
    if (!agent) {
      throw new Error('Missing required variable: agent');
    }

    const profile = await profileLoader.loadProfile(agent);
    const summary = [
      `# ${agent}`,
      profile.role ? `**Role:** ${profile.role}` : '',
      profile.abilities?.length ? `**Abilities:** ${profile.abilities.join(', ')}` : '',
      '',
      profile.systemPrompt || 'No system prompt defined.'
    ].filter(Boolean).join('\n');

    return {
      uri: `agent/${agent}`,
      name: `Agent: ${agent}`,
      description: `AutomatosX agent profile for ${agent}`,
      mimeType: 'text/markdown',
      contents: [
        { type: 'text', text: summary },
        { type: 'application/json', json: profile }
      ]
    };
  }

  if (uri === WORKSPACE_PRD_URI_TEMPLATE || uri === WORKSPACE_TMP_URI_TEMPLATE) {
    const path = variables?.path;
    if (!path) {
      throw new Error('Missing required variable: path');
    }

    const isPrd = uri === WORKSPACE_PRD_URI_TEMPLATE;
    const readFn = isPrd ? workspaceManager.readPRD.bind(workspaceManager) : workspaceManager.readTmp.bind(workspaceManager);
    const content = await readFn(path);

    return {
      uri: `${isPrd ? 'prd' : 'tmp'}/${path}`,
      name: `${isPrd ? 'PRD' : 'Tmp'}: ${path}`,
      description: `Workspace ${isPrd ? 'PRD' : 'tmp'} file`,
      mimeType: 'text/markdown',
      contents: [
        { type: 'text', text: content },
        { type: 'application/json', json: { path, content, workspace: isPrd ? 'PRD' : 'tmp' } }
      ]
    };
  }

  throw new Error(`Unknown resource template: ${uri}`);
}
