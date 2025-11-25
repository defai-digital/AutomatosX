// src/bindings/dag.ts
var DEFAULT_TASK_PRIORITY = 5;
function hasCycle(nodes) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = /* @__PURE__ */ new Set();
  const recStack = /* @__PURE__ */ new Set();
  function dfs(nodeId) {
    if (recStack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visited.add(nodeId);
    recStack.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) {
      for (const dep of node.deps) {
        if (dfs(dep)) {
          return true;
        }
      }
    }
    recStack.delete(nodeId);
    return false;
  }
  return nodes.some((n) => dfs(n.id));
}
function findCriticalPath(nodes) {
  if (nodes.length === 0) return [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const longestPath = /* @__PURE__ */ new Map();
  const pathPredecessor = /* @__PURE__ */ new Map();
  const inDegree = /* @__PURE__ */ new Map();
  nodes.forEach((n) => inDegree.set(n.id, n.deps.length));
  const queue = nodes.filter((n) => n.deps.length === 0).map((n) => n.id);
  const sorted = [];
  while (queue.length > 0) {
    const current2 = queue.shift();
    if (current2 === void 0) break;
    sorted.push(current2);
    nodes.forEach((n) => {
      if (n.deps.includes(current2)) {
        const newDegree = (inDegree.get(n.id) ?? 0) - 1;
        inDegree.set(n.id, newDegree);
        if (newDegree === 0) {
          queue.push(n.id);
        }
      }
    });
  }
  if (sorted.length !== nodes.length) {
    return [];
  }
  sorted.forEach((nodeId) => {
    const node = nodeMap.get(nodeId);
    if (node) {
      let maxPredDuration = 0;
      let hasPredecessor = false;
      node.deps.forEach((dep) => {
        const depDuration = longestPath.get(dep) ?? 0;
        if (!hasPredecessor || depDuration > maxPredDuration) {
          maxPredDuration = depDuration;
          pathPredecessor.set(nodeId, dep);
          hasPredecessor = true;
        }
      });
      longestPath.set(nodeId, maxPredDuration + node.estimatedDuration);
    }
  });
  let endNode = "";
  let maxDuration = 0;
  nodes.forEach((node) => {
    const duration = longestPath.get(node.id) ?? 0;
    if (duration > maxDuration) {
      maxDuration = duration;
      endNode = node.id;
    }
  });
  const path = [];
  let current = endNode;
  let maxIterations = nodes.length + 1;
  while (current && maxIterations-- > 0) {
    path.unshift(current);
    current = pathPredecessor.get(current);
  }
  if (maxIterations <= 0 && current) {
    console.warn("[ax/algorithms] Critical path reconstruction hit iteration limit, possible circular predecessor");
  }
  return path;
}
function scheduleParallel(nodes) {
  if (hasCycle(nodes)) {
    return {
      groups: [],
      totalEstimatedDuration: 0,
      criticalPath: [],
      error: "Cycle detected in DAG"
    };
  }
  if (nodes.length === 0) {
    return {
      groups: [],
      totalEstimatedDuration: 0,
      criticalPath: []
    };
  }
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const remaining = new Set(nodes.map((n) => n.id));
  const completed = /* @__PURE__ */ new Set();
  const groups = [];
  let totalDuration = 0;
  while (remaining.size > 0) {
    const ready = [...remaining].filter((nodeId) => {
      const node = nodeMap.get(nodeId);
      return node ? node.deps.every((dep) => completed.has(dep)) : false;
    });
    if (ready.length === 0) {
      break;
    }
    ready.sort((a, b) => {
      const priorityA = nodeMap.get(a)?.priority ?? DEFAULT_TASK_PRIORITY;
      const priorityB = nodeMap.get(b)?.priority ?? DEFAULT_TASK_PRIORITY;
      return priorityA - priorityB;
    });
    const groupDuration = ready.reduce((max, nodeId) => {
      const node = nodeMap.get(nodeId);
      return node ? Math.max(max, node.estimatedDuration) : max;
    }, 0);
    groups.push({
      nodes: ready,
      parallelizable: ready.length > 1,
      estimatedDuration: groupDuration
    });
    totalDuration += groupDuration;
    ready.forEach((id) => {
      completed.add(id);
      remaining.delete(id);
    });
  }
  return {
    groups,
    totalEstimatedDuration: totalDuration,
    criticalPath: findCriticalPath(nodes)
  };
}
function getExecutionOrder(result) {
  return result.groups.flatMap((g) => g.nodes);
}
function validateDag(nodes) {
  const errors = [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  if (nodeIds.size !== nodes.length) {
    errors.push("Duplicate node IDs found");
  }
  nodes.forEach((node) => {
    node.deps.forEach((dep) => {
      if (!nodeIds.has(dep)) {
        errors.push(`Node '${node.id}' has missing dependency '${dep}'`);
      }
    });
  });
  if (hasCycle(nodes)) {
    errors.push("Cycle detected in DAG");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
export {
  findCriticalPath,
  getExecutionOrder,
  hasCycle,
  scheduleParallel,
  validateDag
};
/**
 * TypeScript bindings for ReScript DagScheduler module
 *
 * @module @ax/algorithms/dag
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=dag.js.map