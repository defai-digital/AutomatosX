/**
 * Tests for PRDGenerator
 *
 * Tests PRD generation with feature detection integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PRDGenerator, type PRDGenerateOptions } from '../PRDGenerator.js';
import type { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import type { MemoryService } from '../../memory/MemoryService.js';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('PRDGenerator', () => {
  let generator: PRDGenerator;
  let mockProviderRouter: ProviderRouterV2;
  let mockMemoryService: MemoryService;

  beforeEach(() => {
    // Create mocks
    mockProviderRouter = {
      route: vi.fn().mockResolvedValue({
        content: `# Product Requirements Document

## 1. Executive Summary
This document outlines the comprehensive requirements for implementing a robust authentication and authorization system. The system will provide secure user access, session management, and role-based permissions to support our application's security needs.

## 2. Product Vision
A comprehensive authentication system that delivers secure, scalable, and user-friendly access control. The system will handle user registration, login, password management, session handling, JWT token generation, and role-based access control.

## 3. Goals and Objectives
- Implement secure user authentication with industry-standard encryption
- Provide easy onboarding experience with email verification
- Build scalable architecture that supports 100,000+ concurrent users
- Ensure 99.9% uptime for authentication services
- Maintain sub-200ms authentication latency

## 4. Features and Requirements

### User Registration
**Description**: Users can create accounts with email/password credentials. System validates email format, enforces password strength requirements, and sends verification emails.

**Requirements**:
- Email/password registration with validation
- Email verification required before account activation
- Password strength validation (min 8 chars, uppercase, lowercase, number, special char)
- Duplicate email prevention
- CAPTCHA integration for bot prevention

**Priority**: P0
**Complexity**: Medium
**Timeline**: Week 1-2

### User Login
**Description**: Secure login mechanism with credentials, session management using JWT tokens, and remember-me functionality for user convenience.

**Requirements**:
- Secure login with email/password
- JWT token generation and validation
- Session management with configurable timeout
- Remember me functionality (30-day tokens)
- Failed login attempt tracking and account lockout
- Rate limiting for brute force protection

**Priority**: P0
**Complexity**: Low
**Timeline**: Week 1-2

### Password Management
**Description**: Password reset, change password, and password history tracking.

**Requirements**:
- Password reset via email token
- Change password for authenticated users
- Password history (prevent reuse of last 5 passwords)
- Secure password hashing with bcrypt (cost factor 12)

**Priority**: P0
**Complexity**: Low
**Timeline**: Week 2

## 5. Technical Architecture
- **Backend**: Node.js with Express framework
- **Database**: PostgreSQL for user data storage
- **Session Store**: Redis for JWT token caching
- **Email**: SendGrid for transactional emails
- **Security**: bcrypt for password hashing, JWT for stateless authentication

## 6. Success Metrics
- 99.9% authentication service uptime
- Sub-200ms average authentication latency
- Zero security vulnerabilities in authentication flow
- 95%+ user satisfaction score
- < 2% failed authentication rate

## 7. Risk Assessment
**High Risk**:
- JWT token security and expiration handling
- Brute force attack mitigation

**Medium Risk**:
- Email deliverability for verification
- Session management at scale

**Low Risk**:
- Password strength validation
- User interface design`,
        provider: 'claude',
      }),
    } as any;

    mockMemoryService = {
      search: vi.fn().mockImplementation((query: string) => {
        // Match regex patterns, not exact strings
        if (query.match(/auth|login|signup|password|token|session|jwt/i)) {
          return Promise.resolve([
            {
              file: 'src/auth/AuthService.ts',
              line: 10,
              name: 'AuthService',
              content: 'class AuthService { async login() {} async signup() {} authenticate() {} }',
            },
            {
              file: 'src/auth/routes.ts',
              line: 5,
              name: 'loginHandler',
              content: 'router.post("/auth/login", loginHandler)',
            },
            {
              file: 'src/auth/LoginController.ts',
              line: 15,
              name: 'LoginController',
              content: 'class LoginController { async handleLogin() { /* JWT token generation */ } }',
            },
            {
              file: 'src/auth/SignupController.ts',
              line: 20,
              name: 'SignupController',
              content: 'class SignupController { async register() { /* password hashing */ } }',
            },
            {
              file: 'src/middleware/auth.ts',
              line: 8,
              name: 'authMiddleware',
              content: 'export const authMiddleware = (req, res, next) => { /* JWT token validation */ }',
            },
            {
              file: 'src/models/User.ts',
              line: 3,
              name: 'User',
              content: 'interface User { id: string; email: string; password: string; token?: string; }',
            },
            {
              file: 'src/services/TokenService.ts',
              line: 12,
              name: 'TokenService',
              content: 'class TokenService { generateJWT() {} verifyToken() {} }',
            },
            {
              file: 'src/services/SessionService.ts',
              line: 18,
              name: 'SessionService',
              content: 'class SessionService { createSession() {} destroySession() {} }',
            },
            {
              file: 'src/utils/password.ts',
              line: 5,
              name: 'hashPassword',
              content: 'export function hashPassword(password: string) { /* bcrypt hashing */ }',
            },
            {
              file: 'src/config/auth.ts',
              line: 2,
              name: 'authConfig',
              content: 'export const authConfig = { jwtSecret: "...", sessionTimeout: 3600 }',
            },
            {
              file: 'src/routes/auth.routes.ts',
              line: 10,
              name: 'authRoutes',
              content: 'router.post("/signup", signupHandler); router.post("/login", loginHandler);',
            },
            {
              file: 'tests/auth/login.test.ts',
              line: 1,
              name: 'login tests',
              content: 'describe("login authentication", () => { it("should authenticate user", async () => {}) })',
            },
          ]); // 12 results → confidence = (12/10)*0.6 = 0.6 (capped) → passes threshold!
        }
        if (query.match(/GET|POST|PUT|DELETE|endpoint|route|handler|api/i)) {
          return Promise.resolve([
            {
              file: 'src/api/users.ts',
              line: 15,
              name: 'getUsersHandler',
              content: 'router.get("/api/users", getUsersHandler)',
            },
            {
              file: 'src/api/posts.ts',
              line: 20,
              name: 'createPostHandler',
              content: 'router.post("/api/posts", createPostHandler)',
            },
            {
              file: 'src/api/comments.ts',
              line: 10,
              name: 'getCommentsHandler',
              content: 'router.get("/api/comments", getCommentsHandler)',
            },
            {
              file: 'src/api/products.ts',
              line: 25,
              name: 'updateProductHandler',
              content: 'router.put("/api/products/:id", updateProductHandler)',
            },
            {
              file: 'src/api/orders.ts',
              line: 30,
              name: 'deleteOrderHandler',
              content: 'router.delete("/api/orders/:id", deleteOrderHandler)',
            },
            {
              file: 'src/routes/api.ts',
              line: 5,
              name: 'apiRoutes',
              content: 'const apiRoutes = express.Router(); // Central API routing',
            },
            {
              file: 'src/controllers/ApiController.ts',
              line: 12,
              name: 'ApiController',
              content: 'class ApiController { handleRequest() {} handleResponse() {} }',
            },
            {
              file: 'src/middleware/api.ts',
              line: 8,
              name: 'apiMiddleware',
              content: 'export const apiMiddleware = (req, res, next) => { /* API validation */ }',
            },
            {
              file: 'src/services/ApiService.ts',
              line: 18,
              name: 'ApiService',
              content: 'class ApiService { get() {} post() {} put() {} delete() {} }',
            },
            {
              file: 'src/utils/api.ts',
              line: 3,
              name: 'apiHelpers',
              content: 'export const buildApiResponse = (data) => ({ success: true, data });',
            },
            {
              file: 'src/config/api.ts',
              line: 1,
              name: 'apiConfig',
              content: 'export const apiConfig = { baseUrl: "/api", version: "v1" };',
            },
            {
              file: 'tests/api/endpoints.test.ts',
              line: 5,
              name: 'API tests',
              content: 'describe("API endpoints", () => { it("GET /api/users", async () => {}) });',
            },
          ]); // 12 results for API features
        }
        if (query.match(/component|widget|page|view|render/i)) {
          return Promise.resolve([
            {
              file: 'src/components/UserCard.tsx',
              line: 5,
              name: 'UserCard',
              content: 'export function UserCard(props: UserCardProps) { return <div>...</div> }',
            },
            {
              file: 'src/components/Header.tsx',
              line: 3,
              name: 'Header',
              content: 'export const Header = () => <header>...</header>',
            },
            {
              file: 'src/components/Footer.tsx',
              line: 3,
              name: 'Footer',
              content: 'export const Footer = () => <footer>...</footer>',
            },
            {
              file: 'src/pages/HomePage.tsx',
              line: 10,
              name: 'HomePage',
              content: 'export function HomePage() { return <div className="page">...</div> }',
            },
            {
              file: 'src/pages/ProfilePage.tsx',
              line: 12,
              name: 'ProfilePage',
              content: 'export function ProfilePage() { return <div>Profile</div> }',
            },
            {
              file: 'src/widgets/UserWidget.tsx',
              line: 8,
              name: 'UserWidget',
              content: 'export const UserWidget = ({ user }) => <div>{user.name}</div>',
            },
            {
              file: 'src/views/ListView.tsx',
              line: 15,
              name: 'ListView',
              content: 'export function ListView() { return <ul>...</ul> }',
            },
            {
              file: 'src/layouts/MainLayout.tsx',
              line: 5,
              name: 'MainLayout',
              content: 'export const MainLayout = ({ children }) => <div>{children}</div>',
            },
            {
              file: 'src/components/Button.tsx',
              line: 2,
              name: 'Button',
              content: 'export const Button = ({ label, onClick }) => <button onClick={onClick}>{label}</button>',
            },
            {
              file: 'src/components/Modal.tsx',
              line: 18,
              name: 'Modal',
              content: 'export function Modal({ isOpen, onClose, children }) { return isOpen ? <div>...</div> : null }',
            },
            {
              file: 'tests/components/UserCard.test.tsx',
              line: 1,
              name: 'UserCard tests',
              content: 'describe("UserCard component", () => { it("renders user data", () => {}) })',
            },
          ]); // 11 results for UI features
        }
        if (query.match(/model|schema|entity|table|collection|interface/i)) {
          return Promise.resolve([
            {
              file: 'src/models/User.ts',
              line: 3,
              name: 'User',
              content: 'interface User { id: string; name: string; email: string; }',
            },
            {
              file: 'src/models/Post.ts',
              line: 5,
              name: 'Post',
              content: 'interface Post { id: string; title: string; content: string; authorId: string; }',
            },
            {
              file: 'src/models/Comment.ts',
              line: 7,
              name: 'Comment',
              content: 'interface Comment { id: string; postId: string; userId: string; text: string; }',
            },
            {
              file: 'src/schemas/UserSchema.ts',
              line: 2,
              name: 'UserSchema',
              content: 'export const UserSchema = z.object({ id: z.string(), email: z.string().email() });',
            },
            {
              file: 'src/entities/Product.ts',
              line: 10,
              name: 'Product',
              content: 'export class Product { id: string; name: string; price: number; }',
            },
            {
              file: 'src/database/tables.ts',
              line: 15,
              name: 'tables',
              content: 'export const tables = { users: "users", posts: "posts", comments: "comments" };',
            },
            {
              file: 'src/types/User.d.ts',
              line: 1,
              name: 'UserType',
              content: 'export type UserType = { id: string; email: string; role: "admin" | "user"; }',
            },
            {
              file: 'src/models/Order.ts',
              line: 8,
              name: 'Order',
              content: 'interface Order { id: string; userId: string; items: OrderItem[]; total: number; }',
            },
            {
              file: 'src/schemas/ProductSchema.ts',
              line: 4,
              name: 'ProductSchema',
              content: 'export const ProductSchema = z.object({ name: z.string(), price: z.number() });',
            },
            {
              file: 'src/entities/Category.ts',
              line: 6,
              name: 'Category',
              content: 'export class Category { id: string; name: string; parentId?: string; }',
            },
            {
              file: 'tests/models/User.test.ts',
              line: 1,
              name: 'User model tests',
              content: 'describe("User model", () => { it("validates email", () => {}) })',
            },
          ]); // 11 results for data model features
        }
        if (query.match(/integration|webhook|service|client/i)) {
          return Promise.resolve([
            {
              file: 'src/services/StripeService.ts',
              line: 10,
              name: 'StripeService',
              content: 'class StripeService { async createCharge() {} }',
            },
            {
              file: 'src/services/EmailService.ts',
              line: 5,
              name: 'EmailService',
              content: 'class EmailService { async sendEmail() {} }',
            },
            {
              file: 'src/integrations/SlackWebhook.ts',
              line: 8,
              name: 'SlackWebhook',
              content: 'export const sendSlackNotification = (message) => { /* webhook call */ }',
            },
            {
              file: 'src/integrations/PayPalClient.ts',
              line: 12,
              name: 'PayPalClient',
              content: 'class PayPalClient { async processPayment() {} }',
            },
            {
              file: 'src/services/NotificationService.ts',
              line: 15,
              name: 'NotificationService',
              content: 'class NotificationService { async notify() {} }',
            },
            {
              file: 'src/clients/ApiClient.ts',
              line: 3,
              name: 'ApiClient',
              content: 'class ApiClient { async request() {} }',
            },
            {
              file: 'src/webhooks/GithubWebhook.ts',
              line: 7,
              name: 'GithubWebhook',
              content: 'export const handleGithubWebhook = (payload) => { /* process webhook */ }',
            },
            {
              file: 'src/integrations/TwilioService.ts',
              line: 9,
              name: 'TwilioService',
              content: 'class TwilioService { async sendSMS() {} }',
            },
            {
              file: 'src/services/StorageService.ts',
              line: 4,
              name: 'StorageService',
              content: 'class StorageService { async upload() {} async download() {} }',
            },
            {
              file: 'src/clients/S3Client.ts',
              line: 11,
              name: 'S3Client',
              content: 'export const s3Client = { putObject: async () => {}, getObject: async () => {} }',
            },
            {
              file: 'tests/integrations/stripe.test.ts',
              line: 1,
              name: 'Stripe integration tests',
              content: 'describe("Stripe integration", () => { it("creates charge", async () => {}) })',
            },
          ]); // 11 results for integration features
        }
        if (query.match(/security|permission|role|access|guard/i)) {
          return Promise.resolve([
            {
              file: 'src/middleware/auth.ts',
              line: 5,
              name: 'authGuard',
              content: 'export function authGuard(req, res, next) { /* check permissions */ }',
            },
            {
              file: 'src/middleware/rbac.ts',
              line: 8,
              name: 'roleGuard',
              content: 'export const roleGuard = (roles: string[]) => (req, res, next) => { /* role check */ }',
            },
            {
              file: 'src/services/PermissionService.ts',
              line: 12,
              name: 'PermissionService',
              content: 'class PermissionService { hasPermission() {} checkAccess() {} }',
            },
            {
              file: 'src/models/Role.ts',
              line: 3,
              name: 'Role',
              content: 'interface Role { id: string; name: string; permissions: string[]; }',
            },
            {
              file: 'src/guards/AdminGuard.ts',
              line: 6,
              name: 'AdminGuard',
              content: 'export const adminGuard = (req, res, next) => { if (!req.user?.isAdmin) return res.status(403); next(); }',
            },
            {
              file: 'src/security/AccessControl.ts',
              line: 10,
              name: 'AccessControl',
              content: 'class AccessControl { canRead() {} canWrite() {} canDelete() {} }',
            },
            {
              file: 'src/utils/permissions.ts',
              line: 2,
              name: 'permissions',
              content: 'export const permissions = { READ: "read", WRITE: "write", DELETE: "delete", ADMIN: "admin" };',
            },
            {
              file: 'src/decorators/Authorize.ts',
              line: 7,
              name: 'Authorize',
              content: 'export function Authorize(roles: string[]) { return function(target, key, descriptor) { /*...*/ } }',
            },
            {
              file: 'src/services/AuthorizationService.ts',
              line: 15,
              name: 'AuthorizationService',
              content: 'class AuthorizationService { authorize() {} validateAccess() {} }',
            },
            {
              file: 'src/policies/UserPolicy.ts',
              line: 4,
              name: 'UserPolicy',
              content: 'export class UserPolicy { canUpdate(user, target) { return user.id === target.id; } }',
            },
            {
              file: 'tests/security/auth.test.ts',
              line: 1,
              name: 'Security tests',
              content: 'describe("Security", () => { it("blocks unauthorized access", () => {}) })',
            },
          ]); // 11 results for security features
        }
        return Promise.resolve([]);
      }),
    } as any;

    // Create generator
    generator = new PRDGenerator(mockProviderRouter, mockMemoryService);

    // Reset fs mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    generator.clearCache();
  });

  describe('Feature Detection Integration', () => {
    it('should detect features from codebase', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(mockMemoryService.search).toHaveBeenCalled();
    });

    it('should filter features by specific feature name', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        feature: 'authentication',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(mockMemoryService.search).toHaveBeenCalledWith(
        'auth|login|signup|password|token|session|jwt',
        expect.objectContaining({ limit: 20, includeContent: true })
      );
    });

    it('should include detected features in analysis', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.patternsDetected).toBeGreaterThan(0);
    });
  });

  describe('PRD Content Generation', () => {
    it('should generate PRD with product vision', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Product Vision');
    });

    it('should generate PRD with goals and objectives', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Goals and Objectives');
    });

    it('should generate PRD with feature requirements', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Features and Requirements');
    });

    it('should include user stories when requested', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        includeUserStories: true,
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      // AI prompt should request user stories
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('user stories'),
            }),
          ]),
        })
      );
    });

    it('should include architecture section when requested', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        includeArchitecture: true,
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Technical architecture'),
            }),
          ]),
        })
      );
    });

    it('should include success metrics when requested', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        includeMetrics: true,
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Success Metrics'),
            }),
          ]),
        })
      );
    });
  });

  describe('Audience Targeting', () => {
    it('should tailor content for technical audience', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        audience: 'technical',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Software engineers and architects'),
            }),
          ]),
        })
      );
    });

    it('should tailor content for business audience', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        audience: 'business',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Business stakeholders'),
            }),
          ]),
        })
      );
    });

    it('should use mixed audience by default', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Both technical and business'),
            }),
          ]),
        })
      );
    });
  });

  describe('Template Styles', () => {
    it('should use standard template by default', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Standard PRD'),
            }),
          ]),
        })
      );
    });

    it('should support lean template', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        template: 'lean',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Lean PRD'),
            }),
          ]),
        })
      );
    });

    it('should support detailed template', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        template: 'detailed',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Detailed PRD'),
            }),
          ]),
        })
      );
    });
  });

  describe('Empty PRD Generation', () => {
    it('should generate empty PRD when no features detected', async () => {
      // Mock no search results
      mockMemoryService.search = vi.fn().mockResolvedValue([]);

      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('No features were automatically detected');
      // Should not call AI provider for empty PRD
      expect(mockProviderRouter.route).not.toHaveBeenCalled();
    });

    it('should include template instructions in empty PRD', async () => {
      mockMemoryService.search = vi.fn().mockResolvedValue([]);

      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Next Steps');
      expect(result.content).toContain('Product Vision');
    });
  });

  describe('AI Provider Integration', () => {
    it('should call AI provider with feature context', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      await generator.generate(options);

      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Detected Features'),
            }),
          ]),
          preferredProvider: 'claude',
          temperature: 0.7,
          maxTokens: 8000,
        })
      );
    });

    it('should include file paths in prompt', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      await generator.generate(options);

      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringMatching(/Files.*src\/auth\/AuthService\.ts/s),
            }),
          ]),
        })
      );
    });

    it('should respect custom AI provider', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        provider: 'gpt-4',
        verbose: false,
      };

      await generator.generate(options);

      expect(mockProviderRouter.route).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredProvider: 'gpt-4',
        })
      );
    });
  });

  describe('Validation', () => {
    it('should validate generated PRD content', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.validation).toBeDefined();
      expect(result.validation?.valid).toBe(true);
    });

    it('should detect validation issues', async () => {
      // Mock short content
      mockProviderRouter.route = vi.fn().mockResolvedValue({
        content: 'Too short',
        provider: 'claude',
      });

      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.validation?.valid).toBe(false);
      expect(result.validation?.errors.length).toBeGreaterThan(0);
    });
  });

  describe('File Output', () => {
    it('should save PRD to specified file', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      await generator.generate(options);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/output/prd.md',
        expect.stringContaining('Product Requirements Document'),
        'utf-8'
      );
    });

    it('should include metadata footer', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.content).toContain('Generated by AutomatosX SpecKit');
      expect(result.content).toContain('prd');
      expect(result.content).toContain('/test/project');
    });
  });

  describe('Metadata', () => {
    it('should include correct metadata', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.metadata.generator).toBe('prd');
      expect(result.metadata.provider).toBe('claude');
      expect(result.metadata.generationTime).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    it('should cache PRD results', async () => {
      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        enableCache: true,
        verbose: false,
      };

      // First call
      const result1 = await generator.generate(options);
      expect(result1.metadata.cacheHit).toBe(false);

      // Second call should hit cache
      const result2 = await generator.generate(options);
      expect(result2.metadata.cacheHit).toBe(true);
      expect(result2.content).toBe(result1.content);
    });

    it('should not cache when different features are requested', async () => {
      const options1: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        feature: 'authentication',
        enableCache: true,
        verbose: false,
      };

      const options2: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        feature: 'api',
        enableCache: true,
        verbose: false,
      };

      // First call
      const result1 = await generator.generate(options1);
      expect(result1.metadata.cacheHit).toBe(false);

      // Second call with different feature should not hit cache
      const result2 = await generator.generate(options2);
      expect(result2.metadata.cacheHit).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle MemoryService errors gracefully', async () => {
      mockMemoryService.search = vi.fn().mockRejectedValue(new Error('Search failed'));

      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search failed');
    });

    it('should handle AI provider errors gracefully', async () => {
      mockProviderRouter.route = vi.fn().mockRejectedValue(new Error('AI generation failed'));

      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('AI generation failed');
    });
  });

  describe('Progress Tracking', () => {
    it('should report progress for all stages', async () => {
      const onProgress = vi.fn();

      const options: PRDGenerateOptions = {
        projectRoot: '/test/project',
        outputPath: '/test/output/prd.md',
        verbose: false,
      };

      await generator.generate(options, onProgress);

      // Check all stages were reported
      expect(onProgress).toHaveBeenCalledWith('analyzing', 0);
      expect(onProgress).toHaveBeenCalledWith('analyzing', 100);
      expect(onProgress).toHaveBeenCalledWith('detecting', 0);
      expect(onProgress).toHaveBeenCalledWith('detecting', 100);
      expect(onProgress).toHaveBeenCalledWith('generating', 0);
      expect(onProgress).toHaveBeenCalledWith('generating', 100);
    });
  });
});
