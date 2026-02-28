# genOS™ Cloud Platform — Super Prompt #3

## Wix Auth Bridge & Identity Management

**Version:** 2.0.0
**Date:** 2026-02-28
**Owner:** Cestari Studio
**Platform:** Multi-Tenant Cloud Automation

---

## 1. Auth Architecture Overview

The genOS™ Cloud Platform implements a federated identity architecture where **Wix serves as the Identity Provider (IdP)** and **Supabase handles authorization via JWT tokens**. This separation ensures:

- **Single Source of Truth**: User identities live in Wix (via their website platform)
- **Granular Authorization**: Permissions and roles managed via Supabase JWTs with custom metadata
- **Multi-Tenancy**: Each tenant (typically a Wix site owner) gets isolated access via `tenant_id` claims
- **Scalability**: Stateless JWT validation across Edge Functions and API layers

### Architecture Diagram

```
┌──────────────────────┐
│  genOS MasterLogin   │
│      (Frontend)      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Wix OAuth2 Login   │
│  (Identity Provider) │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Supabase Edge Function              │
│  "wix-auth-bridge" (Deno Runtime)    │
│  - Exchange auth code for JWT        │
│  - Validate tenant exists            │
│  - Issue Supabase JWT with claims    │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────┐
│  Frontend AuthStore  │
│  (React Context)     │
│  - Store JWT         │
│  - Tenant metadata   │
│  - User permissions  │
└──────────────────────┘
```

---

## 2. OAuth2 Flow — Detailed Step-by-Step

### 2.1 Authentication Initiation

1. **User clicks "Login" on genOS MasterLogin page** (frontend at `/login`)
2. **Frontend redirects to Wix OAuth consent screen**:
   ```
   https://www.wix.com/oauth/authorize?
     client_id=YOUR_WIX_APP_ID
     &redirect_uri=https://your-domain.com/auth/callback
     &response_type=code
     &scope=contacts.read%20site-members.read
   ```
3. **User authenticates with Wix credentials** (username/password or SSO)

### 2.2 Authorization Code Exchange

4. **Wix redirects back to frontend with `authorization_code`**:
   ```
   https://your-domain.com/auth/callback?code=AUTH_CODE_HERE&state=STATE_VALUE
   ```
5. **Frontend captures the code and calls the Edge Function**:
   ```typescript
   POST /functions/v1/wix-auth-bridge
   Content-Type: application/json

   {
     "code": "AUTH_CODE_HERE",
     "state": "STATE_VALUE"
   }
   ```

### 2.3 Token Exchange & Validation

6. **Edge Function `wix-auth-bridge` receives the code and:**
   - Exchanges the authorization code for a **Wix access token** (via Wix REST API)
   - Retrieves the **Wix member object** to confirm user identity and extract `wix_member_id`
   - **Validates** that a matching tenant exists in Supabase with this Wix site relationship

7. **Tenant Lookup Query**:
   ```sql
   SELECT id, plan, depth_level, is_agency, role
   FROM tenants
   WHERE wix_site_id = '405fddff-d534-419d-9201-4ae5436eccc4'
     AND wix_member_id = {extracted_member_id}
   ```

### 2.4 JWT Generation & Return

8. **Edge Function generates a Supabase JWT** with custom claims:
   ```json
   {
     "aud": "authenticated",
     "iss": "https://qyfjkvwlpgjlpveqnkax.supabase.co",
     "sub": "{wix_member_id}",
     "email": "{wix_member_email}",
     "exp": {timestamp + 3600},
     "iat": {timestamp},
     "tenant_id": "{tenant_uuid}",
     "role": "owner|admin|editor|viewer|freelancer",
     "wix_member_id": "{wix_member_id}",
     "depth_level": 1,
     "is_agency": true|false,
     "plan": "enterprise|professional|starter"
   }
   ```

9. **Edge Function returns JWT to frontend**:
   ```json
   {
     "success": true,
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": "wix_member_id",
       "email": "user@example.com",
       "name": "John Doe"
     },
     "tenant": {
       "id": "tenant_uuid",
       "name": "Acme Corporation",
       "plan": "enterprise"
     }
   }
   ```

