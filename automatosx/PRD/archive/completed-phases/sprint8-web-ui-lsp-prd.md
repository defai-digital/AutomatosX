# Sprint 8: Web UI & LSP Server PRD

**Sprint**: Sprint 8 (Days 71-80)
**Duration**: 10 days (2 weeks)
**Theme**: "Visual Intelligence & Editor Integration"
**Status**: Ready for Planning
**Created**: 2025-11-08

---

## Executive Summary

Sprint 8 transforms AutomatosX from a CLI-only tool into a comprehensive development platform with:
1. **Web-based dashboard** for visual analytics
2. **Language Server Protocol (LSP)** implementation for editor integration
3. **VS Code extension** for seamless IDE experience
4. **Real-time collaboration** features
5. **Enhanced TypeScript integration**

This sprint bridges the gap between terminal-based analytics (Sprint 7) and a full-featured IDE integration, enabling developers to access code intelligence directly in their editors.

**Key Deliverables** (Days 71-80):
- Week 1: Web UI Dashboard + LSP Server Foundation
- Week 2: VS Code Extension + Real-time Collaboration

**Total**: 400 tests, 10 production components

---

## Strategic Goals

### 1. Visual Code Intelligence
Provide rich, interactive web-based dashboards for code quality, dependencies, and technical debt visualization.

### 2. Editor Integration
Deliver code intelligence features (go-to-definition, find references, hover info) directly in VS Code and other LSP-compatible editors.

### 3. Real-time Collaboration
Enable teams to share code insights, annotations, and queries in real-time.

### 4. Professional UX
Match the polish and performance of commercial developer tools (SonarQube, CodeClimate, GitHub Copilot).

---

## Prerequisites (From Sprint 7)

Sprint 8 builds on Sprint 7 deliverables:

✅ State Machines (Day 61) - For UI state management
✅ Task Planning (Day 62) - For background task orchestration
✅ Workflow Orchestrator (Day 63) - For multi-step LSP operations
✅ Event Bus (Day 64) - For real-time updates
✅ ReScript-TypeScript Bridge (Day 65) - For hybrid architecture
✅ Code Quality Analyzer (Day 66) - Data source for dashboards
✅ Dependency Graph (Day 67) - Visualization data
✅ Technical Debt Tracker (Day 68) - Dashboard metrics
✅ Analytics Dashboard (Day 69) - Terminal UI patterns
✅ Query Engine (Day 70) - Data retrieval for UI

**Assumption**: Sprint 7 completed with 400 tests passing ✅

---

## Week 1: Web UI Dashboard + LSP Foundation (Days 71-75)

### Day 71: React Dashboard Framework (40 tests)

**Overview**: Build the foundational React application with routing, state management, and component architecture.

**Functional Requirements**:

**1. Application Shell**

```typescript
// Main application component
interface AppShell {
  router: Router;
  theme: ThemeProvider;
  auth: AuthProvider;
  layout: DashboardLayout;
}

// Routing configuration
const routes = [
  { path: '/', component: HomePage },
  { path: '/quality', component: QualityDashboard },
  { path: '/dependencies', component: DependencyGraph },
  { path: '/debt', component: TechnicalDebtDashboard },
  { path: '/queries', component: QueryBuilder },
  { path: '/settings', component: SettingsPage },
];
```

**2. State Management**

```typescript
// Redux Toolkit slices
interface RootState {
  projects: ProjectsState;
  analytics: AnalyticsState;
  queries: QueriesState;
  ui: UIState;
}

// Project state
interface ProjectsState {
  current: Project | null;
  list: Project[];
  loading: boolean;
  error: string | null;
}

// Analytics state
interface AnalyticsState {
  quality: QualityMetrics | null;
  dependencies: DependencyGraph | null;
  debt: TechnicalDebtSummary | null;
  loading: boolean;
}
```

**3. API Client**

```typescript
// REST API client for AutomatosX backend
class AutomatosXClient {
  async getProjects(): Promise<Project[]>;
  async getQualityMetrics(projectId: string): Promise<QualityMetrics>;
  async getDependencyGraph(projectId: string): Promise<DependencyGraph>;
  async getTechnicalDebt(projectId: string): Promise<TechnicalDebtSummary>;
  async executeQuery(query: string): Promise<QueryResult>;
}

// WebSocket client for real-time updates
class RealtimeClient {
  connect(projectId: string): void;
  subscribe(event: string, handler: EventHandler): void;
  disconnect(): void;
}
```

