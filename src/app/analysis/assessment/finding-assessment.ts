import { Finding, DetectionRule } from '../detection/detection-models';

const TOOL_PATTERNS: readonly [string, string][] = [
  ['chef client', 'Chef Client'],
  ['puppet', 'Puppet'],
  ['ansible', 'Ansible'],
  ['terraform', 'Terraform'],
  ['jenkins', 'Jenkins'],
  ['github-actions', 'GitHub Actions'],
  ['gitlab-runner', 'GitLab Runner'],
  ['python-requests', 'Python requests'],
  ['python-urllib', 'Python urllib'],
  ['go-http-client', 'Go HTTP client'],
  ['apache-httpclient', 'Apache HttpClient'],
  ['node-fetch', 'node-fetch'],
  ['axios/', 'Axios'],
  ['curl/', 'curl'],
  ['wget/', 'wget'],
];

export function identifyAutomationTool(userAgent: string): string | null {
  if (!userAgent || userAgent === '-') return null;
  const ua = userAgent.toLowerCase();
  for (const [pattern, label] of TOOL_PATTERNS) {
    if (ua.includes(pattern)) return label;
  }
  return null;
}

export function findingAssessment(finding: Finding): string {
  const base = ruleBaseAssessment(finding.rule);
  const context = userAgentContext(finding);
  return context ? `${base} ${context}` : base;
}

function ruleBaseAssessment(rule: DetectionRule): string {
  switch (rule) {
    case 'VULNERABILITY_PATH_PROBING':
      return 'Pattern is consistent with automated vulnerability-path probing.';
    case 'REPEATED_FAILED_RESOURCE':
      return 'Repeated failed requests to the same resource may indicate automated retrieval attempts or a misconfigured client.';
    case 'REPEATED_REQUEST_PATTERNS':
      return 'Highly repetitive request sequences may indicate automated behavior. However, this pattern alone does not confirm that the source is a bot or that its activity is malicious.';
  }
}

function userAgentContext(finding: Finding): string {
  const agents = new Set(finding.evidenceRecords.map(r => r.userAgent));
  agents.delete('-');
  agents.delete('');

  if (agents.size === 0) return '';

  const tools: string[] = [];
  for (const agent of agents) {
    const tool = identifyAutomationTool(agent);
    if (tool && !tools.includes(tool)) tools.push(tool);
  }

  if (tools.length === 0) return '';

  const toolList = tools.join(', ');

  if (finding.rule === 'REPEATED_FAILED_RESOURCE') {
    return `The User-Agent identifies as ${toolList}, suggesting automated retrieval or client misconfiguration rather than malicious intent.`;
  }

  return `The User-Agent identifies as ${toolList}, which may indicate automated or programmatic access.`;
}