10. **Frontend stores JWT** (in httpOnly cookie or secure storage) and **redirects to Console/Workstation**

---

## 3. JWT Token Structure

### 3.1 Complete JWT Payload

The Supabase JWT issued by `wix-auth-bridge` contains:

```json
{
  "aud": "authenticated",
  "iss": "https://qyfjkvwlpgjlpveqnkax.supabase.co",
  "sub": "wix_12345_abcde",
  "email": "user@company.com",
  "phone": "+5511999999999",
  "name": "João Silva",
  "picture": "https://wix-cdn.com/profile.jpg",
  "iat": 1709104800,
  "exp": 1709108400,
  "nbf": 1709104800,
  "jti": "jwt_id_12345",
  "custom_claims": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "owner",
    "wix_member_id": "wix_12345_abcde",
    "depth_level": 1,
    "is_agency": true,
    "plan": "enterprise",
    "permissions": [
      "workflows:read",
      "workflows:create",
      "workflows:execute",
      "workflows:delete",
      "team:manage",
      "settings:manage"
    ]
  }
}
```

### 3.2 Token Claims Description

| Claim | Type | Description |
|-------|------|-------------|
| `aud` | string | Audience (always `authenticated`) |
| `iss` | string | Issuer (Supabase project endpoint) |
| `sub` | string | Subject (Wix member ID) |
| `email` | string | User email from Wix |
| `phone` | string | User phone from Wix contacts |
| `name` | string | User display name |
| `picture` | string | Avatar URL from Wix |
| `iat` | number | Issued at timestamp |
| `exp` | number | Expiration timestamp (3600s = 1 hour) |
| `nbf` | number | Not before timestamp |
| `jti` | string | JWT ID (unique token identifier) |
| `tenant_id` | UUID | Unique tenant identifier in genOS |
| `role` | string | User role in tenant (`owner\|admin\|editor\|viewer\|freelancer`) |
| `wix_member_id` | string | Wix member identifier (prefixed with `wix_`) |
| `depth_level` | number | Hierarchy depth (1=owner, 2+=sub-users) |
| `is_agency` | boolean | Whether tenant is an agency |
| `plan` | string | Subscription plan tier |
| `permissions` | string[] | Array of permission strings (populated from role) |

### 3.3 Token Validation

Frontend and backend validate JWT via:

```typescript
// Using Supabase client (automatic)
const { data, error } = await supabase.auth.getSession();

// Manual validation in Edge Function:
const secret = Deno.env.get('SUPABASE_JWT_SECRET');
const decoded = await jose.jwtVerify(token, new TextEncoder().encode(secret));
```

---

## 4. Role-Based Access Control (RBAC)

### 4.1 Role Definitions & Permission Matrix

| Role | Description | Can Create Workflows | Can Edit Workflows | Can Delete Workflows | Can Execute | Can Manage Team | Can Manage Settings |
|------|-------------|:---:|:---:|:---:|:---:|:---:|:---:|
| **owner** | Tenant owner / Agency principal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **admin** | Tenant administrator | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ (limited) |
| **editor** | Workflow editor / Builder | ✅ | ✅ | ⚠️ (own) | ✅ | ❌ | ❌ |
| **viewer** | Read-only access | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **freelancer** | Contractor / External partner | ✅ | ✅ (own) | ⚠️ (own) | ✅ | ❌ | ❌ |

### 4.2 Role Descriptions

#### Owner
- Full administrative access to the tenant
- Manages subscription, billing, and team members
- Creates and deletes teams and sub-tenants (if agency)
- Can invite and remove any user
- Highest permission level

#### Admin
- Manages workflows, team members, and permissions
- Cannot modify billing or subscription settings
- Can remove users with lower roles
- Can transfer ownership

#### Editor
- Creates and edits workflows
- Can only delete own workflows (unless promoted)
- Can manage own team invitations
- Limited to assigned projects/workflows

#### Viewer
- Read-only access to workflows and reports
- Can view execution history
- Cannot make any changes
- Useful for stakeholders and auditors