**4. Component Library**

```typescript
// Reusable UI components
export const components = {
  Chart: LineChart | BarChart | PieChart | ScatterPlot,
  Table: DataTable,
  Card: MetricCard,
  Graph: DependencyGraphVisualization,
  CodeBlock: SyntaxHighlightedCode,
  Modal: ModalDialog,
  Tooltip: InfoTooltip,
};
```

**Non-Functional Requirements**:
- **Performance**: Initial load <2 seconds, route transitions <300ms
- **Responsive**: Desktop (1920x1080), laptop (1366x768), tablet (768x1024)
- **Accessibility**: WCAG 2.1 AA compliance
- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

**Testing Requirements** (40 tests):
- Component rendering (15 tests)
- State management (10 tests)
- Routing (5 tests)
- API client (10 tests)

---

### Day 72: Quality Dashboard UI (45 tests)

**Overview**: Implement the code quality dashboard with interactive charts, metrics, and drill-down capabilities.

**Functional Requirements**:

**1. Quality Overview Page**

```typescript
interface QualityDashboard {
  summary: QualitySummary;
  charts: QualityChart[];
  fileList: QualityFileList;
  trends: QualityTrends;
}

interface QualitySummary {
  maintainabilityScore: number;  // Average across project
  complexity: number;            // Average cyclomatic complexity
  issueCount: number;
  filesAnalyzed: number;
}

// Interactive complexity distribution chart
function ComplexityDistribution({
  data: ComplexityData[],
  onFileClick: (file: string) => void
}): React.Component

// Maintainability trend over time
function MaintainabilityTrend({
  data: TimeSeriesData[],
  timeRange: '7d' | '30d' | '90d'
}): React.Component
```

**2. File Detail View**

```typescript
interface FileQualityDetail {
  file: string;
  metrics: ComplexityMetrics;
  maintainability: MaintainabilityScore;
  codePreview: string;
  issues: MaintainabilityIssue[];
  history: MetricHistory[];
}

// Annotated code view with inline metrics
function AnnotatedCodeView({
  source: string,
  annotations: CodeAnnotation[]
}): React.Component

interface CodeAnnotation {
  line: number;
  type: 'complexity' | 'duplication' | 'smell';
  severity: 'low' | 'medium' | 'high';
  message: string;
}
```

**3. Interactive Charts**

```typescript
// Using Recharts for data visualization
import { LineChart, BarChart, PieChart, Scatter Plot } from 'recharts';

// Complexity over time
function ComplexityOverTime({
  data: { date: string, complexity: number }[]
}): React.Component

// Files by maintainability rating
function MaintainabilityDistribution({
  data: { rating: 'A' | 'B' | 'C' | 'D' | 'F', count: number }[]
}): React.Component
```

**Testing Requirements** (45 tests):
- Dashboard rendering (15 tests)
- Chart interactions (15 tests)
- File detail view (10 tests)
- Data fetching (5 tests)

---

### Day 73: Dependency Graph Visualization (50 tests)

**Overview**: Interactive dependency graph with D3.js force-directed layout, circular dependency highlighting, and impact analysis.

**Functional Requirements**:

**1. Graph Visualization**

```typescript
// D3.js force-directed graph
interface DependencyGraphViz {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: 'force' | 'hierarchical' | 'circular';
  filters: GraphFilters;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'package' | 'module';
  metrics: { complexity: number, lines: number };
  position: { x: number, y: number };
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'import' | 'require' | 'dynamic';
  weight: number;  // Import frequency or dependency strength
}

function ForceDirectedGraph({
  data: DependencyGraphViz,
  onNodeClick: (node: GraphNode) => void,
  onNodeHover: (node: GraphNode | null) => void
}): React.Component
```

**2. Circular Dependency Highlighting**

```typescript
interface CircularDependencyView {
  cycles: CircularDependency[];
  selectedCycle: number | null;
  highlightedNodes: string[];
}

// Highlight cycle paths in red
function HighlightCycles({
  graph: DependencyGraphViz,
  cycles: CircularDependency[]
}): React.Component

// List of all circular dependencies
function CycleList({
  cycles: CircularDependency[],
  onSelect: (cycle: CircularDependency) => void
}): React.Component
```

**3. Impact Analysis View**

```typescript
interface ImpactAnalysisView {
  selectedFile: string;
  directDependents: string[];
  transitiveDependents: string[];
  affectedTests: string[];
  riskScore: number;
}

// Visual representation of impact radius
function ImpactRadius({
  center: string,
  impacted: string[],
  depth: number
}): React.Component
```

