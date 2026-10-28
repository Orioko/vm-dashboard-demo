import { type ReactNode, useMemo, useState } from 'react';

import { useVmList } from '../hooks/useVmList';
import type { Vm } from '../types';
import { AlertIcon, AllVmsIcon, ChevronIcon, ClusterIcon, NodeIcon } from './Icons';

export type InventoryScope =
  | { kind: 'all' }
  | { kind: 'cluster'; name: string }
  | { kind: 'node'; cluster: string; name: string };

interface Summary {
  name: string;
  total: number;
  alerts: number;
}

interface ClusterSummary extends Summary {
  nodes: Summary[];
}

const byName = (a: Summary, b: Summary) => a.name.localeCompare(b.name);

function summarize(vms: Vm[]): ClusterSummary[] {
  const clusters = new Map<string, Map<string, Summary>>();

  for (const vm of vms) {
    let nodes = clusters.get(vm.cluster);
    if (!nodes) clusters.set(vm.cluster, (nodes = new Map()));

    let node = nodes.get(vm.host);
    if (!node) nodes.set(vm.host, (node = { name: vm.host, total: 0, alerts: 0 }));

    node.total += 1;
    if (vm.status === 'error') node.alerts += 1;
  }

  return [...clusters]
    .map(([name, nodes]) => {
      const list = [...nodes.values()].sort(byName);
      return {
        name,
        nodes: list,
        total: list.reduce((sum, node) => sum + node.total, 0),
        alerts: list.reduce((sum, node) => sum + node.alerts, 0),
      };
    })
    .sort(byName);
}

interface TreeRowProps {
  level: number;
  icon: ReactNode;
  label: string;
  summary: Pick<Summary, 'total' | 'alerts'>;
  selected: boolean;
  onSelect: () => void;
  expanded?: boolean;
  onToggle?: () => void;
}

function TreeRow({ level, icon, label, summary, selected, onSelect, expanded, onToggle }: TreeRowProps) {
  return (
    <div className={`tree-row${selected ? ' tree-row--selected' : ''}`} style={{ paddingLeft: 8 + level * 16 }}>
      {onToggle ? (
        <button
          type="button"
          className="tree-row__toggle"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
          onClick={onToggle}
        >
          <ChevronIcon className={expanded ? 'chevron chevron--open' : 'chevron'} />
        </button>
      ) : (
        <span className="tree-row__spacer" />
      )}
      <button type="button" className="tree-row__label" aria-current={selected ? 'true' : undefined} onClick={onSelect}>
        <span className="tree-row__icon">{icon}</span>
        <span className="tree-row__name">{label}</span>
        {summary.alerts > 0 && (
          <span className="tree-row__alert" title={`${summary.alerts} VM(s) in error state`}>
            <AlertIcon />
            {summary.alerts}
          </span>
        )}
        <span className="tree-row__count">{summary.total.toLocaleString('en-US')}</span>
      </button>
    </div>
  );
}

interface InventoryTreeProps {
  scope: InventoryScope;
  onScopeChange: (scope: InventoryScope) => void;
}

export function InventoryTree({ scope, onScopeChange }: InventoryTreeProps) {
  const vms = useVmList();
  const clusters = useMemo(() => summarize(vms), [vms]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const totalAlerts = clusters.reduce((sum, cluster) => sum + cluster.alerts, 0);

  const toggle = (name: string) => setCollapsed((previous) => ({ ...previous, [name]: !previous[name] }));

  return (
    <nav className="inventory" aria-label="Inventory">
      <div className="panel-title">Inventory</div>
      <ul className="tree">
        <li>
          <TreeRow
            level={0}
            icon={<AllVmsIcon />}
            label="All virtual machines"
            summary={{ total: vms.length, alerts: totalAlerts }}
            selected={scope.kind === 'all'}
            onSelect={() => onScopeChange({ kind: 'all' })}
          />
        </li>
        {clusters.map((cluster) => {
          const expanded = !collapsed[cluster.name];
          return (
            <li key={cluster.name}>
              <TreeRow
                level={0}
                icon={<ClusterIcon />}
                label={cluster.name}
                summary={cluster}
                selected={scope.kind === 'cluster' && scope.name === cluster.name}
                onSelect={() => onScopeChange({ kind: 'cluster', name: cluster.name })}
                expanded={expanded}
                onToggle={() => toggle(cluster.name)}
              />
              {expanded && (
                <ul className="tree">
                  {cluster.nodes.map((node) => (
                    <li key={node.name}>
                      <TreeRow
                        level={1}
                        icon={<NodeIcon />}
                        label={node.name}
                        summary={node}
                        selected={scope.kind === 'node' && scope.name === node.name}
                        onSelect={() => onScopeChange({ kind: 'node', cluster: cluster.name, name: node.name })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
