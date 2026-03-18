const HCLOUD_TOKEN = process.env.HCLOUD_TOKEN!
const HCLOUD_API = 'https://api.hetzner.cloud/v1'

async function hetznerFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${HCLOUD_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${HCLOUD_TOKEN}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Hetzner API error ${res.status}: ${body}`)
  }
  return res.json()
}

export interface HetznerServer {
  id: number
  name: string
  status: string
  public_net: {
    ipv4: { ip: string }
    ipv6: { ip: string }
  }
  server_type: { name: string; description: string }
  datacenter: { name: string; location: { name: string; city: string } }
  created: string
}

interface ServerConfig {
  name: string
  aiModel?: string        // 'claude' | 'openai' | 'local'
  anthropicKey?: string
  openaiKey?: string
  messagingChannel?: string  // 'telegram' | 'slack' | 'whatsapp'
}

function generateCloudInit(config: ServerConfig): string {
  const envLines: string[] = [
    `MARLENE_SERVER_NAME=${config.name}`,
    `MARLENE_AI_MODEL=${config.aiModel || 'claude'}`,
    `TZ=Europe/Berlin`,
  ]

  if (config.anthropicKey) envLines.push(`ANTHROPIC_API_KEY=${config.anthropicKey}`)
  if (config.openaiKey) envLines.push(`OPENAI_API_KEY=${config.openaiKey}`)
  if (config.messagingChannel) envLines.push(`MARLENE_CHANNEL=${config.messagingChannel}`)

  const envFile = envLines.join('\n')

  return `#cloud-config
package_update: true
package_upgrade: true

packages:
  - curl
  - git
  - ufw
  - jq
  - build-essential

runcmd:
  # Firewall
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable

  # Node.js 22 LTS
  - curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  - apt-get install -y nodejs

  # Marlene Verzeichnis
  - mkdir -p /opt/marlene
  - |
    cat > /opt/marlene/.env << 'ENVFILE'
    ${envFile}
    ENVFILE

  # OpenClaw installieren
  - curl -fsSL https://openclaw.ai/install.sh | bash
  - openclaw onboard --non-interactive || true

  # NemoClaw Security Layer installieren
  - curl -fsSL https://nvidia.com/nemoclaw.sh | bash
  - nemoclaw onboard --non-interactive || true

  # Sandbox für diesen Client erstellen
  - nemoclaw ${config.name} connect || true

  # Systemd Service für Marlene
  - |
    cat > /etc/systemd/system/marlene.service << 'SERVICE'
    [Unit]
    Description=Marlene AI Agent (OpenClaw + NemoClaw)
    After=network.target

    [Service]
    Type=simple
    WorkingDirectory=/opt/marlene
    EnvironmentFile=/opt/marlene/.env
    ExecStart=/usr/bin/openclaw start --sandbox ${config.name}
    Restart=always
    RestartSec=10

    [Install]
    WantedBy=multi-user.target
    SERVICE

  - systemctl daemon-reload
  - systemctl enable marlene
  - systemctl start marlene

  # Status-Datei
  - |
    cat > /opt/marlene/status.json << STATUSEOF
    {
      "status": "active",
      "name": "${config.name}",
      "ai_model": "${config.aiModel || 'claude'}",
      "stack": "openclaw+nemoclaw",
      "deployed_at": "$(date -Iseconds)"
    }
    STATUSEOF
`
}

export async function createServer(config: ServerConfig): Promise<HetznerServer> {
  const cloudInit = generateCloudInit(config)

  const data = await hetznerFetch('/servers', {
    method: 'POST',
    body: JSON.stringify({
      name: config.name,
      server_type: 'cax11',      // 2 vCPU ARM, 4GB RAM, 40GB SSD
      image: 'ubuntu-24.04',
      location: 'nbg1',          // Nürnberg, Deutschland
      start_after_create: true,
      user_data: cloudInit,
      labels: {
        managed_by: 'staima',
        role: 'marlene-bot',
        ai_model: config.aiModel || 'claude',
      },
      public_net: {
        enable_ipv4: true,
        enable_ipv6: true,
      },
    }),
  })

  return data.server as HetznerServer
}

export async function listServers(): Promise<HetznerServer[]> {
  const data = await hetznerFetch('/servers?label_selector=managed_by%3Dstaima&sort=created:desc')
  return data.servers as HetznerServer[]
}

export async function getServer(id: number): Promise<HetznerServer> {
  const data = await hetznerFetch(`/servers/${id}`)
  return data.server as HetznerServer
}

export async function deleteServer(id: number): Promise<void> {
  await hetznerFetch(`/servers/${id}`, { method: 'DELETE' })
}

export async function rebootServer(id: number): Promise<void> {
  await hetznerFetch(`/servers/${id}/actions/reboot`, { method: 'POST' })
}