**4. Graph Filters & Controls**

```typescript
interface GraphFilters {
  showExternal: boolean;
  minComplexity: number;
  filePattern: string;
  nodeType: 'all' | 'file' | 'package';
  layout: 'force' | 'hierarchical' | 'circular';
}

function GraphControls({
  filters: GraphFilters,
  onChange: (filters: GraphFilters) => void
}): React.Component
```

**Testing Requirements** (50 tests):
- Graph rendering (15 tests)
- Interaction (zoom, pan, drag) (10 tests)
- Circular dependency detection (10 tests)
- Impact analysis (10 tests)
- Filters and controls (5 tests)

---

### Day 74: LSP Server Foundation (40 tests)

**Overview**: Implement Language Server Protocol server for code intelligence features (go-to-definition, hover, references).

**Functional Requirements**:

**1. LSP Server Core**

```typescript
// LSP server implementation
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

class AutomatosXLSP {
  private connection: Connection;
  private documents: TextDocuments<TextDocument>;
  private workspaceRoot: string | null;

  async initialize(params: InitializeParams): Promise<InitializeResult> {
    this.workspaceRoot = params.rootUri;

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        definitionProvider: true,
        referencesProvider: true,
        hoverProvider: true,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.', ':', '<'],
        },
        documentSymbolProvider: true,
        workspaceSymbolProvider: true,
        codeActionProvider: true,
        codeLensProvider: {
          resolveProvider: true,
        },
      },
    };
  }
}
```

**2. Go-to-Definition**

```typescript
// Find symbol definition
async function onDefinition(
  params: DefinitionParams
): Promise<Location | Location[] | null> {
  const { textDocument, position } = params;
  const document = documents.get(textDocument.uri);

  // Get word at position
  const word = getWordAtPosition(document, position);

  // Query AutomatosX database for symbol
  const symbol = await symbolDAO.findByName(word);

  if (symbol) {
    return {
      uri: `file://${symbol.file}`,
      range: {
        start: { line: symbol.line, character: symbol.column },
        end: { line: symbol.line, character: symbol.column + word.length },
      },
    };
  }

  return null;
}
```

**3. Find References**

```typescript
// Find all references to a symbol
async function onReferences(
  params: ReferenceParams
): Promise<Location[]> {
  const { textDocument, position, context } = params;
  const document = documents.get(textDocument.uri);

  const word = getWordAtPosition(document, position);

  // Query call relationships
  const calls = await callDAO.findBySymbol(word);

  return calls.map(call => ({
    uri: `file://${call.file}`,
    range: {
      start: { line: call.line, character: call.column },
      end: { line: call.line, character: call.column + word.length },
    },
  }));
}
```

**4. Hover Information**

```typescript
// Show hover info with complexity, type, documentation
async function onHover(
  params: HoverParams
): Promise<Hover | null> {
  const { textDocument, position } = params;
  const document = documents.get(textDocument.uri);

  const word = getWordAtPosition(document, position);
  const symbol = await symbolDAO.findByName(word);

  if (symbol) {
    const complexity = await complexityAnalyzer.analyze(symbol.file);

    const markdown = `
**${symbol.kind}**: \`${symbol.name}\`

**Complexity**: ${complexity.cyclomatic}
**Maintainability**: ${complexity.maintainability.index}/100

${symbol.documentation || 'No documentation available'}
    `;

    return {
      contents: {
        kind: 'markdown',
        value: markdown,
      },
    };
  }

  return null;
}
```

**5. Code Actions (Quick Fixes)**

```typescript
// Suggest code improvements
async function onCodeAction(
  params: CodeActionParams
): Promise<CodeAction[]> {
  const { textDocument, range, context } = params;
  const document = documents.get(textDocument.uri);

  const actions: CodeAction[] = [];

  // Check for high complexity
  const symbol = await getSymbolAtPosition(document, range.start);
  if (symbol && symbol.complexity > 10) {
    actions.push({
      title: 'Extract method to reduce complexity',
      kind: 'refactor.extract',
      command: {
        command: 'automatosx.extractMethod',
        arguments: [textDocument.uri, range],
      },
    });
  }

  return actions;
}
```

**Testing Requirements** (40 tests):
- LSP initialization (5 tests)
- Go-to-definition (10 tests)
- Find references (10 tests)
- Hover info (10 tests)
- Code actions (5 tests)

---

### Day 75: WebSocket Real-time Updates (45 tests)

**Overview**: Implement WebSocket server for real-time analytics updates, collaborative features, and live dashboard synchronization.

**Functional Requirements**:

**1. WebSocket Server**

```typescript
import { WebSocketServer, WebSocket } from 'ws';