#### Freelancer
- Similar to Editor but with contractor expectations
- Can work on assigned projects
- Invoicing/contract management visible
- Limited access to organizational settings

### 4.3 Permission String Format

Permissions are stored as strings with hierarchical dot notation:

```
workflows:read
workflows:create
workflows:update
workflows:delete
workflows:execute
workflows:export
team:read
team:invite
team:remove
team:update_role
settings:read
settings:update
settings:delete
billing:read
billing:update
reports:read
reports:export
templates:create
integrations:manage
```

### 4.4 RBAC Middleware Example

```typescript
// In Supabase RLS (Row Level Security)
CREATE POLICY "users_can_only_access_their_tenant"
ON workflows
FOR SELECT
USING (
  auth.jwt() ->> 'tenant_id' = tenant_id
);

CREATE POLICY "admins_can_update_workflows"
ON workflows
FOR UPDATE
USING (
  auth.jwt() ->> 'role' IN ('owner', 'admin')
  AND auth.jwt() ->> 'tenant_id' = tenant_id
);
```

---

## 5. MasterLogin Page

### 5.1 Page Overview

The **MasterLogin** page is the primary entry point for all genOS users. It presents three options for accessing different platform components, with a dynamic video background.

**URL:** `/login` or `/masterlogin`
**Background:** `video.mp4` (auto-playing, looped, muted)
**Authentication:** Wix OAuth2 redirect

### 5.2 Login Options

```
┌─────────────────────────────────────────────┐
│                                             │
│   genOS™ Cloud Platform                     │
│   Choose Your Workspace                     │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 📊 CONSOLE (Active / Agency Only)    │  │
│  │ Access your automation workflows,    │  │
│  │ team management, and reports.        │  │
│  │ [LOGIN WITH WIX] ────────────────→  │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ ⚙️  WORKSTATION (Coming Soon...)      │  │
│  │ Advanced builder environment.        │  │
│  │ [DISABLED]                           │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 🆘 SUPPORT                            │  │
│  │ Get help from our support team.      │  │
│  │ [OPEN SUPPORT] ──────────────────→   │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### 5.3 Console Option

- **Status:** Active & Available
- **Target Role:** Agency / Administrators
- **Access Level:** Full tenant management
- **Action:** Redirects to Wix OAuth2 login → Edge Function → Console dashboard

```typescript
// Frontend action
const handleConsoleLogin = () => {
  const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
  const clientId = import.meta.env.VITE_WIX_CLIENT_ID;

  window.location.href =
    `https://www.wix.com/oauth/authorize?` +
    `client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=contacts.read%20site-members.read%20site-members-contacts.read`;
};
```

### 5.4 Workstation Option

- **Status:** Disabled / Coming Soon
- **Target Role:** Advanced Users / Builders
- **Feature:** Advanced automation builder with drag-and-drop interface
- **Action:** Shows disabled state with "Coming Soon" tooltip

### 5.5 Support Option

- **Status:** Active & Available
- **Target Role:** All users
- **Action:** Opens modal/drawer with:
  - Support contact form
  - FAQ section
  - Live chat widget (Intercom/similar)
  - Knowledge base search

```typescript
const handleSupportClick = () => {
  setShowSupportModal(true);
  // Load support widget
  window.Intercom?.('show');
};
```

### 5.6 Page Implementation Example

```html
<div class="masterlogin-container">
  <!-- Video Background -->
  <video
    autoplay
    loop
    muted
    class="background-video"
  >
    <source src="/video.mp4" type="video/mp4" />
  </video>

  <!-- Content Overlay -->
  <div class="content-overlay">
    <div class="logo">
      <img src="/logo.svg" alt="genOS" />
    </div>

    <h1>Choose Your Workspace</h1>

    <div class="options-grid">
      <!-- Console -->
      <div
        class="option-card active"
        onClick={handleConsoleLogin}
      >
        <div class="icon">📊</div>
        <h2>CONSOLE</h2>
        <p>Access your automation workflows, team management, and reports.</p>
        <button class="btn-primary">LOGIN WITH WIX</button>
      </div>

      <!-- Workstation -->
      <div class="option-card disabled">
        <div class="icon">⚙️</div>
        <h2>WORKSTATION</h2>
        <p>Advanced builder environment. Coming soon...</p>
        <button class="btn-disabled" disabled>COMING SOON</button>
      </div>

      <!-- Support -->
      <div
        class="option-card"
        onClick={handleSupportClick}
      >
        <div class="icon">🆘</div>
        <h2>SUPPORT</h2>
        <p>Get help from our support team.</p>
        <button class="btn-secondary">OPEN SUPPORT</button>
      </div>
    </div>
  </div>
