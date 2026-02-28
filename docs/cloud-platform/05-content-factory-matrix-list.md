# genOS™ Cloud Platform — Super Prompt #5

**Content Factory: Matrix List & Single-Page Workstation Architecture**

- **Version**: 2.0.0
- **Date**: 2026-02-28
- **Module**: Content Factory (First & Only Active Module)
- **Status**: Exhaustive Documentation
- **Classification**: Internal Technical Reference

---

## Table of Contents

1. [Content Factory Overview](#content-factory-overview)
2. [Single-Page Application Architecture](#single-page-application-architecture)
3. [Matrix List Component Structure](#matrix-list-component-structure)
4. [DataTable Columns & Configuration](#datatable-columns--configuration)
5. [Row Expansion Mechanics](#row-expansion-mechanics)
6. [Row Glow Effect (Critical UX Feature)](#row-glow-effect-critical-ux-feature)
7. [Status System & Visual Indicators](#status-system--visual-indicators)
8. [Modals & Dialogs](#modals--dialogs)
9. [AI Integration & Processing](#ai-integration--processing)
10. [Data Flow & State Management](#data-flow--state-management)
11. [Realtime Subscriptions](#realtime-subscriptions)
12. [Component Code Structure](#component-code-structure)
13. [Styling & CSS](#styling--css)
14. [Actions & User Interactions](#actions--user-interactions)
15. [Integration Points](#integration-points)

---

## Content Factory Overview

The **Content Factory** is the flagship module of the genOS™ Cloud Platform, serving as a centralized workstation for marketing professionals and content creators to generate, review, manage, and publish AI-powered content.

### Core Characteristics

- **Single-Page Application (SPA)**: Entire application centered on one primary interface
- **Single DataTable Focus**: All content operations occur within a Carbon DataTable
- **AI-Powered**: Leverages Edge Functions and AI Router for content generation
- **Compliance-Aware**: Integrated scoring and heuristic analysis
- **Real-time Updates**: Supabase Realtime subscriptions for live status changes
- **Multi-Modal Interface**: Expandable rows with media galleries, editing areas, and action buttons

### Business Context

The Content Factory enables users to:
- Generate marketing content aligned with Brand DNA
- Evaluate content compliance with automated scoring
- Review AI-generated insights through heuristic reports
- Collect stakeholder feedback via rating system
- Schedule content for publication
- Manage content lifecycle from draft to published

---

## Single-Page Application Architecture

### Overview

The Content Factory is implemented as a React-based Single-Page Application (SPA) with the following characteristics:

- **Single Primary View**: One main workstation component
- **Component Hierarchy**: Nested modals, toolbars, and row expansions
- **State Management**: React hooks (useState, useEffect, useCallback) for local state
- **Server-Client Sync**: Supabase JS Client for real-time data synchronization
- **No Page Reloads**: All interactions handled through component state updates

### Entry Point

```
App.tsx
└── ContentFactory.tsx (or index)
    └── MatrixTable.tsx (Primary Component)
        ├── TableToolbar (Search, Filters)
        ├── DataTable (rows + expansion)
        │   ├── RowExpanded (media + edit areas)
        │   ├── ActionButtons (row-level)
        │   └── RowGlow (visual indicator)
        └── Modals (HeuristicReport, Feedback, BrandDNA, DatePicker)
```

### Key Principles

1. **Unification**: All content in a single table — no separate pages
2. **Context Preservation**: Expanded rows maintain scroll position and state
3. **Non-Blocking UI**: Modals overlay the table without navigation
4. **Real-time Responsiveness**: Instant visual feedback for all operations

---

## Matrix List Component Structure

### MatrixTable.tsx — High-Level Architecture

The `MatrixTable` component is the core workstation UI, implementing a Carbon DataTable with advanced features.

#### Component Props

```typescript
interface MatrixTableProps {
  tenantId: string;           // Tenant identifier
  contentItems: ContentItem[]; // Data source
  onStatusChange?: (id: string, newStatus: Status) => void;
  onRegenerate?: (id: string) => void;
  onSchedule?: (id: string, date: Date) => void;
}
```

#### ContentItem Data Model

```typescript
interface ContentItem {
  id: string;
  title: string;
  body: string;
  contentType: "article" | "social_post" | "email" | "video_script" | "landing_page";
  platform: "facebook" | "instagram" | "twitter" | "linkedin" | "web" | "email";
  status: "draft" | "generated" | "reviewing" | "approved" | "published" | "rejected";
  complianceScore: number; // 0–100
  pillar: string; // Brand pillar/campaign
  scheduledDate?: Date;
  aiProvider?: string; // e.g., "openai", "anthropic"
  aiModel?: string;    // e.g., "gpt-4", "claude-3"
  mediaUrls?: string[]; // Gallery images
  heuristicReport?: string;
  feedback?: {
    rating: number;
    comment: string;
    author?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

#### Component State

```typescript
const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
const [searchQuery, setSearchQuery] = useState("");
const [activeModal, setActiveModal] = useState<ModalType | null>(null);
const [modalData, setModalData] = useState<ModalPayload | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [rowGlowActive, setRowGlowActive] = useState<Set<string>>(new Set());
const [filteredItems, setFilteredItems] = useState<ContentItem[]>([]);
```

#### Lifecycle

1. **Mount**: Fetch `content_items` from Supabase
2. **Subscribe**: Set up Realtime listener for status changes
3. **Render**: Display DataTable with current items
4. **User Interaction**: Handle row expand, modal open, action click
5. **Unmount**: Unsubscribe from Realtime

---

## DataTable Columns & Configuration

### Column Definitions

The Matrix List displays seven core columns, each with specific behavior and styling:

#### 1. **Status Column**
- **Type**: Tag component (Carbon UI)
- **Values**: `draft`, `generated`, `reviewing`, `approved`, `published`, `rejected`
- **Width**: 120px
- **Filterable**: Yes
- **Sortable**: Yes
- **Color Mapping**: See Status System section

#### 2. **Title Column**
- **Type**: Text (editable in expanded row only)
- **Width**: 300px
- **Truncated**: Yes (CSS `text-overflow: ellipsis`)
- **Sortable**: Yes
- **Max Length**: 255 characters

#### 3. **Content Type Column**
- **Type**: Badge (small tag)
- **Values**: article, social_post, email, video_script, landing_page
- **Width**: 140px
- **Sortable**: Yes
- **Icon Support**: Optional small icon per type

#### 4. **Platform Column**
- **Type**: Badge
- **Values**: facebook, instagram, twitter, linkedin, web, email
- **Width**: 130px
- **Sortable**: Yes
- **Icon Support**: Platform logo or icon

#### 5. **Compliance Score Column**
- **Type**: Numeric with visual indicator
- **Values**: 0–100 (percentage)
- **Width**: 150px
- **Sortable**: Yes
- **Visual**: Color gradient (red ≤40, yellow 40–70, green ≥70)
- **Display Format**: `${score}%` with background color

#### 6. **Pillar Column**
- **Type**: Text
- **Width**: 150px
- **Sortable**: Yes
- **Values**: Campaign/brand pillar names (from Brand DNA)

#### 7. **Scheduled Date Column**
- **Type**: Date (ISO format or formatted display)
- **Width**: 140px
- **Sortable**: Yes
- **Format**: "DD/MM/YYYY" or empty if not scheduled

#### 8. **Actions Column**
- **Type**: OverflowMenu (three-dot menu)
- **Width**: 80px
- **Sticky**: Right-aligned, stays visible on scroll
- **Menu Items**: See Actions & User Interactions section

### Column Configuration Object

```typescript
const columns = [
  {
    key: "status",
    header: "Status",
    width: 120,
    render: (item: ContentItem) => (
      <Tag type={getStatusColor(item.status)} title={item.status}>
        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
      </Tag>
    ),
    sortable: true,
  },
  {
    key: "title",
    header: "Title",
    width: 300,
    render: (item: ContentItem) => (
      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {item.title || "Untitled"}
      </div>
    ),
    sortable: true,
  },
  {
    key: "contentType",
    header: "Content Type",
    width: 140,
    render: (item: ContentItem) => (
      <Badge>{item.contentType.replace(/_/g, " ")}</Badge>
    ),
    sortable: true,
  },
  {
    key: "platform",
    header: "Platform",
    width: 130,
    render: (item: ContentItem) => (
      <Badge>{item.platform.charAt(0).toUpperCase() + item.platform.slice(1)}</Badge>
    ),
    sortable: true,
  },
  {
    key: "complianceScore",
    header: "Compliance Score",
    width: 150,
    render: (item: ContentItem) => (
      <div
        style={{
          padding: "4px 8px",
          borderRadius: "4px",
          backgroundColor: getComplianceColor(item.complianceScore),
          color: "#fff",
          fontWeight: "bold",
        }}
      >
        {item.complianceScore}%
      </div>
    ),
    sortable: true,
  },
  {
    key: "pillar",
    header: "Pillar",
    width: 150,
    render: (item: ContentItem) => item.pillar || "—",
    sortable: true,
  },
  {
    key: "scheduledDate",
    header: "Scheduled Date",
    width: 140,
    render: (item: ContentItem) => (
      item.scheduledDate
        ? new Date(item.scheduledDate).toLocaleDateString("pt-BR")
        : "—"
    ),
    sortable: true,
  },
  {
    key: "actions",
    header: "",
    width: 80,
    sticky: true,
    render: (item: ContentItem) => <RowActionsMenu item={item} />,
  },
];
```

---

## Row Expansion Mechanics

### Expansion Trigger

- **User Action**: Click anywhere on the row (outside of action menu)
- **Behavior**: Row expands below, pushing subsequent rows down
- **State**: Only one row can be expanded at a time (`expandedRowId`)
- **Animation**: Smooth 300ms transition

### Expanded Row Content Structure

When a row is expanded, the following components are revealed:

#### 1. Media Gallery Placeholder

```typescript
<div className="expansion-media-gallery">
  <h4>Media Gallery</h4>
  <div className="gallery-container">
    {item.mediaUrls && item.mediaUrls.length > 0 ? (
      item.mediaUrls.map((url, idx) => (
        <img
          key={idx}
          src={url}
          alt={`Media ${idx + 1}`}
          style={{ maxWidth: "150px", borderRadius: "4px" }}
        />
      ))
    ) : (
      <p style={{ color: "#8d8d8d" }}>No media attached</p>
    )}
  </div>
</div>
```

#### 2. Title Edit TextArea

```typescript
<div className="expansion-title-editor">
  <label>Title</label>
  <textarea
    value={editingTitle}
    onChange={(e) => setEditingTitle(e.target.value)}
    maxLength={255}
    rows={2}
    placeholder="Enter content title..."
  />
  <small>{editingTitle.length}/255</small>
</div>
```

#### 3. Body Edit TextArea

```typescript
<div className="expansion-body-editor">
  <label>Body</label>
  <textarea
    value={editingBody}
    onChange={(e) => setEditingBody(e.target.value)}
    rows={8}
    placeholder="Enter content body..."
  />
  <small>{editingBody.length} characters</small>
</div>
```

#### 4. Action Buttons

Buttons within expanded row (below TextAreas):

- **Save Changes**: Persists edits to Supabase
- **Regenerate**: Triggers AI Router (activates row glow)
- **View Heuristic**: Opens HeuristicReport modal
- **Give Feedback**: Opens Feedback modal
- **View Brand DNA**: Opens BrandDNA modal
- **Schedule**: Opens date picker modal

### Expansion Container CSS

```css
.row-expansion {
  background-color: #f4f4f4;
  border-top: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
  padding: 24px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  animation: slideDown 300ms ease-out;
}

.row-expansion-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row-expansion-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.expansion-media-gallery {
  padding: 16px;
  background-color: #fff;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.expansion-title-editor,
.expansion-body-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.expansion-title-editor textarea,
.expansion-body-editor textarea {
  padding: 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-family: "IBM Plex Sans", sans-serif;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
}

.expansion-title-editor textarea:focus,
.expansion-body-editor textarea:focus {
  outline: none;
  border-color: #0f62fe;
  box-shadow: 0 2px 4px rgba(15, 98, 254, 0.25);
}

.row-expansion-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## Row Glow Effect (Critical UX Feature)

### Overview

The Row Glow Effect is a visual indicator that communicates to users that AI content regeneration is in progress for a specific row. This is a **CRITICAL UX FEATURE** that prevents user confusion and accidental interactions during processing.

### Visual Design

- **Color**: IBM Blue (`#0f62fe`)
- **Effect**: Pulsing box-shadow with 2-second cycle
- **Border**: 1px solid blue outline around entire row
- **Opacity**: 70% row opacity (slightly dimmed)
- **State**: Disabled pointer events (no clicks)

### CSS Implementation

```css
/* When row is actively processing */
.row-glow-active {
  border: 1px solid #0f62fe !important;
  box-shadow: 0 0 10px rgba(15, 98, 254, 0.5) !important;
  animation: pulse-blue 2s infinite;
  pointer-events: none;
  opacity: 0.7;
}

/* Pulsing animation */
@keyframes pulse-blue {
  0% {
    box-shadow: 0 0 10px rgba(15, 98, 254, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(15, 98, 254, 0.8);
  }
  100% {
    box-shadow: 0 0 10px rgba(15, 98, 254, 0.3);
  }
}

/* Row is disabled during processing */
.row-glow-active input,
.row-glow-active button,
.row-glow-active textarea,
.row-glow-active select {
  cursor: not-allowed;
  opacity: 0.6;
}
```

### Activation Flow

1. **User clicks "Regenerate"** → Sends request to AI Router Edge Function
2. **Status set to 'generating'** → Supabase updates `content_items` row
3. **Realtime subscription fires** → Received status change event
4. **React state updated** → Add row ID to `rowGlowActive` Set
5. **CSS class applied** → `row-glow-active` class added to row element
6. **Row becomes non-interactive** → `pointer-events: none` prevents clicks
7. **Visual feedback continuous** → Pulsing animation runs indefinitely

### Deactivation Flow

1. **AI completes regeneration** → Edge Function writes new content to Supabase
2. **Status changed to 'generated'** → Supabase updates record
3. **Realtime subscription fires** → Received status change event
4. **React state updated** → Remove row ID from `rowGlowActive` Set
5. **CSS class removed** → `row-glow-active` class removed from row
6. **Row becomes interactive** → Normal pointer events restored
7. **Visual feedback stops** → Pulsing animation halts
8. **Updated content visible** → Table re-renders with new AI-generated content

### Implementation in React

```typescript
// In MatrixTable.tsx

const [rowGlowActive, setRowGlowActive] = useState<Set<string>>(new Set());

// Subscribe to Realtime changes
useEffect(() => {
  const subscription = supabase
    .from("content_items")
    .on("*", (payload) => {
      const { new: newRecord, old: oldRecord } = payload;

      // If status changed FROM 'generating' TO 'generated'
      if (oldRecord?.status === "generating" && newRecord?.status === "generated") {
        setRowGlowActive((prev) => {
          const next = new Set(prev);
          next.delete(newRecord.id);
          return next;
        });

        // Re-fetch updated content
        fetchContentItem(newRecord.id);
      }

      // If status changed TO 'generating'
      if (newRecord?.status === "generating") {
        setRowGlowActive((prev) => new Set(prev).add(newRecord.id));
      }
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);

// Apply glow class to row element
const getRowClassName = (itemId: string) => {
  return rowGlowActive.has(itemId) ? "row-glow-active" : "";
};

// Render row with dynamic class
<DataTableRow
  key={item.id}
  className={getRowClassName(item.id)}
  disabled={rowGlowActive.has(item.id)}
>
  {/* Row content */}
</DataTableRow>
```

### Accessibility Considerations

- **ARIA Labels**: `aria-busy="true"` when processing
- **Screen Reader Announcement**: "Content is regenerating, please wait"
- **Keyboard Navigation**: Row remains focusable but disabled
- **Color Contrast**: Blue glow meets WCAG AA standards

---

## Status System & Visual Indicators

### Status Values & Definitions

The Content Factory uses six distinct status values to represent the content lifecycle:

#### 1. **draft** (Gray)
- **Color**: `#8d8d8d`
- **Hex Badge**: Gray
- **Meaning**: Content has been created but not yet AI-generated
- **User Actions**: Generate, Edit, Delete
- **Transitions To**: generated, rejected

#### 2. **generated** (Blue)
- **Color**: `#0f62fe`
- **Hex Badge**: Blue
- **Meaning**: AI has generated content; awaiting human review
- **User Actions**: Edit, Review, Approve, Reject, Regenerate
- **Transitions To**: reviewing, generated, rejected

#### 3. **reviewing** (Yellow/Gold)
- **Color**: `#f1c21b`
- **Hex Badge**: Yellow
- **Meaning**: Content under formal review by stakeholders
- **User Actions**: Approve, Reject, View Heuristic
- **Transitions To**: approved, rejected

#### 4. **approved** (Green)
- **Color**: `#24a148`
- **Hex Badge**: Green
- **Meaning**: Content approved for publication
- **User Actions**: Schedule, Publish, Un-approve, View Heuristic
- **Transitions To**: published, approved, rejected

#### 5. **published** (Teal/Cyan)
- **Color**: `#0043ce`
- **Hex Badge**: Teal
- **Meaning**: Content has been published to platform(s)
- **User Actions**: Archive, View Heuristic
- **Transitions To**: archived

#### 6. **rejected** (Red)
- **Color**: `#da1e28`
- **Hex Badge**: Red
- **Meaning**: Content did not meet approval criteria
- **User Actions**: Edit, Regenerate, Re-submit
- **Transitions To**: generated, reviewing

### Status Color Mapping Function

```typescript
function getStatusColor(status: Status): TagType {
  const colorMap: Record<Status, TagType> = {
    draft: "gray",
    generated: "blue",
    reviewing: "yellow",
    approved: "green",
    published: "teal",
    rejected: "red",
  };
  return colorMap[status] || "gray";
}

function getStatusHexColor(status: Status): string {
  const hexMap: Record<Status, string> = {
    draft: "#8d8d8d",
    generated: "#0f62fe",
    reviewing: "#f1c21b",
    approved: "#24a148",
    published: "#0043ce",
    rejected: "#da1e28",
  };
  return hexMap[status] || "#8d8d8d";
}
```

### Tag Component Rendering

```typescript
<Tag
  type={getStatusColor(item.status)}
  title={`Status: ${item.status}`}
  onClick={(e) => e.stopPropagation()}
>
  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
</Tag>
```

### AI Label Component

For items generated by AI, a Carbon AI Label component is displayed alongside the Title:

```typescript
{item.aiModel && (
  <AILabel
    category="AI-Generated"
    title={`${item.aiProvider || "AI"}: ${item.aiModel}`}
  />
)}
```

---

## Modals & Dialogs

The Content Factory uses Carbon's Expressive Modal component for overlays that do not navigate away from the main table.

### 1. Heuristic Report Modal

#### Purpose
Display AI-powered insights about content quality, brand alignment, CTA effectiveness, and real-time context awareness.

#### Trigger
"Ver Heurística" button in expanded row or row actions menu

#### Content Structure

```typescript
<Modal isOpen={activeModal === "heuristic"} onClose={closeModal}>
  <ModalHeader>
    <ModalTitle>Heuristic Analysis</ModalTitle>
    <ModalCloseButton onClick={closeModal} />
  </ModalHeader>

  <ModalBody>
    <div className="heuristic-report">
      <section>
        <h4>Brand Alignment</h4>
        <p>{modalData.heuristicReport}</p>
      </section>

      <section>
        <h4>Campaign Scope</h4>
        <p>{modalData.campaignInsights}</p>
      </section>

      <section>
        <h4>CTA Effectiveness</h4>
        <p>{modalData.ctaAnalysis}</p>
      </section>

      <section>
        <h4>Conhecimentos da Atualidade</h4>
        <p>{modalData.contextAwareness}</p>
      </section>
    </div>
  </ModalBody>

  <ModalFooter>
    <Button kind="tertiary" onClick={closeModal}>
      Close
    </Button>
    <Button kind="primary" onClick={regenerateWithHeuristic}>
      Regenerar com Heurística
    </Button>
  </ModalFooter>
</Modal>
```

#### Data Model

```typescript
interface HeuristicReport {
  contentItemId: string;
  brandAlignment: string;      // ~100 words
  campaignScope: string;        // ~100 words
  ctaAnalysis: string;          // ~100 words
  contextAwareness: string;     // Real-time context insights
  regenerationScore?: number;   // Optional quality metric
  generatedAt: Date;
}
```

#### Content Details

- **Brand Alignment**: Analysis of how well content adheres to Brand DNA pillars, tone, values, and visual guidelines
- **Campaign Scope**: Assessment of content's relevance to campaign objectives, target audience, and expected outcomes
- **CTA Effectiveness**: Evaluation of call-to-action clarity, persuasiveness, and alignment with conversion goals
- **Conhecimentos da Atualidade**: Real-time context analysis incorporating current events, trending topics, and temporal relevance

#### Styling

```css
.heuristic-report {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: 600px;
  overflow-y: auto;
  padding: 24px 0;
}

.heuristic-report section {
  border-left: 4px solid #0f62fe;
  padding-left: 16px;
}

.heuristic-report h4 {
  margin: 0 0 8px 0;
  font-weight: 600;
  color: #161616;
}

.heuristic-report p {
  margin: 0;
  color: #525252;
  line-height: 1.6;
  font-size: 14px;
}
```

### 2. Feedback Modal

#### Purpose
Allow stakeholders to rate and comment on AI-generated content.

#### Trigger
"Give Feedback" button in expanded row or actions menu

#### Component Structure

```typescript
<Modal isOpen={activeModal === "feedback"} onClose={closeModal}>
  <ModalHeader>
    <ModalTitle>Content Feedback</ModalTitle>
    <ModalCloseButton onClick={closeModal} />
  </ModalHeader>

  <ModalBody>
    <div className="feedback-form">
      <div className="feedback-rating">
        <label>Rate this content (1-5 stars)</label>
        <StarRating
          value={feedbackRating}
          onChange={setFeedbackRating}
          maxRating={5}
        />
      </div>

      <div className="feedback-comment">
        <label>Comments (optional)</label>
        <textarea
          value={feedbackComment}
          onChange={(e) => setFeedbackComment(e.target.value)}
          placeholder="Share your thoughts on this content..."
          rows={6}
          maxLength={1000}
        />
        <small>{feedbackComment.length}/1000</small>
      </div>

      {item.feedback && (
        <div className="feedback-history">
          <h5>Previous Feedback</h5>
          <p>Rating: {item.feedback.rating}★</p>
          <p>{item.feedback.comment}</p>
          <small>By {item.feedback.author} on {new Date(item.feedback.createdAt).toLocaleDateString()}</small>
        </div>
      )}
    </div>
  </ModalBody>

  <ModalFooter>
    <Button kind="tertiary" onClick={closeModal}>
      Cancel
    </Button>
    <Button kind="primary" onClick={submitFeedback}>
      Submit Feedback
    </Button>
  </ModalFooter>
</Modal>
```

#### Data Model

```typescript
interface ContentFeedback {
  contentItemId: string;
  rating: number;       // 1-5
  comment: string;      // 0-1000 characters
  author?: string;      // User name or ID
  createdAt: Date;
  updatedAt?: Date;
}
```

#### Styling

```css
.feedback-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px 0;
}

.feedback-rating,
.feedback-comment {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feedback-rating label,
.feedback-comment label {
  font-weight: 600;
  font-size: 14px;
  color: #161616;
}

.feedback-comment textarea {
  padding: 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-family: "IBM Plex Sans", sans-serif;
  font-size: 14px;
  resize: vertical;
}

.feedback-history {
  background-color: #f4f4f4;
  padding: 16px;
  border-radius: 4px;
  border-left: 3px solid #0f62fe;
}

.feedback-history h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.feedback-history p {
  margin: 4px 0;
  font-size: 13px;
  color: #525252;
}
```

### 3. Brand DNA Viewer Modal

#### Purpose
Display the tenant's Brand DNA in read-only format. Clients cannot edit Brand DNA through this modal.

#### Trigger
"View Brand DNA" button in expanded row or actions menu

#### Component Structure

```typescript
<Modal isOpen={activeModal === "brandDNA"} onClose={closeModal} large>
  <ModalHeader>
    <ModalTitle>Brand DNA</ModalTitle>
    <ModalCloseButton onClick={closeModal} />
  </ModalHeader>

  <ModalBody>
    <div className="brand-dna-viewer">
      <section className="brand-section">
        <h4>Mission</h4>
        <p>{brandDNA.mission}</p>
      </section>

      <section className="brand-section">
        <h4>Vision</h4>
        <p>{brandDNA.vision}</p>
      </section>

      <section className="brand-section">
        <h4>Values</h4>
        <ul>
          {brandDNA.values?.map((value, idx) => (
            <li key={idx}>{value}</li>
          ))}
        </ul>
      </section>

      <section className="brand-section">
        <h4>Tone & Voice</h4>
        <p>{brandDNA.toneAndVoice}</p>
      </section>

      <section className="brand-section">
        <h4>Key Pillars</h4>
        <div className="pillars-grid">
          {brandDNA.pillars?.map((pillar, idx) => (
            <div key={idx} className="pillar-card">
              <h5>{pillar.name}</h5>
              <p>{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="brand-section">
        <h4>Visual Identity</h4>
        <p>{brandDNA.visualGuidelines}</p>
        {brandDNA.brandGuideUrl && (
          <a href={brandDNA.brandGuideUrl} target="_blank" rel="noopener noreferrer">
            Download Brand Guide
          </a>
        )}
      </section>
    </div>
  </ModalBody>

  <ModalFooter>
    <Button kind="primary" onClick={closeModal}>
      Close
    </Button>
  </ModalFooter>
</Modal>
```

#### Data Model

```typescript
interface BrandDNA {
  tenantId: string;
  mission: string;
  vision: string;
  values: string[];
  toneAndVoice: string;
  pillars: Array<{
    name: string;
    description: string;
    color?: string;
  }>;
  visualGuidelines: string;
  brandGuideUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Styling

```css
.brand-dna-viewer {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 24px 0;
  max-height: 700px;
  overflow-y: auto;
}

.brand-section {
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 24px;
}

.brand-section:last-child {
  border-bottom: none;
}

.brand-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #161616;
}

.brand-section p,
.brand-section li {
  margin: 8px 0;
  color: #525252;
  line-height: 1.6;
  font-size: 14px;
}

.brand-section ul {
  padding-left: 24px;
  margin: 0;
}

.pillars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.pillar-card {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 16px;
  background-color: #f4f4f4;
}

.pillar-card h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.pillar-card p {
  margin: 0;
  font-size: 12px;
  color: #525252;
}
```

### 4. Schedule Modal (Date Picker)

#### Purpose
Allow users to set publication date and time for content.

#### Trigger
"Schedule" button in expanded row or actions menu

#### Component Structure

```typescript
<Modal isOpen={activeModal === "schedule"} onClose={closeModal}>
  <ModalHeader>
    <ModalTitle>Schedule Content</ModalTitle>
    <ModalCloseButton onClick={closeModal} />
  </ModalHeader>

  <ModalBody>
    <div className="schedule-form">
      <div className="schedule-date">
        <label>Publication Date</label>
        <DatePicker
          value={scheduledDate}
          onChange={setScheduledDate}
          minDate={new Date()}
          format="DD/MM/YYYY"
        />
      </div>

      <div className="schedule-time">
        <label>Publication Time (optional)</label>
        <TimePicker
          value={scheduledTime}
          onChange={setScheduledTime}
          format="HH:mm"
        />
      </div>

      <div className="schedule-platforms">
        <label>Publish to Platforms</label>
        <div className="checkbox-group">
          {item.platform && (
            <label>
              <input type="checkbox" checked readOnly />
              {item.platform.charAt(0).toUpperCase() + item.platform.slice(1)}
            </label>
          )}
        </div>
      </div>

      {scheduledDate && (
        <div className="schedule-preview">
          <p>Scheduled for: {new Date(scheduledDate).toLocaleString("pt-BR")}</p>
        </div>
      )}
    </div>
  </ModalBody>

  <ModalFooter>
    <Button kind="tertiary" onClick={closeModal}>
      Cancel
    </Button>
    <Button kind="primary" onClick={saveSchedule}>
      Schedule
    </Button>
  </ModalFooter>
</Modal>
```

#### Styling

```css
.schedule-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px 0;
}

.schedule-date,
.schedule-time,
.schedule-platforms {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-date label,
.schedule-time label,
.schedule-platforms label {
  font-weight: 600;
  font-size: 14px;
  color: #161616;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-preview {
  background-color: #e8f5e9;
  padding: 12px;
  border-radius: 4px;
  border-left: 3px solid #24a148;
}

.schedule-preview p {
  margin: 0;
  font-size: 14px;
  color: #0f4620;
  font-weight: 500;
}
```

---

## AI Integration & Processing

### AI Router Edge Function

The Content Factory communicates with the **AI Router Edge Function** to trigger content regeneration.

#### Endpoint

```
POST /functions/v1/ai-router
```

#### Request Payload

```typescript
interface AIRouterRequest {
  contentItemId: string;
  tenantId: string;
  action: "generate" | "regenerate" | "regenerate_with_heuristic";
  context?: {
    brandDNA?: BrandDNA;
    campaign?: CampaignMetadata;
    previousContent?: string;
    heuristicFocus?: "brand" | "cta" | "tone" | "compliance";
  };
}
```

#### Response Structure

```typescript
interface AIRouterResponse {
  success: boolean;
  contentItemId: string;
  status: "generating" | "generated";
  generatedTitle?: string;
  generatedBody?: string;
  aiProvider: string;
  aiModel: string;
  complianceScore?: number;
  estimatedTime?: number; // milliseconds
  error?: string;
}
```

#### Execution Flow

1. **User clicks "Regenerate"** in expanded row
2. **MatrixTable component calls**:
   ```typescript
   const handleRegenerate = async (contentItemId: string) => {
     try {
       // Update status to 'generating' to trigger glow
       await updateContentStatus(contentItemId, "generating");

       // Call Edge Function
       const response = await supabase.functions.invoke("ai-router", {
         body: {
           contentItemId,
           tenantId,
           action: "regenerate",
           context: {
             brandDNA: currentBrandDNA,
             campaign: currentCampaign,
             previousContent: contentItems.find(i => i.id === contentItemId)?.body,
           },
         },
       });

       if (response.error) throw response.error;

       // Edge Function updates Supabase; Realtime subscription handles glow removal
     } catch (error) {
       console.error("Regeneration failed", error);
       await updateContentStatus(contentItemId, "generated"); // Revert status
       setRowGlowActive((prev) => {
         const next = new Set(prev);
         next.delete(contentItemId);
         return next;
       });
     }
   };
   ```

3. **Edge Function processes**:
   - Retrieves Brand DNA and content context
   - Selects AI provider and model based on tenant settings
   - Sends prompt to AI API (OpenAI, Anthropic, etc.)
   - Runs compliance checks on generated content
   - Updates `content_items` table with new content and status

4. **Realtime Subscription receives**:
   - Status change from `generating` → `generated`
   - Triggers React state update to remove glow

### Compliance Scoring

Compliance scores (0–100) are computed using a multi-criteria heuristic:

```typescript
interface ComplianceScorer {
  scoreContent(
    content: { title: string; body: string },
    brandDNA: BrandDNA,
    legalRequirements?: LegalPolicy[]
  ): number;
}

// Scoring factors:
// - Brand alignment (30%): Adherence to Brand DNA tone, values, pillars
// - Clarity & Readability (20%): Flesch-Kincaid, sentence structure
// - CTA Effectiveness (20%): Action-oriented language, clarity
// - Compliance (20%): Legal requirements, disclosures
// - Engagement Potential (10%): Predicted engagement based on platform

const complianceScore = Math.round(
  (brandAlignment * 0.3 +
    clarity * 0.2 +
    ctaEffectiveness * 0.2 +
    legalCompliance * 0.2 +
    engagement * 0.1)
);
```

---

## Data Flow & State Management

### Data Sources

1. **Supabase Database** (`content_items` table)
   - Single source of truth
   - Normalized schema with foreign keys to `tenants`, `campaigns`, `brand_dna`

2. **React Component State**
   - Local cache of content items
   - Edit buffers for title/body
   - UI state (modals, expanded rows, glow)

3. **Supabase Realtime** (Subscription)
   - Listens for changes to `content_items`
   - Triggers state updates for other users' changes

### State Management Architecture

```typescript
// MatrixTable.tsx state
const [contentItems, setContentItems] = useState<ContentItem[]>([]);
const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
const [editingTitle, setEditingTitle] = useState("");
const [editingBody, setEditingBody] = useState("");
const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
const [searchQuery, setSearchQuery] = useState("");
const [activeModal, setActiveModal] = useState<ModalType | null>(null);
const [modalData, setModalData] = useState<any>(null);
const [rowGlowActive, setRowGlowActive] = useState<Set<string>>(new Set());
const [isLoading, setIsLoading] = useState(false);
const [filteredItems, setFilteredItems] = useState<ContentItem[]>([]);
```

### Lifecycle Hooks

#### Initial Load

```typescript
useEffect(() => {
  const loadContentItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContentItems(data || []);
    } catch (error) {
      console.error("Failed to load content items", error);
    } finally {
      setIsLoading(false);
    }
  };

  loadContentItems();
}, [tenantId]);
```

#### Realtime Subscription

```typescript
useEffect(() => {
  if (!tenantId) return;

  const subscription = supabase
    .from("content_items")
    .on("*", (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      if (eventType === "UPDATE") {
        // Handle status changes for glow effect
        if (oldRecord?.status !== newRecord?.status) {
          if (newRecord?.status === "generated") {
            setRowGlowActive((prev) => {
              const next = new Set(prev);
              next.delete(newRecord.id);
              return next;
            });
          }
          if (newRecord?.status === "generating") {
            setRowGlowActive((prev) => new Set(prev).add(newRecord.id));
          }
        }

        // Update content item in state
        setContentItems((prev) =>
          prev.map((item) =>
            item.id === newRecord?.id ? { ...item, ...newRecord } : item
          )
        );
      }

      if (eventType === "INSERT") {
        setContentItems((prev) => [newRecord, ...prev]);
      }

      if (eventType === "DELETE") {
        setContentItems((prev) => prev.filter((item) => item.id !== oldRecord?.id));
      }
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [tenantId]);
```

#### Row Expansion Handler

```typescript
const handleRowExpand = (itemId: string) => {
  if (expandedRowId === itemId) {
    setExpandedRowId(null);
  } else {
    const item = contentItems.find((i) => i.id === itemId);
    setExpandedRowId(itemId);
    setEditingTitle(item?.title || "");
    setEditingBody(item?.body || "");
  }
};
```

### Search & Filter Logic

```typescript
useEffect(() => {
  const query = searchQuery.toLowerCase();
  const filtered = contentItems.filter((item) => {
    return (
      item.title.toLowerCase().includes(query) ||
      item.body.toLowerCase().includes(query) ||
      item.contentType.toLowerCase().includes(query) ||
      item.platform.toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query)
    );
  });
  setFilteredItems(filtered);
}, [contentItems, searchQuery]);
```

---

## Realtime Subscriptions

### Subscription Configuration

Supabase Realtime subscriptions enable live updates across users and sessions.

#### Event Types Monitored

- **INSERT**: New content item created
- **UPDATE**: Existing item modified (status, content, compliance score, etc.)
- **DELETE**: Content item deleted (rare, typically archived)

#### Payload Structure

```typescript
interface RealtimePayload {
  type: "REALTIME_SUBSCRIPTION_STATE" | "BROADCAST" | "POSTGRES_CHANGES";
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema: "public";
  table: "content_items";
  commit_timestamp: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: ContentItem;
  old: ContentItem;
}
```

#### Implementation

```typescript
const subscription = supabase
  .from("content_items")
  .on("postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "content_items",
      filter: `tenant_id=eq.${tenantId}`,
    },
    (payload) => {
      // Handle payload
    }
  )
  .subscribe((status) => {
    console.log("Subscription status:", status);
  });
```

### Key Status Changes

#### "generating" → "generated"
- **Trigger**: AI regeneration completes
- **Action**: Remove row glow, update content display
- **Visual Feedback**: Pulsing animation stops

#### "draft" → "reviewing"
- **Trigger**: User submits for formal review
- **Action**: Update status tag color to yellow
- **Notification**: Optional notification to reviewers

#### "reviewing" → "approved"
- **Trigger**: Stakeholder approves content
- **Action**: Update status tag color to green
- **Action**: Schedule button becomes available

#### "approved" → "published"
- **Trigger**: Publication occurs (manual or scheduled)
- **Action**: Update status tag color to teal
- **Action**: Disable editing

### Performance Optimization

- **Filtering**: Subscribe only to current tenant's items
- **Debouncing**: Batch multiple updates within 500ms window
- **Memory Management**: Unsubscribe on component unmount
- **Selective Rendering**: Update only affected row in DataTable

---

## Component Code Structure

### Complete MatrixTable.tsx Component

```typescript
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  DataTable,
  DataTableRow,
  DataTableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TableToolbarMenu,
  TableBatchActions,
  OverflowMenu,
  OverflowMenuItem,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tag,
  Pagination,
  Loading,
  InlineNotification,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from "@carbon/react";
import { createClient } from "@supabase/supabase-js";
import "./MatrixTable.css";
import "./RowGlow.css";

// Initialize Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

interface ContentItem {
  id: string;
  title: string;
  body: string;
  contentType: "article" | "social_post" | "email" | "video_script" | "landing_page";
  platform: "facebook" | "instagram" | "twitter" | "linkedin" | "web" | "email";
  status: "draft" | "generated" | "reviewing" | "approved" | "published" | "rejected";
  complianceScore: number;
  pillar: string;
  scheduledDate?: Date;
  aiProvider?: string;
  aiModel?: string;
  mediaUrls?: string[];
  heuristicReport?: string;
  feedback?: {
    rating: number;
    comment: string;
    author?: string;
    createdAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

type ModalType = "heuristic" | "feedback" | "brandDNA" | "schedule" | null;
type Status = ContentItem["status"];

interface MatrixTableProps {
  tenantId: string;
}

const MatrixTable: React.FC<MatrixTableProps> = ({ tenantId }) => {
  // State Management
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ContentItem[]>([]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalData, setModalData] = useState<any>(null);
  const [rowGlowActive, setRowGlowActive] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [brandDNA, setBrandDNA] = useState<any>(null);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");

  // Load content items
  useEffect(() => {
    const loadContentItems = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("content_items")
          .select("*")
          .eq("tenant_id", tenantId)
          .order(sortKey, { ascending: sortOrder === "asc" });

        if (error) throw error;
        setContentItems(data || []);
      } catch (error) {
        console.error("Failed to load content items", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (tenantId) {
      loadContentItems();
    }
  }, [tenantId, sortKey, sortOrder]);

  // Filter items based on search
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = contentItems.filter((item) => {
      return (
        item.title.toLowerCase().includes(query) ||
        item.body.toLowerCase().includes(query) ||
        item.contentType.toLowerCase().includes(query) ||
        item.platform.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query)
      );
    });
    setFilteredItems(filtered);
    setCurrentPage(1);
  }, [contentItems, searchQuery]);

  // Realtime subscription
  useEffect(() => {
    if (!tenantId) return;

    const subscription = supabase
      .from("content_items")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "content_items",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === "UPDATE") {
            // Handle glow effect for status changes
            if (oldRecord?.status !== newRecord?.status) {
              if (newRecord?.status === "generated" && oldRecord?.status === "generating") {
                setRowGlowActive((prev) => {
                  const next = new Set(prev);
                  next.delete(newRecord.id);
                  return next;
                });
              }
              if (newRecord?.status === "generating") {
                setRowGlowActive((prev) => new Set(prev).add(newRecord.id));
              }
            }

            // Update item in state
            setContentItems((prev) =>
              prev.map((item) =>
                item.id === newRecord?.id
                  ? {
                      ...item,
                      ...newRecord,
                      createdAt: new Date(newRecord.created_at),
                      updatedAt: new Date(newRecord.updated_at),
                    }
                  : item
              )
            );
          }

          if (eventType === "INSERT") {
            setContentItems((prev) => [
              {
                ...newRecord,
                createdAt: new Date(newRecord.created_at),
                updatedAt: new Date(newRecord.updated_at),
              },
              ...prev,
            ]);
          }

          if (eventType === "DELETE") {
            setContentItems((prev) => prev.filter((item) => item.id !== oldRecord?.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [tenantId]);

  // Helper functions
  const getStatusColor = (status: Status): string => {
    const colorMap: Record<Status, string> = {
      draft: "gray",
      generated: "blue",
      reviewing: "yellow",
      approved: "green",
      published: "teal",
      rejected: "red",
    };
    return colorMap[status] || "gray";
  };

  const getComplianceColor = (score: number): string => {
    if (score >= 70) return "#24a148";
    if (score >= 40) return "#f1c21b";
    return "#da1e28";
  };

  const getRowClassName = (itemId: string): string => {
    return rowGlowActive.has(itemId) ? "row-glow-active" : "";
  };

  // Event handlers
  const handleRowExpand = (itemId: string) => {
    if (expandedRowId === itemId) {
      setExpandedRowId(null);
    } else {
      const item = contentItems.find((i) => i.id === itemId);
      setExpandedRowId(itemId);
      setEditingTitle(item?.title || "");
      setEditingBody(item?.body || "");
    }
  };

  const handleSaveChanges = async () => {
    if (!expandedRowId) return;

    try {
      const { error } = await supabase
        .from("content_items")
        .update({
          title: editingTitle,
          body: editingBody,
          updated_at: new Date().toISOString(),
        })
        .eq("id", expandedRowId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to save changes", error);
    }
  };

  const handleRegenerate = async (contentItemId: string) => {
    try {
      // Set status to 'generating' to trigger glow
      await supabase
        .from("content_items")
        .update({ status: "generating" })
        .eq("id", contentItemId);

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke("ai-router", {
        body: {
          contentItemId,
          tenantId,
          action: "regenerate",
          context: {
            brandDNA,
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error("Regeneration failed", error);
      // Revert status on error
      await supabase
        .from("content_items")
        .update({ status: "generated" })
        .eq("id", contentItemId);
    }
  };

  const handleApprove = async (itemId: string) => {
    try {
      await supabase
        .from("content_items")
        .update({ status: "approved" })
        .eq("id", itemId);
    } catch (error) {
      console.error("Failed to approve", error);
    }
  };

  const handleReject = async (itemId: string) => {
    try {
      await supabase
        .from("content_items")
        .update({ status: "rejected" })
        .eq("id", itemId);
    } catch (error) {
      console.error("Failed to reject", error);
    }
  };

  const handleOpenModal = (modalType: ModalType, item: ContentItem) => {
    setActiveModal(modalType);
    setModalData(item);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalData(null);
    setFeedbackRating(0);
    setFeedbackComment("");
    setScheduledDate(null);
  };

  const handleSubmitFeedback = async () => {
    if (!modalData) return;

    try {
      await supabase
        .from("content_items")
        .update({
          feedback: {
            rating: feedbackRating,
            comment: feedbackComment,
            author: "Current User",
            createdAt: new Date().toISOString(),
          },
        })
        .eq("id", modalData.id);

      closeModal();
    } catch (error) {
      console.error("Failed to submit feedback", error);
    }
  };

  const handleSchedule = async () => {
    if (!modalData || !scheduledDate) return;

    try {
      await supabase
        .from("content_items")
        .update({
          scheduled_date: scheduledDate.toISOString(),
          status: "approved",
        })
        .eq("id", modalData.id);

      closeModal();
    } catch (error) {
      console.error("Failed to schedule", error);
    }
  };

  // Pagination
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);

  // Render
  if (isLoading) {
    return <Loading description="Loading content items..." />;
  }

  return (
    <div className="matrix-table-container">
      <h2>Content Factory — Matrix List</h2>

      <DataTable
        rows={paginatedItems.map((item) => ({
          id: item.id,
          ...item,
        }))}
        headers={[
          { key: "status", header: "Status" },
          { key: "title", header: "Title" },
          { key: "contentType", header: "Content Type" },
          { key: "platform", header: "Platform" },
          { key: "complianceScore", header: "Compliance Score" },
          { key: "pillar", header: "Pillar" },
          { key: "scheduledDate", header: "Scheduled Date" },
          { key: "actions", header: "" },
        ]}
      >
        {({ rows, headers, getHeaderProps, getRowProps }) => (
          <>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  persistent
                  placeholder="Search by title, content type, platform..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </TableToolbarContent>
            </TableToolbar>

            <table>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header.key} {...getHeaderProps({ header })}>
                      {header.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const item = paginatedItems.find((i) => i.id === row.id);
                  if (!item) return null;

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        {...getRowProps({ row })}
                        className={`${getRowClassName(item.id)} ${
                          expandedRowId === item.id ? "expanded" : ""
                        }`}
                        onClick={() => handleRowExpand(item.id)}
                      >
                        <td>
                          <Tag type={getStatusColor(item.status)}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </Tag>
                        </td>
                        <td>{item.title}</td>
                        <td>
                          <span className="badge">
                            {item.contentType.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <span className="badge">
                            {item.platform.charAt(0).toUpperCase() +
                              item.platform.slice(1)}
                          </span>
                        </td>
                        <td>
                          <div
                            className="compliance-score"
                            style={{
                              backgroundColor: getComplianceColor(item.complianceScore),
                            }}
                          >
                            {item.complianceScore}%
                          </div>
                        </td>
                        <td>{item.pillar || "—"}</td>
                        <td>
                          {item.scheduledDate
                            ? new Date(item.scheduledDate).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <OverflowMenu flipped>
                            <OverflowMenuItem
                              itemText="Regenerate"
                              onClick={() => handleRegenerate(item.id)}
                            />
                            <OverflowMenuItem
                              itemText="Approve"
                              onClick={() => handleApprove(item.id)}
                            />
                            <OverflowMenuItem
                              itemText="Reject"
                              onClick={() => handleReject(item.id)}
                            />
                            <OverflowMenuItem
                              itemText="View Heuristic"
                              onClick={() => handleOpenModal("heuristic", item)}
                            />
                            <OverflowMenuItem
                              itemText="Give Feedback"
                              onClick={() => handleOpenModal("feedback", item)}
                            />
                            <OverflowMenuItem
                              itemText="View Brand DNA"
                              onClick={() => handleOpenModal("brandDNA", item)}
                            />
                            <OverflowMenuItem
                              itemText="Schedule"
                              onClick={() => handleOpenModal("schedule", item)}
                            />
                          </OverflowMenu>
                        </td>
                      </tr>

                      {expandedRowId === item.id && (
                        <tr className="row-expansion-container">
                          <td colSpan={headers.length}>
                            <div className="row-expansion">
                              <div className="row-expansion-left">
                                <div className="expansion-media-gallery">
                                  <h4>Media Gallery</h4>
                                  <div className="gallery-container">
                                    {item.mediaUrls && item.mediaUrls.length > 0 ? (
                                      item.mediaUrls.map((url, idx) => (
                                        <img
                                          key={idx}
                                          src={url}
                                          alt={`Media ${idx + 1}`}
                                          style={{ maxWidth: "150px", borderRadius: "4px" }}
                                        />
                                      ))
                                    ) : (
                                      <p style={{ color: "#8d8d8d" }}>
                                        No media attached
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="expansion-title-editor">
                                  <label>Title</label>
                                  <textarea
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    maxLength={255}
                                    rows={2}
                                    placeholder="Enter content title..."
                                  />
                                  <small>{editingTitle.length}/255</small>
                                </div>
                              </div>

                              <div className="row-expansion-right">
                                <div className="expansion-body-editor">
                                  <label>Body</label>
                                  <textarea
                                    value={editingBody}
                                    onChange={(e) => setEditingBody(e.target.value)}
                                    rows={8}
                                    placeholder="Enter content body..."
                                  />
                                  <small>{editingBody.length} characters</small>
                                </div>

                                <div className="row-expansion-actions">
                                  <Button
                                    kind="secondary"
                                    size="small"
                                    onClick={handleSaveChanges}
                                  >
                                    Save Changes
                                  </Button>
                                  <Button
                                    kind="primary"
                                    size="small"
                                    onClick={() => handleRegenerate(item.id)}
                                  >
                                    Regenerate
                                  </Button>
                                  <Button
                                    kind="tertiary"
                                    size="small"
                                    onClick={() => handleOpenModal("heuristic", item)}
                                  >
                                    Ver Heurística
                                  </Button>
                                  <Button
                                    kind="tertiary"
                                    size="small"
                                    onClick={() => handleOpenModal("feedback", item)}
                                  >
                                    Give Feedback
                                  </Button>
                                  <Button
                                    kind="tertiary"
                                    size="small"
                                    onClick={() => handleOpenModal("brandDNA", item)}
                                  >
                                    View Brand DNA
                                  </Button>
                                  <Button
                                    kind="tertiary"
                                    size="small"
                                    onClick={() => handleOpenModal("schedule", item)}
                                  >
                                    Schedule
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </DataTable>

      <Pagination
        backwardText="Previous page"
        forwardText="Next page"
        page={currentPage}
        pageSize={pageSize}
        pageSizes={[10, 25, 50]}
        totalItems={filteredItems.length}
        onChange={(page) => setCurrentPage(page.page)}
      />

      {/* Heuristic Report Modal */}
      <Modal open={activeModal === "heuristic"} onClose={closeModal}>
        <ModalHeader>
          <h2 className="modal-title">Heuristic Analysis</h2>
        </ModalHeader>
        <ModalBody>
          <div className="heuristic-report">
            <section>
              <h4>Brand Alignment</h4>
              <p>
                {modalData?.heuristicReport ||
                  "Analysis of how well this content adheres to your Brand DNA..."}
              </p>
            </section>
            <section>
              <h4>Campaign Scope</h4>
              <p>Assessment of content relevance to campaign objectives...</p>
            </section>
            <section>
              <h4>CTA Effectiveness</h4>
              <p>Evaluation of call-to-action clarity and persuasiveness...</p>
            </section>
            <section>
              <h4>Conhecimentos da Atualidade</h4>
              <p>Real-time context analysis incorporating current events...</p>
            </section>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button kind="tertiary" onClick={closeModal}>
            Close
          </Button>
          <Button kind="primary" onClick={() => handleRegenerate(modalData?.id)}>
            Regenerar com Heurística
          </Button>
        </ModalFooter>
      </Modal>

      {/* Feedback Modal */}
      <Modal open={activeModal === "feedback"} onClose={closeModal}>
        <ModalHeader>
          <h2 className="modal-title">Content Feedback</h2>
        </ModalHeader>
        <ModalBody>
          <div className="feedback-form">
            <div className="feedback-rating">
              <label>Rate this content (1-5 stars)</label>
              <div className="star-rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className={`star ${star <= feedbackRating ? "active" : ""}`}
                    onClick={() => setFeedbackRating(star)}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="feedback-comment">
              <label>Comments (optional)</label>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Share your thoughts on this content..."
                rows={6}
                maxLength={1000}
              />
              <small>{feedbackComment.length}/1000</small>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button kind="tertiary" onClick={closeModal}>
            Cancel
          </Button>
          <Button kind="primary" onClick={handleSubmitFeedback}>
            Submit Feedback
          </Button>
        </ModalFooter>
      </Modal>

      {/* Brand DNA Modal */}
      <Modal open={activeModal === "brandDNA"} onClose={closeModal} size="lg">
        <ModalHeader>
          <h2 className="modal-title">Brand DNA</h2>
        </ModalHeader>
        <ModalBody>
          <div className="brand-dna-viewer">
            <section className="brand-section">
              <h4>Mission</h4>
              <p>{brandDNA?.mission || "Loading brand information..."}</p>
            </section>
            <section className="brand-section">
              <h4>Vision</h4>
              <p>{brandDNA?.vision || "Vision statement will appear here"}</p>
            </section>
            <section className="brand-section">
              <h4>Values</h4>
              <ul>
                {brandDNA?.values?.map((value: string, idx: number) => (
                  <li key={idx}>{value}</li>
                )) || <li>Values loading...</li>}
              </ul>
            </section>
            <section className="brand-section">
              <h4>Tone & Voice</h4>
              <p>{brandDNA?.toneAndVoice || "Tone guidelines appear here"}</p>
            </section>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button kind="primary" onClick={closeModal}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {/* Schedule Modal */}
      <Modal open={activeModal === "schedule"} onClose={closeModal}>
        <ModalHeader>
          <h2 className="modal-title">Schedule Content</h2>
        </ModalHeader>
        <ModalBody>
          <div className="schedule-form">
            <div className="schedule-date">
              <label>Publication Date</label>
              <input
                type="date"
                value={scheduledDate ? scheduledDate.toISOString().split("T")[0] : ""}
                onChange={(e) =>
                  setScheduledDate(e.target.value ? new Date(e.target.value) : null)
                }
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            {scheduledDate && (
              <div className="schedule-preview">
                <p>
                  Scheduled for:{" "}
                  {new Date(scheduledDate).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button kind="tertiary" onClick={closeModal}>
            Cancel
          </Button>
          <Button kind="primary" onClick={handleSchedule} disabled={!scheduledDate}>
            Schedule
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default MatrixTable;
```

---

## Styling & CSS

### MatrixTable.css

```css
.matrix-table-container {
  padding: 24px;
  background-color: #ffffff;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.matrix-table-container h2 {
  margin: 0 0 24px 0;
  font-size: 20px;
  font-weight: 600;
  color: #161616;
}

/* DataTable Styles */
table {
  width: 100%;
  border-collapse: collapse;
}

thead tr {
  border-bottom: 2px solid #e0e0e0;
}

th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #161616;
  font-size: 14px;
  background-color: #f4f4f4;
}

tbody tr {
  border-bottom: 1px solid #f1f1f1;
  transition: background-color 200ms ease-in-out;
}

tbody tr:hover {
  background-color: #f4f4f4;
  cursor: pointer;
}

td {
  padding: 12px;
  font-size: 14px;
  color: #525252;
}

/* Status Tag */
.cds--tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 12px;
  white-space: nowrap;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 4px 12px;
  background-color: #e8e8e8;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #161616;
}

/* Compliance Score */
.compliance-score {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  color: #ffffff;
  font-weight: 600;
  font-size: 12px;
}

/* Row Expansion */
.row-expansion-container {
  background-color: #fafafa;
}

.row-expansion {
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 24px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  animation: slideDown 300ms ease-out;
  margin: 12px 0;
}

.row-expansion-left,
.row-expansion-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.expansion-media-gallery {
  padding: 16px;
  background-color: #f4f4f4;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.expansion-media-gallery h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #161616;
}

.gallery-container {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.gallery-container img {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
}

.expansion-title-editor,
.expansion-body-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.expansion-title-editor label,
.expansion-body-editor label {
  font-weight: 600;
  font-size: 14px;
  color: #161616;
}

.expansion-title-editor textarea,
.expansion-body-editor textarea {
  padding: 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-family: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  background-color: #ffffff;
  color: #161616;
}

.expansion-title-editor textarea:focus,
.expansion-body-editor textarea:focus {
  outline: none;
  border-color: #0f62fe;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1),
    0 0 0 3px rgba(15, 98, 254, 0.2);
}

.expansion-title-editor small,
.expansion-body-editor small {
  font-size: 12px;
  color: #8d8d8d;
}

.row-expansion-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Modal Styles */
.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #161616;
}

.heuristic-report {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: 600px;
  overflow-y: auto;
  padding: 24px 0;
}

.heuristic-report section {
  border-left: 4px solid #0f62fe;
  padding-left: 16px;
}

.heuristic-report h4 {
  margin: 0 0 8px 0;
  font-weight: 600;
  font-size: 14px;
  color: #161616;
}

.heuristic-report p {
  margin: 0;
  color: #525252;
  line-height: 1.6;
  font-size: 13px;
}

/* Feedback Form */
.feedback-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px 0;
}

.feedback-rating,
.feedback-comment {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feedback-rating label,
.feedback-comment label {
  font-weight: 600;
  font-size: 14px;
  color: #161616;
}

.star-rating {
  display: flex;
  gap: 8px;
}

.star {
  background: none;
  border: none;
  font-size: 32px;
  color: #e0e0e0;
  cursor: pointer;
  transition: color 200ms ease;
  padding: 0;
}

.star:hover,
.star.active {
  color: #f1c21b;
}

.feedback-comment textarea {
  padding: 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-family: "IBM Plex Sans", sans-serif;
  font-size: 14px;
  resize: vertical;
}

.feedback-comment textarea:focus {
  outline: none;
  border-color: #0f62fe;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1),
    0 0 0 3px rgba(15, 98, 254, 0.2);
}

/* Brand DNA Viewer */
.brand-dna-viewer {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 24px 0;
  max-height: 700px;
  overflow-y: auto;
}

.brand-section {
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 24px;
}

.brand-section:last-child {
  border-bottom: none;
}

.brand-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #161616;
}

.brand-section p,
.brand-section li {
  margin: 8px 0;
  color: #525252;
  line-height: 1.6;
  font-size: 14px;
}

.brand-section ul {
  padding-left: 24px;
  margin: 0;
}

/* Schedule Form */
.schedule-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px 0;
}

.schedule-date {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-date label {
  font-weight: 600;
  font-size: 14px;
  color: #161616;
}

.schedule-date input {
  padding: 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 14px;
}

.schedule-date input:focus {
  outline: none;
  border-color: #0f62fe;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1),
    0 0 0 3px rgba(15, 98, 254, 0.2);
}

.schedule-preview {
  background-color: #e8f5e9;
  padding: 12px;
  border-radius: 4px;
  border-left: 3px solid #24a148;
}

.schedule-preview p {
  margin: 0;
  font-size: 14px;
  color: #0f4620;
  font-weight: 500;
}

/* Loading State */
.cds--loading {
  padding: 24px;
  text-align: center;
}
```

### RowGlow.css

```css
/* Row Glow Effect - CRITICAL UX FEATURE */

/* Active glow state - applied when AI is regenerating */
.row-glow-active {
  border: 1px solid #0f62fe !important;
  box-shadow: 0 0 10px rgba(15, 98, 254, 0.5) !important;
  animation: pulse-blue 2s infinite;
  pointer-events: none;
  opacity: 0.7;
}

/* Pulsing blue animation for glow effect */
@keyframes pulse-blue {
  0% {
    box-shadow: 0 0 10px rgba(15, 98, 254, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(15, 98, 254, 0.8);
  }
  100% {
    box-shadow: 0 0 10px rgba(15, 98, 254, 0.3);
  }
}

/* Disable interaction within glowing row */
.row-glow-active input,
.row-glow-active button,
.row-glow-active textarea,
.row-glow-active select {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Glowing row appears dimmed */
.row-glow-active {
  background-color: rgba(15, 98, 254, 0.05) !important;
}

/* ARIA busy state for accessibility */
.row-glow-active[aria-busy="true"] {
  /* Assistive technology will announce busy state */
}
```

---

## Actions & User Interactions

### Available Actions on Rows

#### 1. Regenerate
- **Trigger**: OverflowMenu "Regenerate" option or button in expanded row
- **Status Change**: `generating` → `generated`
- **Visual Effect**: Row glow activates (pulse-blue animation)
- **Result**: Updated title and body from AI Router
- **Post-completion**: Row glow deactivates, compliance score updated

#### 2. Approve
- **Trigger**: OverflowMenu "Approve" option
- **Status Change**: `generated` or `reviewing` → `approved`
- **Visual Effect**: Status tag changes to green
- **Permission**: Schedule button becomes available

#### 3. Reject
- **Trigger**: OverflowMenu "Reject" option
- **Status Change**: Any status → `rejected`
- **Visual Effect**: Status tag changes to red
- **Next Action**: Edit and regenerate available

#### 4. View Heuristic
- **Trigger**: Button in expanded row or OverflowMenu
- **Modal Opens**: HeuristicReport modal
- **Content**: Brand alignment, campaign scope, CTA analysis, context awareness
- **Related Action**: "Regenerar com Heurística" option available

#### 5. Give Feedback
- **Trigger**: Button in expanded row or OverflowMenu
- **Modal Opens**: Feedback modal
- **Input**: 1-5 star rating, optional comment (max 1000 chars)
- **Persistence**: Feedback saved to `content_items.feedback`

#### 6. View Brand DNA
- **Trigger**: Button in expanded row or OverflowMenu
- **Modal Opens**: Brand DNA Viewer (read-only)
- **Content**: Mission, vision, values, tone, pillars, visual guidelines
- **Edit Rights**: None — clients cannot edit Brand DNA

#### 7. Schedule
- **Trigger**: Button in expanded row or OverflowMenu
- **Modal Opens**: Schedule modal with date picker
- **Requirement**: Status must be `approved`
- **Result**: `scheduled_date` set, status locked to `approved`

#### 8. Save Changes
- **Trigger**: Button in expanded row
- **Action**: Persists title and body edits to Supabase
- **Status**: No status change
- **Update**: `updated_at` timestamp updated

### Batch Actions (TableToolbar)

Via TableBatchActions component:
- **Select Multiple**: Click checkboxes on rows
- **Approve All**: Approve all selected rows at once
- **Reject All**: Reject all selected rows at once
- **Delete Selected**: Soft delete (archive) selected items

---

## Integration Points

### Supabase Integration

#### Tables Referenced

1. **content_items**
   - `id` (UUID primary key)
   - `tenant_id` (UUID foreign key)
   - `title` (varchar 255)
   - `body` (text)
   - `content_type` (enum)
   - `platform` (enum)
   - `status` (enum)
   - `compliance_score` (numeric 0–100)
   - `pillar` (varchar)
   - `scheduled_date` (timestamp nullable)
   - `ai_provider` (varchar nullable)
   - `ai_model` (varchar nullable)
   - `media_urls` (json array nullable)
   - `heuristic_report` (text nullable)
   - `feedback` (json nullable)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

2. **brand_dna**
   - `id` (UUID primary key)
   - `tenant_id` (UUID foreign key)
   - `mission` (text)
   - `vision` (text)
   - `values` (json array)
   - `tone_and_voice` (text)
   - `pillars` (json array)
   - `visual_guidelines` (text)
   - `brand_guide_url` (varchar nullable)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

3. **campaigns**
   - `id` (UUID primary key)
   - `tenant_id` (UUID foreign key)
   - `name` (varchar)
   - `metadata` (json)
   - `created_at` (timestamp)

#### Realtime Subscriptions

```typescript
supabase
  .from("content_items")
  .on("postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "content_items",
      filter: `tenant_id=eq.${tenantId}`,
    },
    handleRealtimePayload
  )
  .subscribe();
```

### Edge Functions

#### ai-router
- **URL**: `/functions/v1/ai-router`
- **Method**: POST
- **Authentication**: Supabase JWT token
- **Actions**: `generate`, `regenerate`, `regenerate_with_heuristic`
- **Response**: Updated content_item record with AI-generated content

### Carbon Design System Components

- **DataTable**: Core table component with sorting, pagination
- **Tag**: Status indicators with color variants
- **Modal**: Overlays for heuristic, feedback, Brand DNA, schedule
- **Button**: Primary, secondary, tertiary action buttons
- **OverflowMenu**: Row-level actions dropdown
- **TableToolbar**: Search and batch action toolbar
- **Pagination**: Table pagination control
- **Loading**: Loading state indicator

---

## Conclusion

The Content Factory Matrix List is a comprehensive, real-time content management workstation built on the Carbon Design System, React, and Supabase. Its single-page, single-table paradigm prioritizes user focus while providing powerful AI integration, compliance tracking, and stakeholder collaboration features.

Key strengths:
- **Unified Interface**: All operations in one view — no navigation confusion
- **Real-time Collaboration**: Instant updates via Supabase Realtime
- **Visual Feedback**: Row glow effect communicates processing state
- **AI-Powered**: Seamless integration with Edge Functions and AI Router
- **Compliance-Ready**: Automated scoring and heuristic analysis
- **Enterprise-Grade**: Multi-modal overlays, comprehensive data model, accessibility support

*Documento #5 de 10*