class RealtimeServer {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WebSocket>>;  // projectId -> clients
  private subscriptions: Map<WebSocket, Set<string>>;  // client -> events

  start(port: number): void {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(ws, message);
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: Message): void {
    switch (message.type) {
      case 'subscribe':
        this.subscribe(ws, message.projectId, message.events);
        break;
      case 'unsubscribe':
        this.unsubscribe(ws, message.events);
        break;
      case 'publish':
        this.publish(message.projectId, message.event, message.data);
        break;
    }
  }

  publish(projectId: string, event: string, data: any): void {
    const clients = this.clients.get(projectId) || new Set();

    clients.forEach(client => {
      const subs = this.subscriptions.get(client) || new Set();

      if (subs.has(event) || subs.has('*')) {
        client.send(JSON.stringify({
          type: 'event',
          event,
          data,
          timestamp: Date.now(),
        }));
      }
    });
  }
}
```

**2. Event Types**

```typescript
type RealtimeEvent =
  | 'file.indexed'
  | 'metrics.updated'
  | 'query.executed'
  | 'debt.detected'
  | 'complexity.spike'
  | 'dependency.circular'
  | 'user.joined'
  | 'user.left'
  | 'annotation.added';

interface EventPayload {
  'file.indexed': { file: string, status: 'success' | 'error' };
  'metrics.updated': { file: string, metrics: ComplexityMetrics };
  'query.executed': { query: string, results: number, duration: number };
  'debt.detected': { type: DebtType, file: string, severity: string };
  'complexity.spike': { file: string, before: number, after: number };
  'dependency.circular': { cycle: string[] };
  'user.joined': { userId: string, userName: string };
  'user.left': { userId: string };
  'annotation.added': { file: string, line: number, text: string, author: string };
}
```

**3. Client SDK**

```typescript
// React hook for real-time updates
function useRealtimeUpdates(projectId: string, events: RealtimeEvent[]) {
  const [data, setData] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8080`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        projectId,
        events,
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'event') {
        setData(message.data);
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [projectId, events]);

  return data;
}

// Usage in component
function LiveQualityDashboard({ projectId }: { projectId: string }) {
  const update = useRealtimeUpdates(projectId, ['metrics.updated', 'complexity.spike']);

  useEffect(() => {
    if (update) {
      // Update dashboard with new data
      console.log('New metrics:', update);
    }
  }, [update]);

  return <QualityDashboard />;
}
```

**Testing Requirements** (45 tests):
- WebSocket connection (10 tests)
- Subscribe/unsubscribe (10 tests)
- Event publishing (10 tests)
- Client SDK (10 tests)
- Error handling (5 tests)

---

## Week 2: VS Code Extension + Collaboration (Days 76-80)

### Day 76: VS Code Extension Foundation (40 tests)

**Overview**: Create VS Code extension that integrates AutomatosX LSP and provides UI for analytics.

**Functional Requirements**:

**1. Extension Activation**

```typescript
// extension.ts
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient/node';

export function activate(context: vscode.ExtensionContext) {
  // Start LSP client
  const serverOptions: ServerOptions = {
    command: 'automatosx-lsp',
    args: ['--stdio'],
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'python' },
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{ts,js,py}'),
    },
  };

  const client = new LanguageClient(
    'automatosx',
    'AutomatosX',
    serverOptions,
    clientOptions
  );

  client.start();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('automatosx.showQuality', showQualityDashboard),
    vscode.commands.registerCommand('automatosx.showDependencies', showDependencies),
    vscode.commands.registerCommand('automatosx.showDebt', showTechnicalDebt),
    vscode.commands.registerCommand('automatosx.runQuery', runQuery)
  );
}
```

**2. Tree View for Code Metrics**

```typescript
// Sidebar tree view showing file quality
class QualityTreeDataProvider implements vscode.TreeDataProvider<QualityItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<QualityItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  async getChildren(element?: QualityItem): Promise<QualityItem[]> {
    if (!element) {
      // Root level - show project summary
      const files = await this.getFilesWithIssues();
      return files.map(file => new QualityItem(file));
    } else {
      // Show issues for this file
      return element.getIssues();
    }
  }

  getTreeItem(element: QualityItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

class QualityItem extends vscode.TreeItem {
  constructor(
    public readonly file: string,
    public readonly metrics?: ComplexityMetrics
  ) {
    super(file, vscode.TreeItemCollapsibleState.Collapsed);

    if (metrics) {
      this.description = `Complexity: ${metrics.cyclomatic}`;
      this.iconPath = this.getIcon(metrics);
    }
  }

  private getIcon(metrics: ComplexityMetrics): vscode.ThemeIcon {
    if (metrics.cyclomatic > 20) {
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
    } else if (metrics.cyclomatic > 10) {
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('warningForeground'));
    }
    return new vscode.ThemeIcon('pass', new vscode.ThemeColor('successForeground'));
  }
}
```

**3. Inline Annotations**

```typescript
// Show inline complexity annotations
function createInlineAnnotations(editor: vscode.TextEditor) {
  const decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      fontStyle: 'italic',
    },
  });

  const decorations: vscode.DecorationOptions[] = [];

  // Get complexity for each function
  const functions = parseFunctions(editor.document);

  for (const func of functions) {
    const complexity = calculateComplexity(func);

    decorations.push({
      range: new vscode.Range(func.line, 0, func.line, 0),
      renderOptions: {
        after: {
          contentText: ` Complexity: ${complexity}`,
        },
      },
    });
  }

  editor.setDecorations(decorationType, decorations);
}
```

**4. Webview Panels**

```typescript
// Show analytics in webview
function showQualityDashboard() {
  const panel = vscode.window.createWebviewPanel(
    'automatosxQuality',
    'Code Quality',
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
    }
  );

  panel.webview.html = getWebviewContent();

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'openFile':
          openFile(message.file, message.line);
          break;
      }
    }
  );
}

function getWebviewContent(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Code Quality</title>
    </head>
    <body>
      <div id="root"></div>
      <script src="dashboard.js"></script>
    </body>
    </html>
  `;
}
```

**Testing Requirements** (40 tests):
- Extension activation (5 tests)
- LSP client connection (10 tests)
- Tree view (10 tests)
- Inline annotations (10 tests)
- Webview panels (5 tests)

---

### Day 77: Code Lens & Diagnostics (45 tests)

**Overview**: Implement Code Lens for complexity metrics and diagnostic warnings for code quality issues.

**Functional Requirements**:

**1. Code Lens Provider**

```typescript
class ComplexityCodeLensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(
    document: vscode.TextDocument
  ): Promise<vscode.CodeLens[]> {
    const lenses: vscode.CodeLens[] = [];
    const functions = await parseFunctions(document);

    for (const func of functions) {
      const complexity = await calculateComplexity(func);
      const range = new vscode.Range(func.startLine, 0, func.startLine, 0);

      lenses.push(
        new vscode.CodeLens(range, {
          title: `Complexity: ${complexity.cyclomatic}`,
          command: 'automatosx.showComplexityDetails',
          arguments: [func],
        })
      );

      // Add reference count
      const references = await findReferences(func.name);
      lenses.push(
        new vscode.CodeLens(range, {
          title: `${references.length} references`,
          command: 'automatosx.showReferences',
          arguments: [func],
        })
      );
    }

    return lenses;
  }
}
```

**2. Diagnostic Provider**

```typescript
// Show diagnostics for code quality issues
async function updateDiagnostics(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
) {
  const diagnostics: vscode.Diagnostic[] = [];

  const quality = await analyzeFileQuality(document.uri.fsPath);

  // High complexity warning
  for (const func of quality.functions) {
    if (func.complexity > 10) {
      const range = new vscode.Range(func.startLine, 0, func.endLine, 0);
      const diagnostic = new vscode.Diagnostic(
        range,
        `High cyclomatic complexity (${func.complexity}). Consider refactoring.`,
        func.complexity > 20 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'AutomatosX';
      diagnostic.code = 'high-complexity';
      diagnostics.push(diagnostic);
    }
  }

  // Technical debt
  for (const debt of quality.debt) {
    const range = new vscode.Range(debt.line, 0, debt.line, 100);
    const diagnostic = new vscode.Diagnostic(
      range,
      debt.description,
      debt.severity === 'high' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information
    );
    diagnostic.source = 'AutomatosX';
    diagnostic.code = `debt-${debt.type}`;
    diagnostics.push(diagnostic);
  }

  collection.set(document.uri, diagnostics);
}
```

**3. Quick Fixes**

```typescript
// Provide quick fixes for diagnostics
class QuickFixProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.code === 'high-complexity') {
        const action = new vscode.CodeAction(
          'Extract method',
          vscode.CodeActionKind.RefactorExtract
        );
        action.command = {
          command: 'automatosx.extractMethod',
          title: 'Extract method to reduce complexity',
          arguments: [document, range],
        };
        actions.push(action);
      }
    }

    return actions;
  }
}
```

**Testing Requirements** (45 tests):
- Code Lens provider (15 tests)
- Diagnostic generation (15 tests)
- Quick fixes (10 tests)
- Integration (5 tests)

---

### Day 78: Collaborative Annotations (40 tests)

**Overview**: Enable team members to add annotations, comments, and share insights on code.

**Functional Requirements**:

**1. Annotation System**

```typescript
interface Annotation {
  id: string;
  file: string;
  line: number;
  author: string;
  text: string;
  type: 'comment' | 'todo' | 'warning' | 'improvement';
  timestamp: Date;
  resolved: boolean;
}

