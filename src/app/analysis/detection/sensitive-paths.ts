const SENSITIVE_PATH_LIST: string[] = [
  '/fckeditor/',
  '/fckeditor/editor/',
  '/fckeditor/editor/filemanager/',
  '/ckeditor/',
  '/phpmyadmin/',
  '/phpmyadmin',
  '/pma/',
  '/myadmin/',
  '/wp-admin/',
  '/wp-login.php',
  '/wp-content/uploads/',
  '/administrator/',
  '/admin/config/',
  '/xmlrpc.php',
  '/.env',
  '/.git/config',
  '/.git/head',
  '/.htaccess',
  '/.htpasswd',
  '/server-status',
  '/server-info',
  '/web.config',
  '/wp-config.php',
  '/config.php',
  '/phpinfo.php',
  '/shell.php',
  '/cmd.php',
  '/eval-stdin.php',
  '/cgi-bin/',
  '/manager/html',
  '/actuator/',
  '/api/v1/pods',
  '/.aws/credentials',
  '/etc/passwd',
  '/etc/shadow',
  '/proc/self/environ',
];

const normalizedSet = new Set(SENSITIVE_PATH_LIST.map(p => p.toLowerCase()));

export function isSensitivePath(path: string): boolean {
  const normalized = stripQuery(path).toLowerCase();
  for (const sensitive of normalizedSet) {
    if (sensitive.endsWith('/')) {
      if (normalized === sensitive.slice(0, -1) || normalized.includes(sensitive)) {
        return true;
      }
    } else {
      if (normalized === sensitive) {
        return true;
      }
    }
  }
  return false;
}

function stripQuery(path: string): string {
  const idx = path.indexOf('?');
  return idx >= 0 ? path.slice(0, idx) : path;
}
