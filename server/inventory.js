import { createPicker } from './random.js';

const OPERATING_SYSTEMS = [
  'Ubuntu 24.04 LTS',
  'Debian 12',
  'Red Hat Enterprise Linux 9',
  'Alpine Linux 3.20',
  'Windows Server 2022',
  'Windows 11 Enterprise',
];
const ROLES = ['web', 'db', 'cache', 'vdi', 'build', 'mail', 'proxy', 'queue'];
const MEMORY_SIZES_MB = [2048, 4096, 8192, 16384, 32768];
const NODE_COUNT = 64;
const NODES_PER_CLUSTER = 32;

export function createInventory(count, random) {
  const pick = createPicker(random);
  const vms = new Map();

  for (let i = 1; i <= count; i++) {
    const number = String(i).padStart(5, '0');
    const nodeIndex = i % NODE_COUNT;
    const clusterIndex = Math.floor(nodeIndex / NODES_PER_CLUSTER);
    const roll = random();
    const status = roll < 0.75 ? 'running' : roll < 0.95 ? 'stopped' : 'paused';
    const running = status === 'running';

    vms.set(`vm-${number}`, {
      id: `vm-${number}`,
      name: `${pick(ROLES)}-${number}`,
      cluster: `cluster-${String.fromCharCode(97 + clusterIndex)}`,
      host: `node-${String(nodeIndex + 1).padStart(2, '0')}`,
      ipAddress: `10.${10 + clusterIndex}.${Math.floor(i / 250)}.${(i % 250) + 2}`,
      os: pick(OPERATING_SYSTEMS),
      status,
      cpuUsage: running ? Math.round(random() * 100) : 0,
      memoryMb: pick(MEMORY_SIZES_MB),
      memoryUsage: running ? Math.round(random() * 100) : 0,
      updatedAt: Date.now(),
    });
  }

  return vms;
}