class AnnotationService {
  async addAnnotation(annotation: Omit<Annotation, 'id' | 'timestamp'>): Promise<Annotation> {
    const id = uuid();
    const timestamp = new Date();

    const fullAnnotation = { ...annotation, id, timestamp };

    // Save to database
    await annotationDAO.create(fullAnnotation);

    // Broadcast to collaborators
    realtimeServer.publish(annotation.file, 'annotation.added', fullAnnotation);

    return fullAnnotation;
  }

  async getAnnotations(file: string): Promise<Annotation[]> {
    return annotationDAO.findByFile(file);
  }

  async resolveAnnotation(id: string): Promise<void> {
    await annotationDAO.update(id, { resolved: true });
    realtimeServer.publish('*', 'annotation.resolved', { id });
  }
}
```

**2. VS Code Annotation UI**

```typescript
// Show annotations as comments in editor
function showAnnotations(editor: vscode.TextEditor, annotations: Annotation[]) {
  const decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('descriptionForeground'),
      margin: '0 0 0 3em',
    },
    isWholeLine: true,
  });

  const decorations = annotations.map(ann => ({
    range: new vscode.Range(ann.line, 0, ann.line, 0),
    renderOptions: {
      after: {
        contentText: `💬 ${ann.author}: ${ann.text}`,
      },
    },
  }));

  editor.setDecorations(decorationType, decorations);
}

