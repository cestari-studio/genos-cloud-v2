# genOS™ Cloud Platform — Super Prompt #4

## Console Hub Frontend: Modular Architecture & Implementation Guide

**Version:** 2.0.0
**Date:** 2026-02-28
**Audience:** Frontend Engineers, Product Managers, UI/UX Designers
**Status:** Production Ready

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Carbon Design System Integration](#carbon-design-system-integration)
3. [Shell Structure & Layout](#shell-structure--layout)
4. [Routing Architecture](#routing-architecture)
5. [Page Components](#page-components)
6. [State Management](#state-management)
7. [Supabase Client Setup](#supabase-client-setup)
8. [Realtime Integration](#realtime-integration)
9. [Responsive Design](#responsive-design)
10. [File Structure](#file-structure)
11. [Component Implementation Examples](#component-implementation-examples)
12. [Best Practices & Guidelines](#best-practices--guidelines)

---

## Overview & Architecture

### Console Hub Purpose

The **Console Hub** is the agency-facing administrative interface for the genOS™ Cloud Platform. It serves as the central command center for content managers, brand strategists, and administrators to manage:

- Content creation and orchestration (Content Factory)
- Brand guidelines and DNA management
- Tenant and workspace administration
- System settings and configurations
- Real-time collaboration and notifications

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 18+ LTS | JavaScript runtime |
| **Build Tool** | Vite | 5.x | Fast module bundling |
| **Framework** | React | 18+ | UI component library |
| **Component Library** | IBM Carbon Design System | 11.x | Enterprise UI components |
| **Styling** | CSS Modules + Carbon Theme | g100 (dark) | Theme consistency |
| **State** | React Context API | - | Auth, tenant context |
| **Backend Client** | Supabase JS Client | 2.39+ | Data & auth integration |
| **Routing** | React Router | 6.x | Client-side navigation |
| **HTTP Client** | Fetch API / Axios | - | API requests |

### SPA Architecture

The Console Hub is implemented as a **Single Page Application (SPA)** with the following characteristics:

- **No page reloads** - smooth navigation via React Router
- **Client-side rendering (CSR)** - React hydrates the DOM
- **Dynamic code splitting** - lazy-loaded route components
- **Persistent layout** - Header and SideNav remain visible during navigation
- **State synchronization** - React Context maintains auth and tenant data

---

## Carbon Design System Integration

### Package Installation

```bash
# Core Carbon packages
npm install @carbon/react @carbon/icons-react @carbon/type

# Theme and styling
npm install @carbon/themes

# Optional utilities
npm install @carbon/colors @carbon/layout
```

### Theme Setup: g100 (Dark)

The Console uses the **g100 theme** (darkest available in Carbon) for a professional, immersive admin experience.

#### Root HTML Setup

```html
<!DOCTYPE html>
<html lang="en" data-carbon-theme="g100">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>genOS™ Console</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/index.jsx"></script>
</body>
</html>
```

#### Main App Component Setup

```jsx
// src/App.jsx
import { useEffect } from 'react';
import { Theme } from '@carbon/react';
import '@carbon/themes/css/themes.css';
import './App.css';

function App() {
  useEffect(() => {
    // Ensure g100 theme is applied
    document.documentElement.setAttribute('data-carbon-theme', 'g100');
  }, []);

  return (
    <Theme theme="g100">
      <div className="app-container">
        {/* Router and shell components here */}
      </div>
    </Theme>
  );
}

export default App;
```

#### CSS Theme Configuration

```css
/* src/App.css */
@import '@carbon/themes/css/themes.css';

:root {
  color-scheme: dark;
  --cds-ui-01: #161616; /* Background */
  --cds-ui-02: #262626; /* Secondary background */
  --cds-ui-03: #393939; /* Tertiary background */
  --cds-text-01: #f4f4f4; /* Primary text */
  --cds-text-02: #c6c6c6; /* Secondary text */
}

html[data-carbon-theme='g100'] {
  background-color: var(--cds-ui-01);
  color: var(--cds-text-01);
}
```

### Required Carbon Components

The Console utilizes these essential Carbon components:

| Component | Purpose | Usage Examples |
|-----------|---------|-----------------|
| **UIShell** | Layout framework | Wraps Header, SideNav, Content |
| **Header** | Top navigation bar | Logo, tenant selector, notifications |
| **HeaderName** | Branding in header | Displays "genOS™" |
| **HeaderNavigation** | Header navigation items | Secondary nav links |
| **HeaderGlobalBar** | Right-aligned header icons | User actions |
| **HeaderGlobalAction** | Icon buttons in header | Notifications, user menu |
| **SideNav** | Left sidebar navigation | Main menu with routing |
| **SideNavItems** | Sidebar menu items | Dashboard, Factory, etc. |
| **SideNavLink** | Sidebar navigation links | Routing to pages |
| **Content** | Main content container | Page content area |
| **DataTable** | Tabular data display | Content matrices, item lists |
| **Modal** | Dialog windows | Confirmations, forms |
| **Button** | Action triggers | Submit, cancel, actions |
| **DropdownList** | Select menus | Tenant selector, filters |
| **TextInput** | Text fields | Form inputs |
| **TextArea** | Multi-line text | Description fields |
| **Tabs** | Tabbed interfaces | Page sections |
| **Tag** | Content labels | Status badges, categories |
| **Notification** | Toast/Alert messages | Feedback messages |
| **OverflowMenu** | Actions menu | Row actions in tables |
| **Skeleton** | Loading states | Placeholder UI during fetch |
| **ProgressIndicator** | Multi-step progress | Workflow steps |

### Component Import Pattern

```jsx
import {
  UIShell,
  Header,
  HeaderName,
  SideNav,
  SideNavItems,
  SideNavLink,
  Content,
  Button,
  Modal,
  TextInput,
  DataTable,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  Notification,
  OverflowMenu,
  OverflowMenuItem,
  Skeleton,
  SkeletonText,
} from '@carbon/react';

import {
  Dashboard as DashboardIcon,
  Image as FactoryIcon,
  Document as BrandIcon,
  Settings as SettingsIcon,
  User as UserIcon,
  Notification as NotificationIcon,
} from '@carbon/icons-react';
```

---

## Shell Structure & Layout

### Header Component

The Header is the primary navigation hub with branding, tenant context, and quick actions.

```jsx
// src/components/Shell/Header.jsx
import {
  Header,
  HeaderName,
  HeaderNavigation,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SkipToContent,
} from '@carbon/react';
import {
  Notification as NotificationIcon,
  User as UserIcon,
  AppSwitcher as TenantIcon,
} from '@carbon/icons-react';
import { useState } from 'react';
import TenantSelector from './TenantSelector';
import UserMenu from './UserMenu';
import './Header.css';

function ConsoleHeader() {
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notificationCount, setNotificationCount] = useState(3);

  return (
    <Header aria-label="genOS™ Console">
      <SkipToContent />

      <HeaderName href="/console/dashboard" prefix="genOS™">
        Console
      </HeaderName>

      <HeaderNavigation aria-label="genOS™ Cloud Platform">
        {/* Secondary navigation items if needed */}
      </HeaderNavigation>

      <HeaderGlobalBar>
        {/* Tenant Selector */}
        <div className="header-tenant-selector">
          <HeaderGlobalAction
            aria-label="Select Tenant"
            onClick={() => setShowTenantSelector(!showTenantSelector)}
            title="Switch Tenant"
          >
            <TenantIcon size={20} />
          </HeaderGlobalAction>
          {showTenantSelector && <TenantSelector />}
        </div>

        {/* Notification Bell */}
        <div className="header-notifications">
          <HeaderGlobalAction
            aria-label="Notifications"
            title={`${notificationCount} new notifications`}
          >
            <NotificationIcon size={20} />
            {notificationCount > 0 && (
              <span className="notification-badge">{notificationCount}</span>
            )}
          </HeaderGlobalAction>
        </div>

        {/* User Avatar & Menu */}
        <div className="header-user-menu">
          <HeaderGlobalAction
            aria-label="User Account"
            onClick={() => setShowUserMenu(!showUserMenu)}
            title="Account Settings"
          >
            <UserIcon size={20} />
          </HeaderGlobalAction>
          {showUserMenu && <UserMenu />}
        </div>
      </HeaderGlobalBar>
    </Header>
  );
}

export default ConsoleHeader;
```

#### Header CSS

```css
/* src/components/Shell/Header.css */
.header-tenant-selector,
.header-notifications,
.header-user-menu {
  position: relative;
  display: flex;
  align-items: center;
}

.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: #ff5050;
  color: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}
```

### Tenant Selector Component

```jsx
// src/components/Shell/TenantSelector.jsx
import { useState, useContext } from 'react';
import { DropdownList } from '@carbon/react';
import { AuthContext } from '../../context/AuthContext';
import { TenantContext } from '../../context/TenantContext';

function TenantSelector() {
  const { user } = useContext(AuthContext);
  const { currentTenant, setCurrentTenant, tenants } = useContext(TenantContext);
  const [selectedTenant, setSelectedTenant] = useState(currentTenant?.id);

  const handleTenantChange = (e) => {
    const tenantId = e.selectedItem.value;
    const tenant = tenants.find((t) => t.id === tenantId);
    setCurrentTenant(tenant);
    setSelectedTenant(tenantId);
  };

  const tenantItems = tenants.map((tenant) => ({
    label: tenant.name,
    value: tenant.id,
  }));

  return (
    <div className="tenant-selector-dropdown">
      <DropdownList
        ariaLabel="Select Tenant"
        items={tenantItems}
        selectedItem={tenantItems.find((t) => t.value === selectedTenant)}
        onChange={handleTenantChange}
        title={currentTenant?.name || 'Select Tenant'}
      />
    </div>
  );
}

export default TenantSelector;
```

### SideNav Component

The SideNav provides the main navigation structure for the Console application.

```jsx
// src/components/Shell/SideNav.jsx
import { useLocation } from 'react-router-dom';
import {
  SideNav,
  SideNavItems,
  SideNavLink,
} from '@carbon/react';
import {
  Dashboard as DashboardIcon,
  Image as FactoryIcon,
  Document as BrandIcon,
  UserAvatar as TenantsIcon,
  Settings as SettingsIcon,
} from '@carbon/icons-react';
import './SideNav.css';

function ConsoleSideNav() {
  const location = useLocation();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/console/dashboard',
      icon: DashboardIcon,
      isActive: location.pathname === '/console/dashboard',
    },
    {
      id: 'factory',
      label: 'Content Factory',
      href: '/console/factory',
      icon: FactoryIcon,
      isActive: location.pathname.startsWith('/console/factory'),
    },
    {
      id: 'brand-dna',
      label: 'Brand DNA',
      href: '/console/brand-dna',
      icon: BrandIcon,
      isActive: location.pathname === '/console/brand-dna',
    },
    {
      id: 'tenants',
      label: 'Tenants',
      href: '/console/tenants',
      icon: TenantsIcon,
      isActive: location.pathname === '/console/tenants',
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/console/settings',
      icon: SettingsIcon,
      isActive: location.pathname === '/console/settings',
    },
  ];

  return (
    <SideNav
      aria-label="genOS™ Console Navigation"
      expanded={true}
      isPersistent={true}
      isRail={false}
    >
      <SideNavItems>
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <SideNavLink
              key={item.id}
              href={item.href}
              isActive={item.isActive}
              icon={() => <IconComponent size={20} />}
              aria-current={item.isActive ? 'page' : undefined}
            >
              {item.label}
            </SideNavLink>
          );
        })}
      </SideNavItems>
    </SideNav>
  );
}

export default ConsoleSideNav;
```

#### SideNav CSS

```css
/* src/components/Shell/SideNav.css */
.bx--side-nav {
  background-color: var(--cds-ui-02);
  border-right: 1px solid var(--cds-ui-03);
  min-height: 100vh;
  width: 256px;
}

.bx--side-nav__item--active {
  background-color: var(--cds-ui-03);
  border-left: 4px solid #0f62fe;
}

.bx--side-nav__link {
  color: var(--cds-text-02);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.bx--side-nav__link:hover {
  background-color: var(--cds-ui-03);
  color: var(--cds-text-01);
}

.bx--side-nav__link[aria-current='page'] {
  background-color: var(--cds-ui-03);
  color: var(--cds-text-01);
  border-left: 4px solid #0f62fe;
}

@media (max-width: 1056px) {
  .bx--side-nav {
    position: fixed;
    left: 0;
    top: 48px;
    width: 100%;
    max-width: 256px;
    z-index: 100;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
  }
}

@media (max-width: 672px) {
  .bx--side-nav {
    display: none;
  }

  .bx--side-nav--expanded {
    display: block;
  }
}
```

### Main Shell Layout

```jsx
// src/components/Shell/ConsoleShell.jsx
import { UIShell, Content } from '@carbon/react';
import { Outlet } from 'react-router-dom';
import ConsoleHeader from './Header';
import ConsoleSideNav from './SideNav';
import './ConsoleShell.css';

function ConsoleShell() {
  return (
    <UIShell>
      <ConsoleHeader />
      <div className="console-main">
        <ConsoleSideNav />
        <Content id="main-content" className="console-content">
          <Outlet />
        </Content>
      </div>
    </UIShell>
  );
}

export default ConsoleShell;
```

#### ConsoleShell CSS

```css
/* src/components/Shell/ConsoleShell.css */
.console-main {
  display: flex;
  height: calc(100vh - 48px);
}

.console-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background-color: var(--cds-ui-01);
}

.console-content > * + * {
  margin-top: 24px;
}
```

---

## Routing Architecture

### Router Configuration

The Console uses React Router 6 with nested routes for modular page structure.

```jsx
// src/Router.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';

// Page components
import MasterLogin from './pages/auth/MasterLogin';
import DashboardPage from './pages/console/Dashboard';
import ContentFactoryPage from './pages/console/ContentFactory';
import BrandDNAPage from './pages/console/BrandDNA';
import TenantsPage from './pages/console/Tenants';
import SettingsPage from './pages/console/Settings';
import WorkstationComingSoon from './pages/workstation/ComingSoon';
import ConsoleShell from './components/Shell/ConsoleShell';
import NotFound from './pages/errors/NotFound';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function ConsoleRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication Routes */}
        <Route path="/login" element={<MasterLogin />} />

        {/* Console Routes with Shell */}
        <Route
          path="/console"
          element={
            <ProtectedRoute>
              <ConsoleShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="factory/*" element={<ContentFactoryPage />} />
          <Route path="brand-dna" element={<BrandDNAPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Workstation Routes (Disabled) */}
        <Route path="/workstation/*" element={<WorkstationComingSoon />} />

        {/* Fallback Routes */}
        <Route path="/" element={<Navigate to="/console/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default ConsoleRouter;
```

### Route Map

| Route | Component | Shell | Purpose |
|-------|-----------|-------|---------|
| `/login` | MasterLogin | None | User authentication |
| `/console/dashboard` | Dashboard | Yes | Overview & KPIs |
| `/console/factory` | ContentFactory | Yes | Content matrix & management |
| `/console/factory/:id` | FactoryDetail | Yes | Content item editor |
| `/console/brand-dna` | BrandDNA | Yes | Brand guidelines editor |
| `/console/tenants` | Tenants | Yes | Tenant management |
| `/console/settings` | Settings | Yes | System configuration |
| `/workstation/*` | ComingSoon | None | Future feature |
| `/` | - (redirect) | - | Redirects to dashboard |
| `*` | NotFound | None | 404 error page |

---

## Page Components

### Dashboard Page

The Dashboard provides an at-a-glance overview of platform activity and metrics.

```jsx
// src/pages/console/Dashboard.jsx
import { useEffect, useState, useContext } from 'react';
import {
  Grid,
  Column,
  Heading,
  Tile,
  Skeleton,
  SkeletonText,
  DataTable,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import { TenantContext } from '../../context/TenantContext';
import { supabase } from '../../lib/supabaseClient';
import './Dashboard.css';

function Dashboard() {
  const { currentTenant } = useContext(TenantContext);
  const [metrics, setMetrics] = useState(null);
  const [recentContent, setRecentContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTenant) return;

    const fetchMetrics = async () => {
      setLoading(true);
      try {
        // Fetch dashboard metrics
        const { data: contentCount } = await supabase
          .from('content_items')
          .select('count()', { count: 'exact' })
          .eq('tenant_id', currentTenant.id);

        const { data: recentItems } = await supabase
          .from('content_items')
          .select('id, title, status, updated_at, created_by')
          .eq('tenant_id', currentTenant.id)
          .order('updated_at', { ascending: false })
          .limit(5);

        setMetrics({
          totalContent: contentCount?.[0]?.count || 0,
          activeWorkspaces: 3,
          pendingApprovals: 2,
          teamMembers: 8,
        });

        setRecentContent(recentItems || []);
      } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [currentTenant]);

  if (loading) {
    return (
      <Grid className="dashboard-grid">
        <Column lg={4} md={4} sm={4}>
          <Skeleton className="metric-skeleton" />
        </Column>
        <Column lg={4} md={4} sm={4}>
          <Skeleton className="metric-skeleton" />
        </Column>
        <Column lg={4} md={4} sm={4}>
          <Skeleton className="metric-skeleton" />
        </Column>
      </Grid>
    );
  }

  const tableHeaders = ['Title', 'Status', 'Modified', 'Created By'];
  const tableRows = recentContent.map((item) => [
    item.title,
    item.status,
    new Date(item.updated_at).toLocaleDateString(),
    item.created_by,
  ]);

  return (
    <div className="dashboard-page">
      <Heading as="h1">Dashboard</Heading>

      {/* Metrics Grid */}
      <Grid className="dashboard-metrics">
        <Column lg={4} md={4} sm={4}>
          <Tile className="metric-tile">
            <h3>{metrics.totalContent}</h3>
            <p>Content Items</p>
          </Tile>
        </Column>
        <Column lg={4} md={4} sm={4}>
          <Tile className="metric-tile">
            <h3>{metrics.activeWorkspaces}</h3>
            <p>Active Workspaces</p>
          </Tile>
        </Column>
        <Column lg={4} md={4} sm={4}>
          <Tile className="metric-tile">
            <h3>{metrics.pendingApprovals}</h3>
            <p>Pending Approvals</p>
          </Tile>
        </Column>
        <Column lg={4} md={4} sm={4}>
          <Tile className="metric-tile">
            <h3>{metrics.teamMembers}</h3>
            <p>Team Members</p>
          </Tile>
        </Column>
      </Grid>

      {/* Recent Content Table */}
      <div className="dashboard-section">
        <Heading as="h2">Recently Updated</Heading>
        <DataTable
          rows={recentContent.map((item, idx) => ({
            id: item.id,
            cells: [item.title, item.status, new Date(item.updated_at).toLocaleDateString(), item.created_by],
          }))}
          headers={tableHeaders.map((header) => ({ key: header.toLowerCase(), header }))}
        >
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
            <table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader key={header.key} {...getHeaderProps({ header })}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </table>
          )}
        </DataTable>
      </div>
    </div>
  );
}

export default Dashboard;
```

#### Dashboard CSS

```css
/* src/pages/console/Dashboard.css */
.dashboard-page {
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-page h1 {
  margin-bottom: 32px;
  font-size: 28px;
  font-weight: 300;
  color: var(--cds-text-01);
}

.dashboard-metrics {
  margin-bottom: 48px;
  gap: 24px;
}

.metric-tile {
  background-color: var(--cds-ui-02);
  padding: 24px;
  border-radius: 4px;
  text-align: center;
  border-left: 4px solid #0f62fe;
}

.metric-tile h3 {
  font-size: 32px;
  font-weight: 300;
  color: #0f62fe;
  margin: 0 0 8px 0;
}

.metric-tile p {
  color: var(--cds-text-02);
  margin: 0;
  font-size: 14px;
}

.dashboard-section {
  background-color: var(--cds-ui-02);
  padding: 24px;
  border-radius: 4px;
}

.dashboard-section h2 {
  margin-bottom: 16px;
  font-size: 20px;
  font-weight: 300;
}

.metric-skeleton {
  height: 120px;
  border-radius: 4px;
}
```

### Content Factory Page

The Content Factory is the primary content management interface with a matrix-style layout.

```jsx
// src/pages/console/ContentFactory.jsx
import { useEffect, useState, useContext } from 'react';
import {
  Heading,
  Button,
  DataTable,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  TextInput,
  TextArea,
  ProgressIndicator,
  ProgressStep,
} from '@carbon/react';
import { Add as AddIcon, Edit as EditIcon, TrashCan as DeleteIcon } from '@carbon/icons-react';
import { TenantContext } from '../../context/TenantContext';
import { supabase } from '../../lib/supabaseClient';
import './ContentFactory.css';

function ContentFactory() {
  const { currentTenant } = useContext(TenantContext);
  const [contentItems, setContentItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', category: '' });

  useEffect(() => {
    if (!currentTenant) return;

    const fetchContentItems = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('content_items')
          .select('*')
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setContentItems(data || []);
      } catch (error) {
        console.error('Error fetching content items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContentItems();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`content_items:${currentTenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_items',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setContentItems([payload.new, ...contentItems]);
          } else if (payload.eventType === 'UPDATE') {
            setContentItems(contentItems.map((item) => (item.id === payload.new.id ? payload.new : item)));
          } else if (payload.eventType === 'DELETE') {
            setContentItems(contentItems.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentTenant]);

  const handleCreateItem = async () => {
    try {
      const { data, error } = await supabase.from('content_items').insert([
        {
          tenant_id: currentTenant.id,
          title: newItem.title,
          description: newItem.description,
          category: newItem.category,
          status: 'draft',
          created_at: new Date(),
        },
      ]);

      if (error) throw error;

      setNewItem({ title: '', description: '', category: '' });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating content item:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'gray';
      case 'review':
        return 'blue';
      case 'approved':
        return 'green';
      case 'published':
        return 'green';
      case 'archived':
        return 'gray';
      default:
        return 'gray';
    }
  };

  return (
    <div className="content-factory-page">
      <div className="factory-header">
        <Heading as="h1">Content Factory</Heading>
        <Button kind="primary" onClick={() => setShowCreateModal(true)} renderIcon={AddIcon}>
          Create Content
        </Button>
      </div>

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        modalHeading="Create New Content Item"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        onRequestClose={() => setShowCreateModal(false)}
        onRequestSubmit={handleCreateItem}
      >
        <div className="modal-form">
          <TextInput
            labelText="Title"
            placeholder="Enter content title"
            value={newItem.title}
            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
          />
          <TextArea
            labelText="Description"
            placeholder="Enter content description"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
          />
          <TextInput
            labelText="Category"
            placeholder="e.g., Blog, Video, Infographic"
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
          />
        </div>
      </Modal>

      {/* Content Matrix Table */}
      <div className="factory-table">
        <DataTable
          rows={contentItems.map((item) => ({
            id: item.id,
            cells: [
              item.title,
              item.category || 'Uncategorized',
              item.status,
              new Date(item.created_at).toLocaleDateString(),
            ],
          }))}
          headers={['Title', 'Category', 'Status', 'Created'].map((header) => ({
            key: header.toLowerCase(),
            header,
          }))}
        >
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
            <table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader key={header.key} {...getHeaderProps({ header })}>
                      {header.header}
                    </TableHeader>
                  ))}
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => {
                      // Special handling for status column
                      if (cell.info.header === 'status') {
                        const item = contentItems.find((i) => i.id === row.id);
                        return (
                          <TableCell key={cell.id}>
                            <Tag type={getStatusColor(item.status)} title={item.status}>
                              {item.status}
                            </Tag>
                          </TableCell>
                        );
                      }
                      return <TableCell key={cell.id}>{cell.value}</TableCell>;
                    })}
                    <TableCell>
                      <OverflowMenu flipped>
                        <OverflowMenuItem itemText="Edit" renderIcon={EditIcon} />
                        <OverflowMenuItem itemText="Delete" renderIcon={DeleteIcon} isDelete />
                      </OverflowMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          )}
        </DataTable>
      </div>
    </div>
  );
}

export default ContentFactory;
```

#### ContentFactory CSS

```css
/* src/pages/console/ContentFactory.css */
.content-factory-page {
  max-width: 1400px;
  margin: 0 auto;
}

.factory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.factory-header h1 {
  font-size: 28px;
  font-weight: 300;
  margin: 0;
}

.factory-table {
  background-color: var(--cds-ui-02);
  padding: 24px;
  border-radius: 4px;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.modal-form input,
.modal-form textarea {
  background-color: var(--cds-ui-01);
  border: 1px solid var(--cds-ui-03);
  color: var(--cds-text-01);
  padding: 8px 12px;
  border-radius: 4px;
}
```

### Brand DNA Page

```jsx
// src/pages/console/BrandDNA.jsx
import { useEffect, useState, useContext } from 'react';
import {
  Heading,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  TabPanels,
  TextInput,
  TextArea,
  Button,
  Notification,
} from '@carbon/react';
import { TenantContext } from '../../context/TenantContext';
import { supabase } from '../../lib/supabaseClient';
import './BrandDNA.css';

function BrandDNA() {
  const { currentTenant } = useContext(TenantContext);
  const [brandData, setBrandData] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    if (!currentTenant) return;

    const fetchBrandDNA = async () => {
      try {
        const { data, error } = await supabase
          .from('brand_dna')
          .select('*')
          .eq('tenant_id', currentTenant.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        setBrandData(
          data || {
            tenant_id: currentTenant.id,
            mission: '',
            values: '',
            voice_tone: '',
            visual_guidelines: '',
          }
        );
      } catch (error) {
        console.error('Error fetching brand DNA:', error);
      }
    };

    fetchBrandDNA();
  }, [currentTenant]);

  const handleChange = (field, value) => {
    setBrandData({ ...brandData, [field]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('brand_dna')
        .upsert([brandData], { onConflict: 'tenant_id' });

      if (error) throw error;

      setSaveStatus({ type: 'success', message: 'Brand DNA saved successfully!' });
      setHasChanges(false);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Error saving brand DNA:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save Brand DNA.' });
    }
  };

  if (!brandData) return <div>Loading...</div>;

  return (
    <div className="brand-dna-page">
      <Heading as="h1">Brand DNA</Heading>

      {saveStatus && (
        <Notification
          kind={saveStatus.type}
          title={saveStatus.type === 'success' ? 'Success' : 'Error'}
          subtitle={saveStatus.message}
          lowContrast={false}
        />
      )}

      <Tabs>
        <TabList aria-label="Brand DNA Sections">
          <Tab>Mission & Vision</Tab>
          <Tab>Values</Tab>
          <Tab>Voice & Tone</Tab>
          <Tab>Visual Guidelines</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <TextArea
              labelText="Mission Statement"
              placeholder="Define your brand's mission and vision"
              value={brandData.mission}
              onChange={(e) => handleChange('mission', e.target.value)}
              rows={8}
            />
          </TabPanel>
          <TabPanel>
            <TextArea
              labelText="Core Values"
              placeholder="List and describe your brand's core values"
              value={brandData.values}
              onChange={(e) => handleChange('values', e.target.value)}
              rows={8}
            />
          </TabPanel>
          <TabPanel>
            <TextArea
              labelText="Voice & Tone Guidelines"
              placeholder="Define how your brand communicates"
              value={brandData.voice_tone}
              onChange={(e) => handleChange('voice_tone', e.target.value)}
              rows={8}
            />
          </TabPanel>
          <TabPanel>
            <TextArea
              labelText="Visual Guidelines"
              placeholder="Describe colors, typography, imagery, etc."
              value={brandData.visual_guidelines}
              onChange={(e) => handleChange('visual_guidelines', e.target.value)}
              rows={8}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>

      <div className="brand-dna-actions">
        <Button kind="primary" onClick={handleSave} disabled={!hasChanges}>
          Save Changes
        </Button>
        <Button kind="ghost" onClick={() => setHasChanges(false)}>
          Discard
        </Button>
      </div>
    </div>
  );
}

export default BrandDNA;
```

### Tenants Management Page

```jsx
// src/pages/console/Tenants.jsx
import { useEffect, useState } from 'react';
import {
  Heading,
  Button,
  DataTable,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Modal,
  TextInput,
} from '@carbon/react';
import { Add as AddIcon } from '@carbon/icons-react';
import { supabase } from '../../lib/supabaseClient';
import './Tenants.css';

function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', description: '' });

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });

        if (error) throw error;
        setTenants(data || []);
      } catch (error) {
        console.error('Error fetching tenants:', error);
      }
    };

    fetchTenants();
  }, []);

  const handleCreateTenant = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .insert([
          {
            name: newTenant.name,
            description: newTenant.description,
            created_at: new Date(),
          },
        ])
        .select();

      if (error) throw error;

      setTenants([...tenants, data[0]]);
      setNewTenant({ name: '', description: '' });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating tenant:', error);
    }
  };

  return (
    <div className="tenants-page">
      <div className="tenants-header">
        <Heading as="h1">Tenant Management</Heading>
        <Button kind="primary" onClick={() => setShowCreateModal(true)} renderIcon={AddIcon}>
          Create Tenant
        </Button>
      </div>

      <Modal
        open={showCreateModal}
        modalHeading="Create New Tenant"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        onRequestClose={() => setShowCreateModal(false)}
        onRequestSubmit={handleCreateTenant}
      >
        <div className="modal-form">
          <TextInput
            labelText="Tenant Name"
            placeholder="Enter tenant name"
            value={newTenant.name}
            onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
          />
          <TextInput
            labelText="Description"
            placeholder="Brief description of the tenant"
            value={newTenant.description}
            onChange={(e) => setNewTenant({ ...newTenant, description: e.target.value })}
          />
        </div>
      </Modal>

      <DataTable
        rows={tenants.map((tenant) => ({
          id: tenant.id,
          cells: [tenant.name, tenant.description, new Date(tenant.created_at).toLocaleDateString()],
        }))}
        headers={['Name', 'Description', 'Created'].map((header) => ({
          key: header.toLowerCase(),
          header,
        }))}
      >
        {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
          <table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader key={header.key} {...getHeaderProps({ header })}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} {...getRowProps({ row })}>
                  {row.cells.map((cell) => (
                    <TableCell key={cell.id}>{cell.value}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </table>
        )}
      </DataTable>
    </div>
  );
}