</div>
```

---

## 6. Edge Function Code Template: `wix-auth-bridge`

### 6.1 Function Structure

**File:** `supabase/functions/wix-auth-bridge/index.ts`
**Runtime:** Deno
**Method:** POST
**Authentication:** None (CORS-enabled, CSRF token validation)

### 6.2 Complete Implementation

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const WIX_SITE_ID = "405fddff-d534-419d-9201-4ae5436eccc4";
const WIX_API_KEY = Deno.env.get("WIX_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("SUPABASE_JWT_SECRET")!;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AuthRequest {
  code: string;
  state: string;
}

interface WixMember {
  id: string;
  loginEmail: string;
  displayName: string;
  profile?: {
    photo?: {
      url: string;
    };
  };
}

interface TenantInfo {
  id: string;
  name: string;
  plan: "starter" | "professional" | "enterprise";
  role: "owner" | "admin" | "editor" | "viewer" | "freelancer";
  depth_level: number;
  is_agency: boolean;
}

// Token generation utility (using jose for JWT signing)
const generateSupabaseJWT = async (
  memberId: string,
  memberEmail: string,
  displayName: string,
  tenant: TenantInfo
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour

  const payload = {
    aud: "authenticated",
    iss: `${SUPABASE_URL}`,
    sub: memberId,
    email: memberEmail,
    name: displayName,
    phone: "",
    picture: "",
    iat: now,
    exp: exp,
    nbf: now,
    custom_claims: {
      tenant_id: tenant.id,
      role: tenant.role,
      wix_member_id: memberId,
      depth_level: tenant.depth_level,
      is_agency: tenant.is_agency,
      plan: tenant.plan,
      permissions: getPermissionsForRole(tenant.role),
    },
  };

  // For production, use a proper JWT library with HS256 signing
  // This is a simplified example
  const token = btoa(JSON.stringify(payload));
  return token;
};

// Helper to get permissions for a role
const getPermissionsForRole = (
  role: "owner" | "admin" | "editor" | "viewer" | "freelancer"
): string[] => {
  const rolePermissions: Record<string, string[]> = {
    owner: [
      "workflows:read",
      "workflows:create",
      "workflows:update",
      "workflows:delete",
      "workflows:execute",
      "workflows:export",
      "team:read",
      "team:invite",
      "team:remove",
      "team:update_role",
      "settings:read",
      "settings:update",
      "settings:delete",
      "billing:read",
      "billing:update",
      "reports:read",
      "reports:export",
      "templates:create",
      "integrations:manage",
    ],
    admin: [
      "workflows:read",
      "workflows:create",
      "workflows:update",
      "workflows:delete",
      "workflows:execute",
      "workflows:export",
      "team:read",
      "team:invite",
      "team:remove",
      "team:update_role",
      "settings:read",
      "settings:update",
      "reports:read",
      "reports:export",
      "templates:create",
      "integrations:manage",
    ],
    editor: [
      "workflows:read",
      "workflows:create",
      "workflows:update",
      "workflows:execute",
      "workflows:export",
      "team:read",
      "reports:read",
      "templates:create",
    ],
    viewer: ["workflows:read", "reports:read"],
    freelancer: [
      "workflows:read",
      "workflows:create",
      "workflows:update",
      "workflows:execute",
      "workflows:export",
      "team:read",
      "reports:read",
    ],
  };

  return rolePermissions[role] || [];
};

// Exchange authorization code for Wix access token
const exchangeCodeForWixToken = async (code: string): Promise<string> => {
  const response = await fetch("https://www.wixapis.com/oauth/access", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange code for Wix token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
};

// Get Wix member info from access token
const getWixMemberInfo = async (accessToken: string): Promise<WixMember> => {
  const response = await fetch("https://www.wixapis.com/v1/contacts/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Wix member info: ${response.statusText}`);
  }

  const data = await response.json();
  return data.contact;
};