// Command to add annotation
async function addAnnotationCommand() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const text = await vscode.window.showInputBox({
    prompt: 'Enter annotation text',
  });

  if (text) {
    const annotation = await annotationService.addAnnotation({
      file: editor.document.uri.fsPath,
      line: editor.selection.active.line,
      author: getCurrentUser(),
      text,
      type: 'comment',
      resolved: false,
    });

    // Refresh decorations
    showAnnotations(editor, await annotationService.getAnnotations(editor.document.uri.fsPath));
  }
}
```

**3. Shared Query Results**

```typescript
// Share query results with team
interface SharedQuery {
  id: string;
  name: string;
  query: string;
  author: string;
  results: QueryResult;
  timestamp: Date;
  visibility: 'private' | 'team' | 'public';
}

async function shareQueryResults(query: string, results: QueryResult) {
  const shared: SharedQuery = {
    id: uuid(),
    name: await vscode.window.showInputBox({ prompt: 'Query name' }),
    query,
    author: getCurrentUser(),
    results,
    timestamp: new Date(),
    visibility: 'team',
  };

  await sharedQueryDAO.create(shared);
  realtimeServer.publish('*', 'query.shared', shared);

  vscode.window.showInformationMessage('Query results shared with team');
}
```

**Testing Requirements** (40 tests):
- Annotation CRUD (15 tests)
- UI rendering (10 tests)
- Real-time sync (10 tests)
- Shared queries (5 tests)

---

### Day 79: Performance Optimization (45 tests)

**Overview**: Optimize web UI rendering, LSP response times, and database queries for production performance.

**Functional Requirements**:

**1. Web UI Optimization**

```typescript
// Virtual scrolling for large lists
import { FixedSizeList } from 'react-window';