export default Tenants;
```

### Settings Page

```jsx
// src/pages/console/Settings.jsx
import { useState } from 'react';
import {
  Heading,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  TabPanels,
  TextInput,
  Button,
  Notification,
  Toggle,
} from '@carbon/react';
import './Settings.css';

function Settings() {
  const [settings, setSettings] = useState({
    platform_name: 'genOS™ Cloud Platform',
    max_file_size: 100,
    enable_notifications: true,
    enable_analytics: true,
  });
  const [saveStatus, setSaveStatus] = useState(null);

  const handleChange = (field, value) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleSave = () => {
    setSaveStatus({ type: 'success', message: 'Settings saved successfully!' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="settings-page">
      <Heading as="h1">Settings</Heading>

      {saveStatus && (
        <Notification
          kind={saveStatus.type}
          title={saveStatus.type === 'success' ? 'Success' : 'Error'}
          subtitle={saveStatus.message}
          lowContrast={false}
        />
      )}

      <Tabs>
        <TabList aria-label="Settings Sections">
          <Tab>General</Tab>
          <Tab>Features</Tab>
          <Tab>Security</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <div className="settings-form">
              <TextInput
                labelText="Platform Name"
                value={settings.platform_name}
                onChange={(e) => handleChange('platform_name', e.target.value)}
              />
              <TextInput
                labelText="Max File Size (MB)"
                type="number"
                value={settings.max_file_size}
                onChange={(e) => handleChange('max_file_size', parseInt(e.target.value))}
              />
            </div>
          </TabPanel>
          <TabPanel>
            <div className="settings-form">
              <Toggle
                id="notifications"
                labelText="Enable Notifications"
                toggled={settings.enable_notifications}
                onToggle={(state) => handleChange('enable_notifications', state)}
              />
              <Toggle
                id="analytics"
                labelText="Enable Analytics"
                toggled={settings.enable_analytics}
                onToggle={(state) => handleChange('enable_analytics', state)}
              />
            </div>
          </TabPanel>
          <TabPanel>
            <div className="settings-form">
              <Button kind="danger--tertiary">Reset API Keys</Button>
              <Button kind="danger--tertiary">Clear Cache</Button>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <div className="settings-actions">
        <Button kind="primary" onClick={handleSave}>
          Save Settings
        </Button>
      </div>
    </div>
  );
}

export default Settings;
```

### Workstation Coming Soon Page

```jsx
// src/pages/workstation/ComingSoon.jsx
import { Heading, Paragraph, Button } from '@carbon/react';
import { Link } from 'react-router-dom';
import './ComingSoon.css';

function WorkstationComingSoon() {
  return (
    <div className="coming-soon-page">
      <div className="coming-soon-content">
        <Heading as="h1">Workstation</Heading>
        <Paragraph>This feature is coming soon. Check back later!</Paragraph>
        <Button as={Link} to="/console/dashboard" kind="primary">
          Back to Console
        </Button>
      </div>
    </div>
  );
}

export default WorkstationComingSoon;
```

---

## State Management

### Context Providers

The Console uses React Context API for global state management without Redux complexity.

```jsx
// src/context/AuthContext.jsx
import { createContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check current session
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUser(session?.user || null);
      setIsAuthenticated(!!session);
      setIsLoading(false);
    };

    checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setIsAuthenticated(!!session);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

```jsx
// src/context/TenantContext.jsx
import { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { supabase } from '../lib/supabaseClient';

export const TenantContext = createContext();

export function TenantProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [tenants, setTenants] = useState([]);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchUserTenants = async () => {
      setIsLoading(true);
      try {
        // Fetch tenants for the current user
        const { data, error } = await supabase
          .from('user_tenants')
          .select('tenant:tenants(*)')
          .eq('user_id', user.id);

        if (error) throw error;

        const userTenants = data?.map((ut) => ut.tenant) || [];
        setTenants(userTenants);

        // Set default tenant (first in list)
        if (userTenants.length > 0) {
          setCurrentTenant(userTenants[0]);
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserTenants();
  }, [user]);

  return (
    <TenantContext.Provider value={{ tenants, currentTenant, setCurrentTenant, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}
```

### App Provider Setup

```jsx
// src/App.jsx
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import ConsoleRouter from './Router';
import '@carbon/themes/css/themes.css';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <ConsoleRouter />
      </TenantProvider>
    </AuthProvider>
  );
}

export default App;
```

---

## Supabase Client Setup

### Client Initialization

```javascript
// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

### Authentication Service

```javascript
// src/services/authService.js
import { supabase } from '../lib/supabaseClient';

export const authService = {
  async login(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  },

  async signUp(email, password, metadata = {}) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
  },

  async logout() {
    return supabase.auth.signOut();
  },

  async resetPassword(email) {
    return supabase.auth.resetPasswordForEmail(email);
  },

  async getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  },
};
```

### Environment Variables

```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_APP_NAME=genOS™ Cloud Platform
VITE_API_BASE_URL=https://api.genos.cloud
```

---

## Realtime Integration

### Supabase Realtime Subscriptions

The Console uses Supabase Realtime for live updates on content changes.

```javascript
// src/hooks/useRealtimeSubscription.js
import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useRealtimeSubscription(table, filter, onUpdate) {
  useEffect(() => {
    const subscription = supabase
      .channel(`${table}:${filter}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter,
        },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [table, filter, onUpdate]);
}
```

### Live Content Updates

```jsx
// Example usage in ContentFactory.jsx
useEffect(() => {
  const subscription = supabase
    .channel(`content_items:${currentTenant.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'content_items',
        filter: `tenant_id=eq.${currentTenant.id}`,
      },
      (payload) => {
        console.log('Content item changed:', payload);

        if (payload.eventType === 'INSERT') {
          setContentItems((prev) => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setContentItems((prev) => prev.map((item) => (item.id === payload.new.id ? payload.new : item)));
        } else if (payload.eventType === 'DELETE') {
          setContentItems((prev) => prev.filter((item) => item.id !== payload.old.id));
        }
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, [currentTenant]);
```

---

## Responsive Design

### Carbon Grid System

The Console uses Carbon's responsive grid system with breakpoints.

```jsx
import { Grid, Column } from '@carbon/react';

// Responsive grid layout
<Grid fullWidth>
  <Column lg={12} md={8} sm={4}>
    {/* Full width on large screens, 2/3 on medium, 1/1 on small */}
  </Column>
  <Column lg={4} md={4} sm={4}>
    {/* 1/3 width on large and medium, full on small */}
  </Column>
</Grid>
```

### Breakpoints

| Breakpoint | Display Name | Min Width | Max Width |
|-----------|-------------|-----------|-----------|
| **sm** | Small | 320px | 671px |
| **md** | Medium | 672px | 1055px |
| **lg** | Large | 1056px | 1312px |
| **xlg** | Extra Large | 1313px | 1584px |
| **max** | Max | 1585px+ | - |

### Responsive CSS Example

```css
/* Mobile-first approach */
.container {
  display: flex;
  flex-direction: column;
  padding: 16px;
}

@media (min-width: 672px) {
  /* Medium screens */
  .container {
    flex-direction: row;
    padding: 24px;
  }
}

@media (min-width: 1056px) {
  /* Large screens */
  .container {
    padding: 32px;
    max-width: 1400px;
  }
}
```

---

## File Structure

```
src/
├── index.jsx                          # React entry point
├── App.jsx                            # Root component with providers
├── App.css                            # Global styles
├── Router.jsx                         # Route configuration
│
├── components/
│   └── Shell/
│       ├── ConsoleShell.jsx          # Main layout wrapper
│       ├── ConsoleShell.css          # Shell styles
│       ├── Header.jsx                # Top navigation
│       ├── Header.css                # Header styles
│       ├── SideNav.jsx               # Left sidebar
│       ├── SideNav.css               # Sidebar styles
│       ├── TenantSelector.jsx        # Tenant dropdown
│       └── UserMenu.jsx              # User account menu
│
├── pages/
│   ├── auth/
│   │   └── MasterLogin.jsx           # Login page (no shell)
│   │
│   ├── console/
│   │   ├── Dashboard.jsx             # Dashboard page
│   │   ├── Dashboard.css
│   │   ├── ContentFactory.jsx        # Content management
│   │   ├── ContentFactory.css
│   │   ├── ContentFactoryDetail.jsx  # Content editor
│   │   ├── BrandDNA.jsx              # Brand guidelines
│   │   ├── BrandDNA.css
│   │   ├── Tenants.jsx               # Tenant management
│   │   ├── Tenants.css
│   │   ├── Settings.jsx              # System settings
│   │   └── Settings.css
│   │
│   ├── workstation/
│   │   ├── ComingSoon.jsx            # Placeholder page
│   │   └── ComingSoon.css
│   │
│   └── errors/
│       ├── NotFound.jsx              # 404 page
│       └── Unauthorized.jsx          # 403 page
│
├── context/
│   ├── AuthContext.jsx               # Authentication state
│   └── TenantContext.jsx             # Tenant selection state
│
├── services/
│   ├── authService.js                # Auth API calls
│   ├── contentService.js             # Content API calls
│   ├── tenantService.js              # Tenant API calls
│   └── notificationService.js        # Notification API calls
│
├── hooks/
│   ├── useAuth.js                    # Auth context hook
│   ├── useTenant.js                  # Tenant context hook
│   ├── useRealtimeSubscription.js    # Realtime updates
│   └── useNotifications.js           # Notification management
│
├── lib/
│   ├── supabaseClient.js             # Supabase initialization
│   ├── httpClient.js                 # Axios/fetch setup
│   └── constants.js                  # App constants
│
├── utils/
│   ├── formatters.js                 # Date, text formatting
│   ├── validators.js                 # Form validation
│   └── errorHandler.js               # Error utilities
│
├── assets/
│   ├── logos/
│   │   └── genos-logo.svg            # genOS™ branding
│   ├── images/
│   │   └── placeholder.jpg
│   └── fonts/
│       └── IBM Plex Sans
│
└── config/
    ├── theme.js                      # Theme configuration
    └── routes.js                     # Route definitions
```

---

## Component Implementation Examples

### Custom Hook: useAuth

```javascript
// src/hooks/useAuth.js
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Custom Hook: useTenant

```javascript
// src/hooks/useTenant.js
import { useContext } from 'react';
import { TenantContext } from '../context/TenantContext';

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}
```

### Notification Component

```jsx
// src/components/Notification/Toast.jsx
import { Notification, ToastNotification } from '@carbon/react';
import './Toast.css';

function Toast({ type = 'info', title, subtitle, onClose }) {
  return (
    <ToastNotification
      kind={type}
      title={title}
      subtitle={subtitle}
      timeout={4000}
      onClose={onClose}
      lowContrast={false}
      style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}
    />
  );
}

export default Toast;
```

---

## Best Practices & Guidelines

### Code Organization

1. **Components First**: Build reusable components before pages
2. **Service Layer**: Keep API calls in dedicated service files
3. **Context for Global State**: Use React Context for auth and tenant data
4. **Hooks for Logic**: Extract logic into custom hooks for reusability
5. **Separation of Concerns**: Keep styling, logic, and markup separate

### Performance Optimization

1. **Code Splitting**: Use React.lazy() for route-based code splitting
2. **Memoization**: Use React.memo() for expensive component re-renders
3. **State Optimization**: Keep state as close to where it's used as possible
4. **Lazy Loading**: Load images and content on demand
5. **Database Indexing**: Ensure Supabase tables have proper indexes

### Security Practices

1. **Environment Variables**: Never commit API keys or secrets
2. **Auth Headers**: Include JWT tokens in all authenticated requests
3. **CORS Configuration**: Configure Supabase CORS settings properly
4. **Input Validation**: Validate all user inputs before sending to API
5. **Error Handling**: Never expose sensitive information in error messages

### Accessibility (a11y)

1. **ARIA Labels**: Add aria-label to interactive elements
2. **Keyboard Navigation**: Ensure all features are keyboard accessible
3. **Color Contrast**: Maintain WCAG AA contrast ratios
4. **Semantic HTML**: Use proper HTML semantics (button, nav, main, etc.)
5. **Focus Management**: Manage focus appropriately during navigation

### Testing Guidelines

```javascript
// Example test structure
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import Dashboard from '../pages/console/Dashboard';

describe('Dashboard Component', () => {
  test('renders dashboard heading', () => {
    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    );

    const heading = screen.getByRole('heading', { name: /dashboard/i });
    expect(heading).toBeInTheDocument();
  });

  test('displays metrics when data loads', async () => {
    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    );

    const contentMetric = await screen.findByText(/content items/i);
    expect(contentMetric).toBeInTheDocument();
  });
});
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| **Components** | PascalCase | `ContentFactory.jsx` |
| **Functions** | camelCase | `handleCreateItem()` |
| **CSS Classes** | kebab-case | `.content-factory-page` |
| **Variables** | camelCase | `const contentItems = []` |
| **Constants** | UPPER_CASE | `const MAX_FILE_SIZE = 100` |
| **Hooks** | camelCase with `use` prefix | `useAuth`, `useTenant` |

### Git Workflow

```bash
# Feature branch naming
git checkout -b feature/content-factory-matrix
git checkout -b fix/dashboard-loading-state
git checkout -b refactor/carbon-components-upgrade

# Commit message format
git commit -m "feat: add content factory matrix layout"
git commit -m "fix: resolve dashboard loading state issue"
git commit -m "refactor: upgrade carbon components to v11"
```

---

## Deployment Considerations

### Build Configuration

```javascript
// vite.config.js
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable for production
    minify: 'terser',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          carbon: ['@carbon/react', '@carbon/icons-react'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
```

### Production Checklist

- [ ] Environment variables configured in production
- [ ] API endpoints updated to production URLs
- [ ] Supabase RLS policies configured
- [ ] Error tracking (Sentry) integrated
- [ ] Analytics configured
- [ ] HTTPS enforced
- [ ] CSP headers configured
- [ ] Performance monitoring enabled
- [ ] Backup and disaster recovery plan
- [ ] User documentation complete

---

## Troubleshooting & Common Issues

### Theme Not Applying

**Problem**: Carbon g100 theme not visible
**Solution**: Ensure `@carbon/themes/css/themes.css` is imported and `data-carbon-theme="g100"` is on root HTML element

### Realtime Updates Not Working

**Problem**: Changes not reflecting in real-time
**Solution**: Verify Supabase Realtime is enabled, subscription filter matches table data, and JWT is valid

### Context Values Undefined

**Problem**: Context hook throws "undefined" error
**Solution**: Ensure component is wrapped in corresponding Provider, check import paths

### Build Size Too Large

**Problem**: Bundle size exceeds limits
**Solution**: Enable code splitting, lazy load routes, remove unused dependencies, analyze with `vite-plugin-visualizer`

---

## References & Resources

- [IBM Carbon Design System](https://carbondesignsystem.com/)
- [Carbon React Components](https://react.carbondesignsystem.com/)
- [React Router Documentation](https://reactrouter.com/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Vite Documentation](https://vitejs.dev/)
- [React Best Practices](https://react.dev/)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Documento #4 de 10**

*Version 2.0.0 | Date: 2026-02-28 | genOS™ Cloud Platform*