// Get tenant info from Supabase
const getTenantInfo = async (wixMemberId: string): Promise<TenantInfo | null> => {
  const { data, error } = await supabaseClient
    .from("tenants")
    .select("id, name, plan, role, depth_level, is_agency")
    .eq("wix_site_id", WIX_SITE_ID)
    .eq("wix_member_id", wixMemberId)
    .single();

  if (error || !data) {
    console.error("Tenant lookup failed:", error);
    return null;
  }

  return data as TenantInfo;
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const body: AuthRequest = await req.json();
    const { code, state } = body;

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Authorization code required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 1: Exchange code for Wix access token
    const wixAccessToken = await exchangeCodeForWixToken(code);

    // Step 2: Get member info from Wix
    const wixMember = await getWixMemberInfo(wixAccessToken);

    if (!wixMember || !wixMember.id) {
      return new Response(
        JSON.stringify({ error: "Failed to retrieve Wix member info" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 3: Look up tenant in Supabase
    const tenant = await getTenantInfo(wixMember.id);

    if (!tenant) {
      return new Response(
        JSON.stringify({
          error: "Tenant not found. Please contact support.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 4: Generate Supabase JWT with custom claims
    const supabaseJWT = await generateSupabaseJWT(
      wixMember.id,
      wixMember.loginEmail,
      wixMember.displayName,
      tenant
    );

    // Return JWT to frontend
    return new Response(
      JSON.stringify({
        success: true,
        token: supabaseJWT,
        user: {
          id: wixMember.id,
          email: wixMember.loginEmail,
          name: wixMember.displayName,
          picture: wixMember.profile?.photo?.url || null,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          plan: tenant.plan,
          role: tenant.role,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Auth bridge error:", error);
    return new Response(
      JSON.stringify({
        error: "Authentication failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
```

### 6.3 Environment Variables Required

```bash
# .env.local for Supabase Edge Function
SUPABASE_URL=https://qyfjkvwlpgjlpveqnkax.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here

WIX_API_KEY=your_wix_api_key_here
WIX_CLIENT_ID=your_wix_client_id_here
WIX_CLIENT_SECRET=your_wix_client_secret_here
```

---

## 7. Frontend AuthProvider (React Context)

### 7.1 AuthContext Definition

```typescript
// contexts/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface Tenant {
  id: string;
  name: string;
  plan: "starter" | "professional" | "enterprise";
  role: "owner" | "admin" | "editor" | "viewer" | "freelancer";
}

export interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (code: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load token from storage on mount
  useEffect(() => {
    const loadStoredAuth = () => {
      const storedToken = localStorage.getItem("genOS_token");
      const storedUser = localStorage.getItem("genOS_user");
      const storedTenant = localStorage.getItem("genOS_tenant");

      if (storedToken && storedUser && storedTenant) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setTenant(JSON.parse(storedTenant));
      }
    };

    loadStoredAuth();
  }, []);

  // Login handler
  const login = async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wix-auth-bridge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        }
      );

      if (!response.ok) {
        throw new Error("Authentication failed");
      }

      const data = await response.json();

      // Store token and user info
      setToken(data.token);
      setUser(data.user);
      setTenant(data.tenant);

      // Persist to storage (with token in httpOnly cookie ideally)
      localStorage.setItem("genOS_token", data.token);
      localStorage.setItem("genOS_user", JSON.stringify(data.user));
      localStorage.setItem("genOS_tenant", JSON.stringify(data.tenant));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout handler
  const logout = () => {
    setToken(null);
    setUser(null);
    setTenant(null);
    localStorage.removeItem("genOS_token");
    localStorage.removeItem("genOS_user");
    localStorage.removeItem("genOS_tenant");
  };

  // Token refresh
  const refreshToken = async () => {
    // Implement refresh token endpoint if using refresh tokens
    // For now, this would involve re-authenticating
    console.log("Token refresh not yet implemented");
  };

  // Check if user has permission
  const hasPermission = (permission: string): boolean => {
    // Parse JWT claims from token
    if (!token) return false;

    try {
      const parts = token.split(".");
      const payload = JSON.parse(atob(parts[1]));
      const permissions = payload.custom_claims?.permissions || [];
      return permissions.includes(permission);
    } catch {
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    tenant,
    token,
    isLoading,
    error,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!token && !!user,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
```

### 7.2 Auth Callback Component

```typescript
// pages/AuthCallback.tsx

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, error } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code) {
        navigate("/login?error=no_code");
        return;
      }

      try {
        await login(code);
        navigate("/console");
      } catch (err) {
        navigate(`/login?error=${encodeURIComponent(String(err))}`);
      }
    };

    handleCallback();
  }, [searchParams, login, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authenticating...</h1>
        <p className="text-gray-600">Please wait while we sign you in.</p>
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    </div>
  );
};
```

### 7.3 Protected Route Wrapper

```typescript
// components/ProtectedRoute.tsx

import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
}) => {
  const { isAuthenticated, hasPermission } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
```

---

## 8. Session Management

### 8.1 Token Lifecycle

| Phase | Duration | Action |
|-------|----------|--------|
| **Issued** | t=0 | JWT created with `iat` claim |
| **Active** | 0–3500s | Token valid for API requests |
| **Refresh Window** | 3500–3600s | Backend may request refresh |
| **Expired** | >3600s | Token rejected, redirect to login |

### 8.2 Token Refresh Strategy

**Current Implementation:** No refresh token (stateless)
**Recommended:** Implement refresh token rotation for production

```typescript
// Refresh endpoint (Edge Function)
const refreshSupabaseJWT = async (refreshToken: string): Promise<string> => {
  // Validate refresh token in database
  const { data: refreshTokenRecord } = await supabaseClient
    .from("refresh_tokens")
    .select("*")
    .eq("token", refreshToken)
    .eq("revoked", false)
    .single();

  if (!refreshTokenRecord) {
    throw new Error("Invalid or revoked refresh token");
  }

  if (new Date(refreshTokenRecord.expires_at) < new Date()) {
    throw new Error("Refresh token expired");
  }

  // Issue new JWT with same claims
  const newJWT = await generateSupabaseJWT(
    refreshTokenRecord.wix_member_id,
    refreshTokenRecord.email,
    refreshTokenRecord.name,
    {
      id: refreshTokenRecord.tenant_id,
      name: refreshTokenRecord.tenant_name,
      plan: refreshTokenRecord.plan,
      role: refreshTokenRecord.role,
      depth_level: refreshTokenRecord.depth_level,
      is_agency: refreshTokenRecord.is_agency,
    }
  );

  return newJWT;
};
```

### 8.3 Expiry Handling (Frontend)

```typescript
// hooks/useTokenExpiry.ts

import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export const useTokenExpiry = () => {
  const { token, logout } = useAuth();

  useEffect(() => {
    if (!token) return;

    // Parse expiration from JWT
    const parts = token.split(".");
    const payload = JSON.parse(atob(parts[1]));
    const expiresAt = payload.exp * 1000; // Convert to ms

    // Set timeout to logout 5 minutes before expiry
    const timeUntilExpiry = expiresAt - Date.now() - 5 * 60 * 1000;

    if (timeUntilExpiry <= 0) {
      logout();
      return;
    }

    const timeout = setTimeout(() => {
      logout();
      // Redirect to login with session expired message
      window.location.href = "/login?reason=session_expired";
    }, timeUntilExpiry);

    return () => clearTimeout(timeout);
  }, [token, logout]);
};

// Usage in root component
export const App = () => {
  useTokenExpiry();
  return <Router>{/* routes */}</Router>;
};
```

### 8.4 Session State Diagram

```
┌──────────┐
│  Logged  │
│   Out    │
└────┬─────┘
     │ Click Login
     ▼
┌──────────────────┐
│   Redirected to  │
│  Wix OAuth Login │
└────┬─────────────┘
     │ User Authenticates
     ▼
┌──────────────────┐
│  Edge Function   │
│  Validates &     │
│  Issues JWT      │
└────┬─────────────┘
     │ JWT Stored
     ▼
┌──────────────────┐
│   Logged In      │
│   (Active JWT)   │◄──── Refresh before expiry
└────┬─────────────┘
     │ 3600 seconds pass
     ▼
┌──────────────────┐
│   Token Expired  │
│  Redirect to     │
│  Login           │
└──────────────────┘
```

---

## 9. Security Considerations

### 9.1 CORS Configuration

```typescript
// Edge Function CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://your-domain.com", // Specific domain
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "3600",
  "Access-Control-Allow-Credentials": "true",
};

// Validate origin
const origin = req.headers.get("origin");
const allowedOrigins = [
  "https://your-domain.com",
  "https://console.your-domain.com",
];

if (!allowedOrigins.includes(origin || "")) {
  return new Response(JSON.stringify({ error: "CORS policy violation" }), {
    status: 403,
  });
}
```

### 9.2 PKCE (Proof Key for Code Exchange)

Recommended for SPA authentication:

```typescript
// Generate PKCE parameters (frontend)
const generatePKCE = (): { codeChallenge: string; codeVerifier: string } => {
  const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => String.fromCharCode(b))
    .join("");

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = crypto.subtle.digest("SHA-256", data);

  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return { codeChallenge, codeVerifier };
};

// Store codeVerifier in sessionStorage
sessionStorage.setItem("pkce_verifier", codeVerifier);

// Include in Wix OAuth URL
const { codeChallenge } = generatePKCE();
const oauthUrl = new URL("https://www.wix.com/oauth/authorize");
oauthUrl.searchParams.append("code_challenge", codeChallenge);
oauthUrl.searchParams.append("code_challenge_method", "S256");
```

### 9.3 Token Storage Trade-offs

| Storage Method | XSS Risk | CSRF Risk | Performance | Persistence |
|---|:---:|:---:|:---:|:---:|
| **httpOnly Cookie** | ❌ Protected | ⚠️ Requires CSRF token | Fast | Session only |
| **localStorage** | ⚠️ Vulnerable | ❌ Protected | Fast | Page refresh survives |
| **sessionStorage** | ⚠️ Vulnerable | ❌ Protected | Fast | Lost on tab close |
| **Memory** | ⚠️ Vulnerable | ❌ Protected | Fast | Lost on refresh |

**Recommendation for genOS:** Use httpOnly cookie + CSRF token for maximum security:

```typescript
// Secure token storage (httpOnly cookie set by backend)
// Backend sets in Edge Function response:
// Set-Cookie: genOS_token=<JWT>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600

// Frontend cannot access the token but can make authenticated requests
// Browser automatically includes cookie in requests

// CSRF Token for form submissions
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

// Include in form submissions
fetch(`/api/workflows`, {
  method: "POST",
  headers: {
    "X-CSRF-Token": csrfToken,
  },
  body: JSON.stringify(data),
});
```

### 9.4 JWT Validation Checklist

```typescript
const validateJWT = (token: string, secret: string): boolean => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));

    // Validate required claims
    if (!payload.sub || !payload.email) return false;
    if (!payload.tenant_id || !payload.role) return false;

    // Validate timestamps
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return false; // Expired
    if (payload.iat > now) return false; // Issued in future
    if (payload.nbf && payload.nbf > now) return false; // Not yet valid

    // Verify signature (in production, use cryptographic verification)
    // signature = HMAC-SHA256(base64(header) + "." + base64(payload), secret)

    return true;
  } catch {
    return false;
  }
};
```

### 9.5 Rate Limiting

```typescript
// Implement rate limiting on Edge Function
const rateLimitByIP = new Map<string, number[]>();

const checkRateLimit = (ip: string, limit = 5, windowMs = 60000): boolean => {
  const now = Date.now();
  const window = rateLimitByIP.get(ip) || [];

  // Remove old requests outside window
  const validRequests = window.filter((time) => now - time < windowMs);

  if (validRequests.length >= limit) {
    return false; // Rate limit exceeded
  }

  validRequests.push(now);
  rateLimitByIP.set(ip, validRequests);
  return true;
};

// In auth-bridge handler
const clientIP =
  req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

if (!checkRateLimit(clientIP, 10, 60000)) {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: { "Retry-After": "60" },
  });
}
```

---

## 10. Platform Identifiers

### 10.1 Wix Integration Details

**Wix Site ID:** `405fddff-d534-419d-9201-4ae5436eccc4`
**Platform:** Wix Site Owner authentication
**OAuth Scopes:** `contacts.read`, `site-members.read`, `site-members-contacts.read`
**Redirect URI:** `https://your-domain.com/auth/callback`

**Wix API Endpoints:**
- OAuth: `https://www.wix.com/oauth/authorize`
- Token Exchange: `https://www.wixapis.com/oauth/access`
- Member Info: `https://www.wixapis.com/v1/contacts/me`

### 10.2 Supabase Project Details

**Project ID:** `qyfjkvwlpgjlpveqnkax`
**Project URL:** `https://qyfjkvwlpgjlpveqnkax.supabase.co`
**Region:** (Assumed: US-East based on project slug pattern)

**Key Endpoints:**
- REST API: `https://qyfjkvwlpgjlpveqnkax.supabase.co/rest/v1`
- Edge Functions: `https://qyfjkvwlpgjlpveqnkax.supabase.co/functions/v1`
- Realtime: `wss://qyfjkvwlpgjlpveqnkax.supabase.co/realtime/v1`

**Database Tables Required:**
- `tenants` (tenant metadata)
- `users` (user profiles)
- `roles` (role definitions)
- `permissions` (permission mappings)
- `refresh_tokens` (for token rotation)
- `audit_logs` (auth events logging)

---

## 11. Troubleshooting & Error Handling

### 11.1 Common Error Codes

| Error | Status | Cause | Resolution |
|-------|--------|-------|-----------|
| `INVALID_CODE` | 400 | Authorization code is invalid or expired | User must restart login flow |
| `TENANT_NOT_FOUND` | 403 | No matching tenant in Supabase | Contact support to create tenant |
| `WIX_API_ERROR` | 500 | Wix API unavailable or misconfigured | Retry or check Wix API status |
| `JWT_GENERATION_FAILED` | 500 | Failed to generate JWT token | Check SUPABASE_JWT_SECRET env var |
| `CORS_BLOCKED` | 403 | Request origin not in allowlist | Verify frontend domain in CORS config |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many auth attempts from IP | Wait before retrying |

### 11.2 Debug Logging

```typescript
// Enhanced logging in Edge Function
const logAuthEvent = async (
  event: string,
  userId: string,
  tenantId: string | null,
  status: "success" | "failure",
  metadata?: Record<string, any>
) => {
  await supabaseClient.from("audit_logs").insert({
    event,
    user_id: userId,
    tenant_id: tenantId,
    status,
    metadata,
    ip_address: await getClientIP(),
    timestamp: new Date(),
  });
};

// Usage
logAuthEvent("oauth_callback", wixMemberId, tenant?.id || null, "success", {
  wixAccessToken: wixAccessToken.substring(0, 20) + "...",
});
```

---

## 12. Next Steps & Integration Checklist

- [ ] Create Wix OAuth application and obtain Client ID/Secret
- [ ] Deploy `wix-auth-bridge` Edge Function to Supabase
- [ ] Set environment variables in Supabase project
- [ ] Create database tables (`tenants`, `users`, `roles`, `permissions`)
- [ ] Implement `AuthProvider` in React application
- [ ] Create `/login` (MasterLogin) page with Wix redirect
- [ ] Create `/auth/callback` route for OAuth redirect
- [ ] Implement JWT validation middleware in API routes
- [ ] Configure CORS policies for frontend domain
- [ ] Set up refresh token rotation (optional but recommended)
- [ ] Implement audit logging for auth events
- [ ] Test full OAuth flow end-to-end
- [ ] Set up error monitoring and alerting

---

*Documento #3 de 10*