function VirtualizedFileList({ files }: { files: FileQuality[] }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <FileQualityRow file={files[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={files.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}

// Memoization for expensive computations
import { useMemo } from 'react';

function QualityDashboard({ files }: { files: FileQuality[] }) {
  const summary = useMemo(() => {
    return files.reduce((acc, file) => ({
      totalComplexity: acc.totalComplexity + file.complexity,
      avgMaintainability: acc.avgMaintainability + file.maintainability / files.length,
      issueCount: acc.issueCount + file.issues.length,
    }), { totalComplexity: 0, avgMaintainability: 0, issueCount: 0 });
  }, [files]);

  return <SummaryCard data={summary} />;
}

// Code splitting
const QualityDashboard = lazy(() => import('./QualityDashboard'));
const DependencyGraph = lazy(() => import('./DependencyGraph'));
const TechnicalDebt = lazy(() => import('./TechnicalDebt'));
```

**2. LSP Caching**

```typescript
// Cache symbol lookups
class LSPCache {
  private symbolCache = new Map<string, Symbol>();
  private definitionCache = new Map<string, Location>();
  private ttl = 5 * 60 * 1000; // 5 minutes

  async getSymbol(name: string): Promise<Symbol | null> {
    const cached = this.symbolCache.get(name);
    if (cached && !this.isExpired(cached)) {
      return cached;
    }

    const symbol = await symbolDAO.findByName(name);
    if (symbol) {
      this.symbolCache.set(name, symbol);
    }

    return symbol;
  }

  invalidate(file: string): void {
    // Clear cache for file
    for (const [key, symbol] of this.symbolCache) {
      if (symbol.file === file) {
        this.symbolCache.delete(key);
      }
    }
  }
}
```

**3. Database Query Optimization**

```sql
-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_symbols_name_file ON symbols(name, file_id);
CREATE INDEX IF NOT EXISTS idx_calls_caller_callee ON calls(caller_id, callee_id);
CREATE INDEX IF NOT EXISTS idx_dependency_graph_from_to ON dependency_graph(from_file_id, to_file_id);

-- Materialized view for quality summary
CREATE VIEW IF NOT EXISTS quality_summary AS
SELECT
  f.id,
  f.path,
  AVG(cm.complexity_cyclomatic) as avg_complexity,
  AVG(cm.maintainability_index) as avg_maintainability,
  COUNT(td.id) as debt_count
FROM files f
LEFT JOIN code_metrics cm ON cm.file_id = f.id
LEFT JOIN technical_debt td ON td.file_id = f.id
GROUP BY f.id;
```

**4. Incremental Updates**

```typescript
// Only re-analyze changed files
class IncrementalAnalyzer {
  async analyzeChanges(changedFiles: string[]): Promise<void> {
    const batch = changedFiles.slice(0, 10); // Process in batches

    await Promise.all(batch.map(async file => {
      const metrics = await qualityAnalyzer.analyzeFile(file);
      await codeMetricsDAO.upsert(metrics);

      // Broadcast update
      realtimeServer.publish(file, 'metrics.updated', metrics);
    }));
  }
}
```

**Testing Requirements** (45 tests):
- UI rendering performance (15 tests)
- LSP response time (10 tests)
- Database query optimization (10 tests)
- Incremental analysis (10 tests)

---

### Day 80: Sprint 8 Gate Review & Documentation (40 tests)

**Overview**: Final testing, documentation, deployment preparation, and sprint gate review.

**Deliverables**:

**1. Integration Tests** (20 tests)

```typescript
// End-to-end tests
describe('Web UI to LSP Integration', () => {
  it('should show definition when clicking symbol in web UI', async () => {
    // Open web dashboard
    // Click on symbol
    // Verify LSP go-to-definition works
  });

  it('should update dashboard when LSP detects file change', async () => {
    // Edit file in VS Code
    // Wait for LSP to process
    // Verify dashboard updates
  });
});

describe('Real-time Collaboration', () => {
  it('should sync annotations across clients', async () => {
    // Client A adds annotation
    // Verify Client B receives update
  });

  it('should broadcast metrics updates', async () => {
    // Trigger file analysis
    // Verify all clients receive update
  });
});
```

**2. Documentation**

```markdown
# AutomatosX Web UI & LSP Documentation

## Web Dashboard

### Getting Started
1. Start the web server: `npm run web:start`
2. Open browser: `http://localhost:3000`
3. Select project to analyze

### Features
- **Quality Dashboard**: View code quality metrics, complexity trends
- **Dependency Graph**: Interactive visualization of dependencies
- **Technical Debt**: Track and manage technical debt
- **Query Builder**: Build and execute custom analytics queries

## VS Code Extension

### Installation
1. Install from VS Code marketplace: "AutomatosX"
2. Or: `code --install-extension automatosx.vscode-automatosx`

### Commands
- `AutomatosX: Show Quality Dashboard` - Open quality dashboard
- `AutomatosX: Show Dependencies` - View dependency graph
- `AutomatosX: Show Technical Debt` - View debt items
- `AutomatosX: Run Query` - Execute analytics query

### Code Lens
- Shows complexity for each function
- Shows reference count
- Click to view details

## LSP Features

### Go-to-Definition
- Jump to symbol definition across files
- Works with TypeScript, JavaScript, Python

### Find References
- Find all usages of a symbol
- Supports cross-file references

### Hover Information
- View complexity metrics on hover
- See documentation and type info

### Code Actions
- Extract method to reduce complexity
- Refactor to improve maintainability
```

**3. Performance Benchmarks** (10 tests)

```typescript
describe('Performance Benchmarks', () => {
  it('should load dashboard in <2 seconds', async () => {
    const start = Date.now();
    await loadDashboard();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
  });

  it('should handle 10K files in dependency graph', async () => {
    const graph = await buildDependencyGraph(10000);
    expect(graph.nodes.length).toBe(10000);
    // Should complete in reasonable time
  });

  it('should respond to LSP requests in <100ms', async () => {
    const start = Date.now();
    await lspServer.onDefinition(params);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
```

**4. Deployment Guide** (5 tests)

```markdown
# Deployment Guide

## Web UI

### Production Build
```bash
npm run web:build
npm run web:serve
```

### Docker
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

## LSP Server

### Binary Distribution
```bash
npm run lsp:build
npm run lsp:package
```

### VS Code Extension
```bash
npm run extension:build
vsce package
vsce publish
```

## Database

### Migration
```bash
npm run migrate
```

### Backup
```bash
sqlite3 .automatosx/db/code-intelligence.db ".backup backup.db"
```
```

**5. Sprint Gate Checklist** (5 tests)

- ✅ Web UI dashboard functional
- ✅ LSP server responding correctly
- ✅ VS Code extension working
- ✅ Real-time updates synchronized
- ✅ 400 tests passing (100% pass rate)
- ✅ Performance benchmarks met
- ✅ Documentation complete
- ✅ Deployment tested
- ✅ Security audit passed
- ✅ Ready for production

**Testing Requirements** (40 tests):
- Integration tests (20 tests)
- Performance benchmarks (10 tests)
- Deployment tests (5 tests)
- Security tests (5 tests)

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| **Total Tests** | 400 | ___ |
| **Test Pass Rate** | 100% | ___ |
| **Web UI Load Time** | <2s | ___ |
| **LSP Response Time** | <100ms | ___ |
| **WebSocket Latency** | <50ms | ___ |
| **Dashboard FPS** | 60fps | ___ |
| **VS Code Extension Rating** | 4.5+ stars | ___ |

---

## Technology Stack

### Web UI
- **Framework**: React 18+ with TypeScript
- **State Management**: Redux Toolkit
- **Routing**: React Router v6
- **Charts**: Recharts, D3.js
- **UI Components**: Material-UI or Ant Design
- **Build**: Vite

### LSP Server
- **Runtime**: Node.js 18+
- **Protocol**: vscode-languageserver
- **Parser**: Tree-sitter (already in use)

### VS Code Extension
- **API**: VS Code Extension API
- **Language**: TypeScript
- **Build**: esbuild

### Real-time
- **WebSocket**: ws library
- **Protocol**: Custom JSON-RPC

---

## Risks & Mitigation

**Technical Risks**:
- Web UI performance with large datasets → Virtual scrolling, pagination, lazy loading
- LSP response time → Caching, incremental analysis, indexing
- WebSocket scalability → Load balancing, connection pooling

**Integration Risks**:
- LSP compatibility with editors → Follow LSP spec strictly, test with multiple editors
- Real-time sync conflicts → Operational transformation or CRDT

---

## Next Sprint

**Sprint 9** (Days 81-90): ML & Cloud
- ML-powered semantic search
- Distributed indexing
- Cloud deployment
- CI/CD integrations

---

**Status**: ✅ **READY FOR IMPLEMENTATION**
**Duration**: 10 days (Days 71-80)
**Prerequisites**: Sprint 7 complete (400 tests passing)
**Team**: 2-3 engineers

---

**Document Version**: 1.0
**Created**: 2025-11-08
**Sprint**: Sprint 8 (Days 71-80)
